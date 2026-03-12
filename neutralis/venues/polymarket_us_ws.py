"""Polymarket US WebSocket client for real-time market data.

Uses the polymarket-us SDK's built-in WS wrapper (Connect protocol / SSE).
Hard limit: 10 instruments per connection.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Callable, Coroutine

from neutralis.logging import get_logger

logger = get_logger(__name__)

MsgHandler = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class PolymarketUSWebSocket:
    """Async WebSocket client for Polymarket US real-time market data.

    Subscribes by market_slug (not asset_id like international).
    Hard limit: 10 instruments max per connection.
    """

    MAX_SUBSCRIPTIONS = 10

    def __init__(
        self,
        key_id: str = "",
        secret_key: str = "",
        reconnect_delay_sec: float = 1.0,
        max_reconnect_delay_sec: float = 60.0,
    ) -> None:
        self._key_id = key_id
        self._secret_key = secret_key
        self._handlers: dict[str, list[MsgHandler]] = {}
        self._subscribed_slugs: set[str] = set()
        self._running = False
        self._reconnect_delay_init = reconnect_delay_sec
        self._reconnect_delay = reconnect_delay_sec
        self._max_reconnect_delay = max_reconnect_delay_sec
        self._ws: Any = None  # SDK's markets WS object
        self._client: Any = None
        self._listen_task: asyncio.Task | None = None

    def on(self, event_type: str, handler: MsgHandler) -> None:
        """Register a handler for a specific event type.

        Supported events: market_data, market_data_lite, trade
        """
        self._handlers.setdefault(event_type, []).append(handler)

    async def connect(self) -> None:
        """Initialize SDK client and connect the markets WS."""
        # macOS Python doesn't include system CA certs — use certifi
        import os
        try:
            import certifi
            os.environ.setdefault("SSL_CERT_FILE", certifi.where())
        except ImportError:
            pass

        from polymarket_us import AsyncPolymarketUS

        if self._key_id and self._secret_key:
            self._client = AsyncPolymarketUS(
                key_id=self._key_id,
                secret_key=self._secret_key,
            )
        else:
            self._client = AsyncPolymarketUS()

        self._ws = self._client.ws.markets()

        # Register handlers on the SDK's event emitter.
        # The SDK calls callbacks synchronously, so wrap async handlers
        # to schedule them on the running event loop.
        loop = asyncio.get_running_loop()
        for event_type, handlers in self._handlers.items():
            for handler in handlers:
                def _make_sync(h: MsgHandler):  # noqa: E306
                    def _sync_wrapper(*args: Any) -> None:
                        loop.create_task(h(*args))
                    return _sync_wrapper
                self._ws.on(event_type, _make_sync(handler))

        await self._ws.connect()
        self._running = True
        self._reconnect_delay = self._reconnect_delay_init
        logger.info("Polymarket US WS connected")

    async def subscribe_markets(self, slugs: list[str]) -> None:
        """Subscribe to market data for specific slugs.

        Enforces the 10-instrument hard limit.
        """
        if not slugs or not self._ws:
            return

        if len(slugs) > self.MAX_SUBSCRIPTIONS:
            logger.warning(
                "Polymarket US WS: requested %d slugs, capping at %d",
                len(slugs), self.MAX_SUBSCRIPTIONS,
            )
            slugs = slugs[:self.MAX_SUBSCRIPTIONS]

        sub_id = f"md-{uuid.uuid4().hex[:8]}"
        await self._ws.subscribe(
            sub_id,
            "SUBSCRIPTION_TYPE_MARKET_DATA",
            slugs,
        )
        self._subscribed_slugs.update(slugs)
        logger.info("Polymarket US WS subscribed to %d slugs", len(slugs))

    async def rotate_subscriptions(self, new_slugs: list[str]) -> None:
        """Replace current subscriptions with new top-priority slugs.

        Since we can only track 10 instruments, this is called periodically
        to rotate the most interesting markets into the WS feed.
        """
        if not self._ws:
            return

        new_slugs = new_slugs[:self.MAX_SUBSCRIPTIONS]
        new_set = set(new_slugs)
        if new_set == self._subscribed_slugs:
            return  # No change needed

        # Disconnect and reconnect with new subscriptions
        # (SDK may not support per-slug unsubscribe — full re-subscribe is safer)
        try:
            await self._ws.close()
        except Exception:
            pass

        self._subscribed_slugs.clear()
        self._ws = self._client.ws.markets()

        # Re-register handlers
        for event_type, handlers in self._handlers.items():
            for handler in handlers:
                self._ws.on(event_type, handler)

        await self._ws.connect()
        await self.subscribe_markets(new_slugs)
        logger.info("Polymarket US WS rotated: %d slugs", len(new_slugs))

    async def run_forever(self) -> None:
        """Connect, subscribe, and listen with auto-reconnect."""
        while self._running:
            try:
                if not self._ws:
                    await self.connect()
                # The SDK handles the listen loop internally via event emitters.
                # We just need to keep the connection alive.
                while self._running:
                    await asyncio.sleep(1.0)
                    # Check if still connected
                    if self._ws is None:
                        break
            except Exception:
                if not self._running:
                    break
                logger.warning(
                    "Polymarket US WS disconnected, reconnecting in %.1fs",
                    self._reconnect_delay,
                    exc_info=True,
                )
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2,
                    self._max_reconnect_delay,
                )
                self._ws = None

    async def close(self) -> None:
        """Gracefully shutdown."""
        self._running = False
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        if self._client:
            try:
                await self._client.close()
            except Exception:
                pass
            self._client = None
        self._subscribed_slugs.clear()
        logger.info("Polymarket US WS closed")

    @property
    def is_connected(self) -> bool:
        return self._ws is not None and self._running

    @property
    def subscribed_count(self) -> int:
        return len(self._subscribed_slugs)

    @property
    def subscribed_slugs(self) -> set[str]:
        return set(self._subscribed_slugs)
