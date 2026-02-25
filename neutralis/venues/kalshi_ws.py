"""Kalshi WebSocket client with auto-reconnect and channel management.

Production URL: wss://api.elections.kalshi.com/trade-api/ws/v2
Auth: RSA-PSS signed headers on handshake.

Public channels (no auth needed): ticker, trade, market_lifecycle_v2
Private channels (auth required): fill, orderbook_delta, market_positions
"""

from __future__ import annotations

import asyncio
import json
import ssl
import certifi
from typing import Any, Callable, Coroutine

import websockets
from websockets.asyncio.client import ClientConnection

from neutralis.config import ExecutionConfig, WebSocketConfig
from neutralis.execution.auth import load_private_key, load_private_key_from_pem_string, ws_auth_headers
from neutralis.logging import get_logger

logger = get_logger(__name__)

# Type alias for message handlers
MsgHandler = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class KalshiWebSocket:
    """Async WebSocket client for Kalshi real-time market data.

    Handles:
    - Authenticated connection with RSA-PSS headers
    - Auto-reconnect with exponential backoff
    - Channel subscription management (ticker, fill, trade)
    - Market-filtered subscriptions for focused monitoring
    - Message dispatch to registered handlers
    """

    def __init__(
        self,
        ws_config: WebSocketConfig,
        exec_config: ExecutionConfig,
    ) -> None:
        self._ws_cfg = ws_config
        self._exec_cfg = exec_config
        self._ws: ClientConnection | None = None
        self._handlers: dict[str, list[MsgHandler]] = {}
        self._subscribed_tickers: set[str] = set()
        self._sub_id = 0
        self._running = False
        self._reconnect_delay = ws_config.reconnect_delay_sec

        # Load auth credentials
        self._api_key = exec_config.kalshi_api_key_id
        self._private_key = load_private_key(exec_config.kalshi_private_key_path) if exec_config.kalshi_private_key_path else None

    @classmethod
    def from_credentials(
        cls,
        ws_config: WebSocketConfig,
        api_key_id: str,
        private_key_pem: str,
    ) -> KalshiWebSocket:
        """Create from decrypted DB credentials (no env vars needed)."""
        instance = cls.__new__(cls)
        instance._ws_cfg = ws_config
        instance._exec_cfg = None
        instance._ws = None
        instance._handlers = {}
        instance._subscribed_tickers = set()
        instance._sub_id = 0
        instance._running = False
        instance._reconnect_delay = ws_config.reconnect_delay_sec
        instance._api_key = api_key_id
        instance._private_key = load_private_key_from_pem_string(private_key_pem)
        return instance

    def on(self, msg_type: str, handler: MsgHandler) -> None:
        """Register a handler for a message type (e.g. 'ticker', 'fill', 'trade')."""
        self._handlers.setdefault(msg_type, []).append(handler)

    def _next_id(self) -> int:
        self._sub_id += 1
        return self._sub_id

    async def connect(self) -> None:
        """Connect to Kalshi WebSocket with auth headers."""
        headers = ws_auth_headers(self._private_key, self._api_key)
        ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        self._ws = await websockets.connect(
            self._ws_cfg.ws_url,
            additional_headers=headers,
            ssl=ssl_ctx,
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
        )
        self._reconnect_delay = self._ws_cfg.reconnect_delay_sec
        logger.info("WebSocket connected to %s", self._ws_cfg.ws_url)

    async def subscribe_ticker(self, market_tickers: list[str] | None = None) -> None:
        """Subscribe to ticker channel for real-time price updates.

        If market_tickers is None, subscribes to ALL markets.
        Ticker prices arrive as cents (integers).
        """
        params: dict[str, Any] = {"channels": ["ticker"]}
        if market_tickers:
            params["market_tickers"] = market_tickers
            self._subscribed_tickers.update(market_tickers)
        cmd = {"id": self._next_id(), "cmd": "subscribe", "params": params}
        await self._send(cmd)
        count = len(market_tickers) if market_tickers else "all"
        logger.info("Subscribed to ticker channel (%s markets)", count)

    async def subscribe_fills(self, market_tickers: list[str] | None = None) -> None:
        """Subscribe to fill notifications (auth required)."""
        params: dict[str, Any] = {"channels": ["fill"]}
        if market_tickers:
            params["market_tickers"] = market_tickers
        cmd = {"id": self._next_id(), "cmd": "subscribe", "params": params}
        await self._send(cmd)
        logger.info("Subscribed to fill channel")

    async def subscribe_trades(self, market_tickers: list[str] | None = None) -> None:
        """Subscribe to public trade notifications."""
        params: dict[str, Any] = {"channels": ["trade"]}
        if market_tickers:
            params["market_tickers"] = market_tickers
        cmd = {"id": self._next_id(), "cmd": "subscribe", "params": params}
        await self._send(cmd)
        logger.info("Subscribed to trade channel")

    async def subscribe_lifecycle(self) -> None:
        """Subscribe to market lifecycle events (settlements, closures)."""
        params: dict[str, Any] = {"channels": ["market_lifecycle_v2"]}
        cmd = {"id": self._next_id(), "cmd": "subscribe", "params": params}
        await self._send(cmd)
        logger.info("Subscribed to market_lifecycle_v2 channel")

    async def update_subscription(
        self,
        channel: str,
        add_tickers: list[str] | None = None,
        remove_tickers: list[str] | None = None,
    ) -> None:
        """Add or remove markets from an existing subscription."""
        params: dict[str, Any] = {"channels": [channel]}
        if add_tickers:
            params["action"] = "add_markets"
            params["market_tickers"] = add_tickers
            self._subscribed_tickers.update(add_tickers)
        elif remove_tickers:
            params["action"] = "delete_markets"
            params["market_tickers"] = remove_tickers
            self._subscribed_tickers.difference_update(remove_tickers)
        cmd = {"id": self._next_id(), "cmd": "update_subscription", "params": params}
        await self._send(cmd)

    async def _send(self, msg: dict[str, Any]) -> None:
        if self._ws is None:
            raise RuntimeError("WebSocket not connected")
        await self._ws.send(json.dumps(msg))

    async def _dispatch(self, raw: str) -> None:
        """Parse and dispatch a WebSocket message to registered handlers."""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Invalid JSON from WebSocket: %s", raw[:200])
            return

        msg_type = data.get("type", "")

        if msg_type == "error":
            error_msg = data.get("msg", {})
            logger.error("WebSocket error: code=%s msg=%s", error_msg.get("code"), error_msg.get("msg"))
            return

        if msg_type == "subscribed":
            logger.debug("Subscription confirmed: %s", data)
            return

        handlers = self._handlers.get(msg_type, [])
        for handler in handlers:
            try:
                await handler(data.get("msg", {}))
            except Exception:
                logger.exception("Handler error for %s", msg_type)

    async def listen(self) -> None:
        """Main message loop — reads and dispatches messages until closed."""
        if self._ws is None:
            raise RuntimeError("WebSocket not connected")
        self._running = True
        try:
            async for raw_msg in self._ws:
                if not self._running:
                    break
                await self._dispatch(str(raw_msg))
        except websockets.ConnectionClosed as e:
            logger.warning("WebSocket connection closed: code=%s reason=%s", e.code, e.reason)
            raise

    async def run_forever(self) -> None:
        """Connect, subscribe, and listen with auto-reconnect.

        Reconnects with exponential backoff on disconnection.
        """
        self._running = True
        while self._running:
            try:
                await self.connect()
                await self.listen()
            except (websockets.ConnectionClosed, OSError) as exc:
                if not self._running:
                    break
                logger.warning(
                    "WebSocket disconnected (%s), reconnecting in %.1fs",
                    type(exc).__name__, self._reconnect_delay,
                )
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2,
                    self._ws_cfg.max_reconnect_delay_sec,
                )
            except Exception:
                if not self._running:
                    break
                logger.exception("Unexpected WebSocket error, reconnecting in %.1fs", self._reconnect_delay)
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2,
                    self._ws_cfg.max_reconnect_delay_sec,
                )

    async def close(self) -> None:
        """Gracefully close the WebSocket connection."""
        self._running = False
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
        logger.info("WebSocket closed")

    @property
    def is_connected(self) -> bool:
        return self._ws is not None and self._ws.state.name == "OPEN"

    @property
    def subscribed_count(self) -> int:
        return len(self._subscribed_tickers)
