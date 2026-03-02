"""Polymarket CLOB WebSocket client for real-time market data.

Market channel URL: wss://ws-subscriptions-clob.polymarket.com/ws/market
No authentication required (public read-only channel).

Events received:
    - book: Full orderbook snapshot on subscribe and after trades
    - price_change: Best bid/ask updates on order placement/cancellation
    - last_trade_price: Trade execution with price, size, side
"""

from __future__ import annotations

import asyncio
import json
import ssl
from typing import Any, Callable, Coroutine

import certifi
import websockets
from websockets.asyncio.client import ClientConnection

from neutralis.logging import get_logger

logger = get_logger(__name__)

MsgHandler = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class PolymarketWebSocket:
    """Async WebSocket client for Polymarket CLOB real-time market data.

    Subscribes by asset_id (CLOB token IDs) for matched markets.
    Dispatches book, price_change, and last_trade_price events to handlers.
    """

    def __init__(
        self,
        ws_url: str = "wss://ws-subscriptions-clob.polymarket.com/ws/market",
        reconnect_delay_sec: float = 1.0,
        max_reconnect_delay_sec: float = 60.0,
    ) -> None:
        self._ws_url = ws_url
        self._ws: ClientConnection | None = None
        self._handlers: dict[str, list[MsgHandler]] = {}
        self._subscribed_assets: set[str] = set()
        self._running = False
        self._reconnect_delay_init = reconnect_delay_sec
        self._reconnect_delay = reconnect_delay_sec
        self._max_reconnect_delay = max_reconnect_delay_sec

    def on(self, event_type: str, handler: MsgHandler) -> None:
        """Register a handler for an event type (book, price_change, last_trade_price)."""
        self._handlers.setdefault(event_type, []).append(handler)

    async def connect(self) -> None:
        """Connect to Polymarket CLOB WebSocket (no auth needed)."""
        ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        self._ws = await websockets.connect(
            self._ws_url,
            ssl=ssl_ctx,
            ping_interval=10,
            ping_timeout=15,
            close_timeout=5,
        )
        self._reconnect_delay = self._reconnect_delay_init
        logger.info("Polymarket WS connected to %s", self._ws_url)

    async def subscribe_markets(self, asset_ids: list[str]) -> None:
        """Subscribe to price updates for specific asset IDs (CLOB token IDs)."""
        if not asset_ids:
            return
        msg = {
            "type": "market",
            "assets_ids": asset_ids,
        }
        await self._send(msg)
        self._subscribed_assets.update(asset_ids)
        logger.info("Polymarket WS subscribed to %d assets", len(asset_ids))

    async def update_subscription(
        self,
        add_ids: list[str] | None = None,
        remove_ids: list[str] | None = None,
    ) -> None:
        """Add or remove asset subscriptions dynamically."""
        if add_ids:
            msg = {
                "assets_ids": add_ids,
                "type": "market",
                "operation": "subscribe",
            }
            await self._send(msg)
            self._subscribed_assets.update(add_ids)
            logger.info("Polymarket WS added %d assets", len(add_ids))
        if remove_ids:
            msg = {
                "assets_ids": remove_ids,
                "type": "market",
                "operation": "unsubscribe",
            }
            await self._send(msg)
            self._subscribed_assets.difference_update(remove_ids)
            logger.info("Polymarket WS removed %d assets", len(remove_ids))

    async def _send(self, msg: dict[str, Any]) -> None:
        if self._ws is None:
            raise RuntimeError("Polymarket WebSocket not connected")
        await self._ws.send(json.dumps(msg))

    async def _dispatch(self, raw: str) -> None:
        """Parse and dispatch a WebSocket message to registered handlers.

        Polymarket sends JSON arrays of events, not single objects.
        Each element in the array is an event dict with an event_type field.
        """
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Invalid JSON from Polymarket WS: %s", raw[:200])
            return

        # Polymarket sends arrays of events — normalize to list
        events: list[dict[str, Any]] = []
        if isinstance(data, list):
            events = [e for e in data if isinstance(e, dict)]
        elif isinstance(data, dict):
            events = [data]
        else:
            return

        for event in events:
            event_type = event.get("event_type", "")
            if not event_type:
                continue
            handlers = self._handlers.get(event_type, [])
            for handler in handlers:
                try:
                    await handler(event)
                except Exception:
                    logger.exception("Polymarket WS handler error for %s", event_type)

    async def listen(self) -> None:
        """Main message loop — reads and dispatches messages until closed."""
        if self._ws is None:
            raise RuntimeError("Polymarket WebSocket not connected")
        self._running = True
        try:
            async for raw_msg in self._ws:
                if not self._running:
                    break
                await self._dispatch(str(raw_msg))
        except websockets.ConnectionClosed as e:
            logger.warning(
                "Polymarket WS connection closed: code=%s reason=%s", e.code, e.reason,
            )
            raise

    async def run_forever(self) -> None:
        """Connect, subscribe, and listen with auto-reconnect."""
        self._running = True
        while self._running:
            try:
                await self.connect()
                # Re-subscribe after reconnect
                if self._subscribed_assets:
                    await self.subscribe_markets(list(self._subscribed_assets))
                await self.listen()
            except (websockets.ConnectionClosed, OSError) as exc:
                if not self._running:
                    break
                logger.warning(
                    "Polymarket WS disconnected (%s), reconnecting in %.1fs",
                    type(exc).__name__, self._reconnect_delay,
                )
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2,
                    self._max_reconnect_delay,
                )
            except Exception:
                if not self._running:
                    break
                logger.exception(
                    "Unexpected Polymarket WS error, reconnecting in %.1fs",
                    self._reconnect_delay,
                )
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2,
                    self._max_reconnect_delay,
                )

    async def close(self) -> None:
        """Gracefully close the WebSocket connection."""
        self._running = False
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
        logger.info("Polymarket WS closed")

    @property
    def is_connected(self) -> bool:
        return self._ws is not None and self._ws.state.name == "OPEN"

    @property
    def subscribed_count(self) -> int:
        return len(self._subscribed_assets)
