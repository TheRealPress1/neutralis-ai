"""Async event-driven pipeline engine.

Replaces the polling loop with real-time WebSocket-driven arb detection.

Architecture:
    WebSocket ticker msg → update cached prices
        → Fast arb check (<1ms): complement arb + cross-platform discrepancy
        → If arb detected → score → guard → execute (target: <200ms end-to-end)

    Periodic async tasks run alongside:
        - Settlement check (60s)
        - Mark-to-market (30s)
        - Full REST refresh + re-match (300s)
        - Polymarket refresh (120s)
"""

from __future__ import annotations

import asyncio
import math
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Any

import os

import httpx

from neutralis.config import Settings, WebSocketConfig, load_settings, load_settings_with_profile
from neutralis.services.user_credentials import load_active_users
from neutralis.core.cross_scanner import scan_cross_platform
from neutralis.core.matcher import MarketPair, match_markets
from neutralis.core.scanners import scan_complement_arb
from neutralis.core.three_way import group_kalshi_three_way, merge_cross_venue_three_way
from neutralis.core.volume_scanner import check_volume_momentum
from neutralis.core.scoring import score_signal
from neutralis.core.features import compute_market_features, estimate_costs
from neutralis.execution.executor import PaperExecutor
from neutralis.execution.models import TickContext
from neutralis.fees import estimate_total_fee, estimate_cross_platform_fee, estimate_three_way_fee
from neutralis.fees.performance import PerformanceFeeAccruer
from neutralis.guard.constraints import check_daily_loss_limit
from neutralis.guard.decision import evaluate_signal, select_portfolio
from neutralis.logging import get_logger
from neutralis.models import (
    CrossPlatformMatch,
    Decision,
    DecisionVerdict,
    MarketType,
    NormalizedMarket,
    Signal,
    SignalType,
    ThreeWayGroup,
    TradeLeg,
)
from neutralis.portfolio.manager import PortfolioManager
from neutralis.settlement.settler import run_settlement
from neutralis.storage.postgres import PostgresStorage
from neutralis.venues.kalshi_client import KalshiClient
from neutralis.venues.kalshi_normalize import normalize_market as kalshi_normalize
from neutralis.venues.kalshi_ws import KalshiWebSocket
from neutralis.venues.market_cache import MarketCache
from neutralis.venues.polymarket_client import PolymarketClient
from neutralis.venues.polymarket_normalize import normalize_market as poly_normalize, normalize_three_way_market as poly_normalize_three_way
from neutralis.venues.polymarket_ws import PolymarketWebSocket

logger = get_logger("event_engine")

_TRADE_FLOW_WINDOW_SEC = 300.0  # 5-minute sliding window
_SIGNAL_COOLDOWN_SEC = 30.0  # Don't re-fire the same signal within this window
_DISCREPANCY_COOLDOWN_SEC = 10.0  # Max one discrepancy observation per pair per 10s
_DISCREPANCY_FLUSH_INTERVAL_SEC = 30.0  # Flush buffer to DB every 30s


@dataclass
class TradeFlowStats:
    """Sliding-window trade flow stats for a single ticker."""
    ticker: str
    # (monotonic_ts, price_cents, count, taker_side)
    recent_trades: deque = field(default_factory=deque)
    total_volume_5m: int = 0
    buy_volume_5m: int = 0
    sell_volume_5m: int = 0
    last_trade_ts: float = 0.0


@dataclass
class DepthSnapshot:
    """Orderbook depth imbalance for a Polymarket asset."""
    asset_id: str
    bid_depth: float = 0.0  # Total bid-side liquidity ($)
    ask_depth: float = 0.0  # Total ask-side liquidity ($)
    imbalance: float = 0.0  # bid/(bid+ask), >0.5 means more buyers
    updated_ts: float = 0.0


@dataclass
class _LiveState:
    """Mutable state shared across the event engine."""
    # Normalized markets keyed by ticker
    kalshi_markets: dict[str, NormalizedMarket]
    poly_markets: dict[str, NormalizedMarket]
    # Raw Kalshi dicts keyed by ticker (for re-normalization on price update)
    kalshi_raw: dict[str, dict[str, Any]]
    # Cross-platform pairs: kalshi_ticker -> (pair, poly_ticker)
    xp_pairs: dict[str, tuple[MarketPair, str]]
    # Reverse lookup: poly_ticker -> kalshi_ticker
    poly_to_kalshi: dict[str, str]
    # Settings
    settings: Settings
    # 3-way match groups: event_ticker -> ThreeWayGroup (includes cross-venue hybrids)
    three_way_kalshi: dict[str, ThreeWayGroup] = field(default_factory=dict)
    # Reverse lookup: kalshi_ticker -> event_ticker (for WS updates)
    ticker_to_three_way: dict[str, str] = field(default_factory=dict)
    # Polymarket 3-way groups (for cross-venue merge on Kalshi refresh)
    poly_three_way: list[ThreeWayGroup] = field(default_factory=list)
    # Trade flow tracking
    trade_flow: dict[str, TradeFlowStats] = field(default_factory=dict)
    # Polymarket orderbook depth: asset_id -> DepthSnapshot
    poly_depth: dict[str, DepthSnapshot] = field(default_factory=dict)
    # Signal cooldown: ticker -> monotonic timestamp of last signal dispatch
    signal_cooldown: dict[str, float] = field(default_factory=dict)
    # Stale price protection: last price update timestamp per ticker (monotonic)
    last_kalshi_update: dict[str, float] = field(default_factory=dict)
    last_poly_update: dict[str, float] = field(default_factory=dict)
    # Discrepancy analytics buffer
    discrepancy_buffer: list[dict] = field(default_factory=list)
    discrepancy_last_observed: dict[str, float] = field(default_factory=dict)
    discrepancy_total: int = 0
    # Counters
    ticker_updates: int = 0
    arb_checks: int = 0
    signals_detected: int = 0
    signals_skipped_stale: int = 0
    signals_skipped_disconnected: int = 0
    orders_placed: int = 0
    run_number: int = 0


class EventEngine:
    """Async event-driven arbitrage engine.

    On startup:
        1. Full REST fetch of Kalshi + Polymarket markets
        2. Normalize and match cross-platform pairs
        3. Build focus set of tickers to monitor
        4. Subscribe to those tickers on Kalshi WebSocket
        5. Start periodic tasks (settlement, MTM, refresh)

    On each ticker update:
        1. Update cached prices from WS message
        2. Fast complement arb check
        3. Fast cross-platform arb check (if this ticker has a Polymarket match)
        4. If arb → score → guard → execute
    """

    def __init__(
        self,
        settings: Settings,
        kalshi_key_id: str = "",
        kalshi_pem: str = "",
    ) -> None:
        self._settings = settings
        self._ws_cfg = settings.websocket
        self._poly_ws_cfg = settings.polymarket_ws
        self._kalshi_key_id = kalshi_key_id
        self._kalshi_pem = kalshi_pem
        self._ws: KalshiWebSocket | None = None
        self._poly_ws: PolymarketWebSocket | None = None
        self._state: _LiveState | None = None
        self._executor_pool = ThreadPoolExecutor(max_workers=4)
        self._market_cache = MarketCache()
        self._running = False
        self._paused = False
        self._tasks: list[asyncio.Task] = []
        # Polymarket asset_id -> NormalizedMarket mapping (for WS price updates)
        self._asset_id_to_poly: dict[str, NormalizedMarket] = {}
        # poly_ticker -> list of asset_ids (for subscription management)
        self._poly_ticker_to_assets: dict[str, list[str]] = {}
        # Kill-switch: set of user_ids whose kill switch was activated mid-run
        self._killed_user_ids: set[str] = set()
        # Stale price protection: WS connection status flags
        self._kalshi_ws_connected: bool = False
        self._poly_ws_connected: bool = False

    async def start(self) -> None:
        """Initialize state, connect WS, and start all tasks."""
        logger.info("EventEngine starting — building initial state")

        # Step 1: Full REST fetch and normalization (runs in thread pool)
        loop = asyncio.get_event_loop()
        state = await loop.run_in_executor(self._executor_pool, self._build_initial_state)
        self._state = state

        logger.info(
            "Initial state: %d Kalshi, %d Polymarket, %d cross-platform pairs",
            len(state.kalshi_markets), len(state.poly_markets), len(state.xp_pairs),
        )

        # Step 2: Build focus ticker set
        focus_tickers = self._build_focus_tickers(state)
        logger.info("Focus set: %d tickers for WS subscription", len(focus_tickers))

        # Step 3: Connect WebSocket and subscribe
        if self._kalshi_pem:
            self._ws = KalshiWebSocket.from_credentials(
                self._ws_cfg, self._kalshi_key_id, self._kalshi_pem,
            )
        else:
            self._ws = KalshiWebSocket(self._ws_cfg, self._settings.execution)
        self._ws.on("ticker", self._on_ticker)
        self._ws.on("fill", self._on_fill)
        self._ws.on("trade", self._on_trade)
        self._ws.on("market_lifecycle_v2", self._on_lifecycle)

        await self._ws.connect()
        self._kalshi_ws_connected = True

        # If focus set is small, subscribe to ALL tickers for broad coverage
        # (complement arb detection works across the full market)
        if len(focus_tickers) < 100:
            await self._ws.subscribe_ticker()  # All markets
            logger.info("Subscribed to ALL tickers (focus set too small: %d)", len(focus_tickers))
        else:
            batch_size = 500
            ticker_list = list(focus_tickers)
            for i in range(0, len(ticker_list), batch_size):
                batch = ticker_list[i : i + batch_size]
                await self._ws.subscribe_ticker(batch)

        await self._ws.subscribe_fills()
        await self._ws.subscribe_trades()
        await self._ws.subscribe_lifecycle()

        # Step 4: Connect Polymarket WebSocket for real-time cross-platform prices
        self._build_poly_asset_mappings(state)
        if self._poly_ws_cfg.enabled and self._asset_id_to_poly:
            asset_ids = list(self._asset_id_to_poly.keys())
            # Cap subscriptions
            if len(asset_ids) > self._poly_ws_cfg.max_subscriptions:
                asset_ids = asset_ids[: self._poly_ws_cfg.max_subscriptions]
            self._poly_ws = PolymarketWebSocket(
                ws_url=self._poly_ws_cfg.ws_url,
                reconnect_delay_sec=self._poly_ws_cfg.reconnect_delay_sec,
                max_reconnect_delay_sec=self._poly_ws_cfg.max_reconnect_delay_sec,
            )
            self._poly_ws.on("price_change", self._on_poly_price_change)
            self._poly_ws.on("book", self._on_poly_book)
            self._poly_ws.on("last_trade_price", self._on_poly_trade)
            try:
                await self._poly_ws.connect()
                await self._poly_ws.subscribe_markets(asset_ids)
                self._poly_ws_connected = True
                logger.info(
                    "Polymarket WS connected: %d assets subscribed for %d XP pairs",
                    len(asset_ids), len(state.xp_pairs),
                )
            except Exception:
                logger.warning("Failed to connect Polymarket WS, falling back to REST polling", exc_info=True)
                self._poly_ws = None
                self._poly_ws_connected = False

        # Step 5: Start periodic tasks
        self._running = True
        self._paused = False
        self._tasks = [
            asyncio.create_task(self._ws.listen(), name="ws_listen"),
            asyncio.create_task(self._periodic_settlement(), name="settlement"),
            asyncio.create_task(self._periodic_mtm(), name="mtm"),
            asyncio.create_task(self._periodic_refresh(), name="refresh"),
            asyncio.create_task(self._periodic_poly_refresh(), name="poly_refresh"),
            asyncio.create_task(self._periodic_flush_discrepancies(), name="discrepancy_flush"),
            asyncio.create_task(self._periodic_kill_switch_check(), name="kill_switch"),
            asyncio.create_task(self._periodic_daily_loss_check(), name="daily_loss_check"),
        ]
        if self._poly_ws:
            self._tasks.append(
                asyncio.create_task(self._poly_ws.listen(), name="poly_ws_listen")
            )

        logger.info(
            "EventEngine running — %d Kalshi WS subs, %s Poly WS, %d periodic tasks",
            len(focus_tickers),
            f"{self._poly_ws.subscribed_count} assets" if self._poly_ws else "REST-only",
            len(self._tasks) - (2 if self._poly_ws else 1),
        )

    async def run_until_stopped(self) -> None:
        """Run all tasks until shutdown signal."""
        try:
            done, pending = await asyncio.wait(
                self._tasks, return_when=asyncio.FIRST_EXCEPTION,
            )
            for task in done:
                if task.exception():
                    logger.error("Task %s failed: %s", task.get_name(), task.exception())
            # If WS listeners die, restart them
            restarted = False
            for task in done:
                if task.get_name() == "ws_listen" and self._running:
                    logger.warning("Kalshi WS listener died — marking disconnected, restarting")
                    self._kalshi_ws_connected = False
                    # Invalidate all cached Kalshi price timestamps so stale data
                    # is not used before fresh prices arrive after reconnect
                    if self._state:
                        self._state.last_kalshi_update.clear()
                    self._tasks.remove(task)
                    ws_task = asyncio.create_task(
                        self._ws.run_forever(), name="ws_listen",
                    )
                    self._tasks.append(ws_task)
                    restarted = True
                elif task.get_name() == "poly_ws_listen" and self._running and self._poly_ws:
                    logger.warning("Polymarket WS listener died — marking disconnected, restarting")
                    self._poly_ws_connected = False
                    # Invalidate all cached Polymarket price timestamps
                    if self._state:
                        self._state.last_poly_update.clear()
                    self._tasks.remove(task)
                    poly_ws_task = asyncio.create_task(
                        self._poly_ws.run_forever(), name="poly_ws_listen",
                    )
                    self._tasks.append(poly_ws_task)
                    restarted = True
            if restarted:
                await self.run_until_stopped()
                return
        except asyncio.CancelledError:
            pass

    async def stop(self) -> None:
        """Graceful shutdown."""
        self._running = False
        self._kalshi_ws_connected = False
        self._poly_ws_connected = False
        for task in self._tasks:
            task.cancel()
        if self._ws:
            await self._ws.close()
        if self._poly_ws:
            await self._poly_ws.close()
        self._executor_pool.shutdown(wait=False)
        logger.info(
            "EventEngine stopped — %d ticker updates, %d arb checks, %d signals, %d orders",
            self._state.ticker_updates if self._state else 0,
            self._state.arb_checks if self._state else 0,
            self._state.signals_detected if self._state else 0,
            self._state.orders_placed if self._state else 0,
        )

    # ── Initial state ──────────────────────────────────────────────────

    def _build_initial_state(self) -> _LiveState:
        """Synchronous: fetch all markets, normalize, match. Runs in thread pool."""
        settings = load_settings()

        # Fetch Kalshi via targeted series fetch — much faster than paginating 50k+ markets.
        # The general get_all_active_markets() caps at 50 pages (50k) but Kalshi has >50k
        # active markets. Tournament winner markets (soccer, politics) that overlap with
        # Polymarket are buried beyond page 50, so targeted series fetch is the only
        # reliable way to include them.
        filter_cfg = settings.market_filter
        with KalshiClient(settings.kalshi) as client:
            all_raw = client.fetch_priority_series(filter_cfg.priority_series)
        self._market_cache.update_bulk(all_raw)
        self._market_cache.mark_full_refresh()

        kalshi_raw = {m["ticker"]: m for m in all_raw if m.get("ticker")}
        kalshi_markets: dict[str, NormalizedMarket] = {}
        for raw in all_raw:
            nm = kalshi_normalize(raw)
            if nm and nm.market_type == MarketType.BINARY:
                kalshi_markets[nm.ticker] = nm

        # Fetch Polymarket
        with PolymarketClient(settings.polymarket) as client:
            raw_poly = client.get_all_active_markets()
        poly_markets: dict[str, NormalizedMarket] = {}
        for raw in raw_poly:
            nm = poly_normalize(raw)
            if nm and nm.market_type == MarketType.BINARY:
                poly_markets[nm.ticker] = nm

        # Match cross-platform
        pairs = match_markets(
            list(kalshi_markets.values()),
            list(poly_markets.values()),
            settings.matching,
        )
        xp_pairs: dict[str, tuple[MarketPair, str]] = {}
        poly_to_kalshi: dict[str, str] = {}
        for pair in pairs:
            xp_pairs[pair.kalshi_market.ticker] = (pair, pair.polymarket_market.ticker)
            poly_to_kalshi[pair.polymarket_market.ticker] = pair.kalshi_market.ticker

        # Group 3-way match markets (single-venue + cross-venue)
        three_way_groups = group_kalshi_three_way(kalshi_markets)
        poly_three_way = [g for g in (poly_normalize_three_way(raw) for raw in raw_poly) if g is not None]
        xv_three_way = merge_cross_venue_three_way(three_way_groups, poly_three_way)
        all_three_way = three_way_groups + xv_three_way

        three_way_kalshi: dict[str, ThreeWayGroup] = {}
        ticker_to_three_way: dict[str, str] = {}
        for g in all_three_way:
            three_way_kalshi[g.event_id] = g
            for oc in g.outcomes:
                if oc.venue == "kalshi":  # Only Kalshi tickers trigger WS updates
                    ticker_to_three_way[oc.ticker] = g.event_id

        logger.info(
            "State built: %d Kalshi, %d Polymarket, %d pairs, %d 3-way matches (%d cross-venue)",
            len(kalshi_markets), len(poly_markets), len(pairs),
            len(three_way_kalshi), len(xv_three_way),
        )

        return _LiveState(
            kalshi_markets=kalshi_markets,
            poly_markets=poly_markets,
            kalshi_raw=kalshi_raw,
            xp_pairs=xp_pairs,
            poly_to_kalshi=poly_to_kalshi,
            settings=settings,
            three_way_kalshi=three_way_kalshi,
            ticker_to_three_way=ticker_to_three_way,
            poly_three_way=poly_three_way,
        )

    def _build_focus_tickers(self, state: _LiveState) -> set[str]:
        """Determine which Kalshi tickers to monitor on WebSocket.

        Focus on:
        1. All tickers with Polymarket counterparts (cross-platform arb candidates)
        2. Tickers where complement arb is close (yes_ask + no_ask < 1.02)
        3. Cap at max_ws_subscriptions
        """
        focus = set()

        # All cross-platform matched tickers (highest priority)
        focus.update(state.xp_pairs.keys())

        # All 3-way match tickers
        focus.update(state.ticker_to_three_way.keys())

        # Near-complement-arb tickers
        for ticker, nm in state.kalshi_markets.items():
            if nm.yes_ask > 0 and nm.no_ask > 0:
                combined = nm.yes_ask + nm.no_ask
                if combined < 1.02:  # Within 2% of arb threshold
                    focus.add(ticker)

        # Cap
        max_subs = self._ws_cfg.max_ws_subscriptions
        if len(focus) > max_subs:
            # Prioritize cross-platform pairs
            xp_tickers = set(state.xp_pairs.keys())
            complement_only = focus - xp_tickers
            # Keep all xp, trim complement
            remaining = max_subs - len(xp_tickers)
            if remaining > 0:
                focus = xp_tickers | set(list(complement_only)[:remaining])
            else:
                focus = set(list(xp_tickers)[:max_subs])

        return focus

    def _build_poly_asset_mappings(self, state: _LiveState) -> None:
        """Build asset_id -> NormalizedMarket mappings for Polymarket WS.

        Only maps assets for markets that have cross-platform Kalshi counterparts.
        """
        self._asset_id_to_poly.clear()
        self._poly_ticker_to_assets.clear()

        for kalshi_ticker, (pair, poly_ticker) in state.xp_pairs.items():
            pm = pair.polymarket_market
            if pm.clob_token_ids:
                asset_list = list(pm.clob_token_ids)
                self._poly_ticker_to_assets[pm.ticker] = asset_list
                for asset_id in asset_list:
                    self._asset_id_to_poly[asset_id] = pm

        logger.info(
            "Polymarket asset mappings: %d assets across %d paired markets",
            len(self._asset_id_to_poly), len(self._poly_ticker_to_assets),
        )

    # ── WebSocket message handlers ─────────────────────────────────────

    async def _on_ticker(self, msg: dict[str, Any]) -> None:
        """Handle a ticker price update.

        WS message includes both cents (yes_bid, yes_ask) and dollar strings
        (yes_bid_dollars, yes_ask_dollars). We use dollar strings for precision.
        """
        state = self._state
        if state is None:
            return

        ticker = msg.get("market_ticker", "")
        if not ticker:
            return

        state.ticker_updates += 1

        # Mark Kalshi WS as connected (receives data = connected)
        if not self._kalshi_ws_connected:
            self._kalshi_ws_connected = True
            logger.info("Kalshi WS reconnected — receiving price data again")

        nm = state.kalshi_markets.get(ticker)
        if nm is None:
            return

        # Record timestamp for stale price protection
        state.last_kalshi_update[ticker] = time.monotonic()

        # Use dollar string fields (e.g. "0.7600") — more precise than cents
        yes_bid_str = msg.get("yes_bid_dollars")
        yes_ask_str = msg.get("yes_ask_dollars")

        yes_bid = float(yes_bid_str) if yes_bid_str else nm.yes_bid
        yes_ask = float(yes_ask_str) if yes_ask_str else nm.yes_ask

        # Derive no prices: no_bid = 1 - yes_ask, no_ask = 1 - yes_bid
        no_bid = round(1.0 - yes_ask, 4) if yes_ask > 0 else nm.no_bid
        no_ask = round(1.0 - yes_bid, 4) if yes_bid > 0 else nm.no_ask

        updated = replace(nm, yes_bid=yes_bid, yes_ask=yes_ask, no_bid=no_bid, no_ask=no_ask)
        state.kalshi_markets[ticker] = updated

        # Update raw dict for REST-refresh consistency
        raw = state.kalshi_raw.get(ticker)
        if raw:
            if yes_bid_str:
                raw["yes_bid_dollars"] = yes_bid_str
            if yes_ask_str:
                raw["yes_ask_dollars"] = yes_ask_str
            raw["no_bid_dollars"] = f"{no_bid:.4f}"
            raw["no_ask_dollars"] = f"{no_ask:.4f}"

        # Fast arb checks
        await self._fast_arb_check(ticker, updated, trigger_source="kalshi_ws")

    async def _on_fill(self, msg: dict[str, Any]) -> None:
        """Handle a fill notification from Kalshi."""
        logger.info(
            "Fill: ticker=%s side=%s count=%s price=%s",
            msg.get("ticker"), msg.get("side"),
            msg.get("count"), msg.get("yes_price") or msg.get("no_price"),
        )

    async def _on_trade(self, msg: dict[str, Any]) -> None:
        """Handle public trade notification — track per-ticker volume and flow."""
        state = self._state
        if state is None:
            return

        ticker = msg.get("market_ticker", "")
        if not ticker:
            return

        count = msg.get("count", 0)
        if not count:
            return

        side = msg.get("taker_side", "")
        price = msg.get("yes_price", 0)
        ts = time.monotonic()

        stats = state.trade_flow.get(ticker)
        if stats is None:
            stats = TradeFlowStats(ticker=ticker)
            state.trade_flow[ticker] = stats

        stats.recent_trades.append((ts, price, count, side))
        stats.total_volume_5m += count
        if side == "yes":
            stats.buy_volume_5m += count
        elif side == "no":
            stats.sell_volume_5m += count
        stats.last_trade_ts = ts

        # Prune trades older than 5 minutes
        cutoff = ts - _TRADE_FLOW_WINDOW_SEC
        while stats.recent_trades and stats.recent_trades[0][0] < cutoff:
            old_ts, _old_p, old_count, old_side = stats.recent_trades.popleft()
            stats.total_volume_5m -= old_count
            if old_side == "yes":
                stats.buy_volume_5m -= old_count
            elif old_side == "no":
                stats.sell_volume_5m -= old_count

    async def _on_lifecycle(self, msg: dict[str, Any]) -> None:
        """Handle market lifecycle events — remove settled/closed markets from state."""
        state = self._state
        if state is None:
            return

        ticker = msg.get("market_ticker", "")
        new_status = msg.get("status", "")
        if not ticker:
            return

        if new_status in ("closed", "determined", "finalized"):
            # Remove from live state
            removed_market = state.kalshi_markets.pop(ticker, None)
            state.kalshi_raw.pop(ticker, None)
            state.trade_flow.pop(ticker, None)
            state.last_kalshi_update.pop(ticker, None)

            # Remove from cross-platform pairs
            pair_info = state.xp_pairs.pop(ticker, None)
            if pair_info:
                _, poly_ticker = pair_info
                state.poly_to_kalshi.pop(poly_ticker, None)
                state.last_poly_update.pop(poly_ticker, None)

            # Remove from market cache
            self._market_cache.remove(ticker)

            # Unsubscribe from WS ticker channel to free subscription slot
            if self._ws and ticker in self._ws._subscribed_tickers:
                try:
                    await self._ws.update_subscription("ticker", remove_tickers=[ticker])
                except Exception:
                    logger.debug("Failed to unsubscribe settled ticker %s", ticker)

            logger.info(
                "Lifecycle: %s -> %s (removed from state%s)",
                ticker, new_status,
                ", was XP-paired" if pair_info else "",
            )

    # ── Polymarket WebSocket handlers ──────────────────────────────────

    async def _on_poly_price_change(self, msg: dict[str, Any]) -> None:
        """Handle Polymarket CLOB price update — update cached prices and trigger arb check.

        Message format:
            {"event_type": "price_change", "market": "0x...",
             "price_changes": [{"asset_id": "...", "best_bid": "0.55", "best_ask": "0.57", ...}],
             "timestamp": ...}
        """
        state = self._state
        if state is None:
            return

        # Mark Polymarket WS as connected (receives data = connected)
        if not self._poly_ws_connected:
            self._poly_ws_connected = True
            logger.info("Polymarket WS reconnected — receiving price data again")

        price_changes = msg.get("price_changes", [])
        for pc in price_changes:
            asset_id = pc.get("asset_id", "")
            if not asset_id:
                continue

            nm = self._asset_id_to_poly.get(asset_id)
            if nm is None:
                continue

            best_bid_str = pc.get("best_bid")
            best_ask_str = pc.get("best_ask")

            if not best_bid_str or not best_ask_str:
                continue

            try:
                best_bid = float(best_bid_str)
                best_ask = float(best_ask_str)
            except (ValueError, TypeError):
                continue

            if best_bid <= 0 or best_ask <= 0 or best_ask >= 1.0:
                continue

            # Update the cached Polymarket market with fresh bid/ask
            updated = replace(
                nm,
                yes_bid=best_bid,
                yes_ask=best_ask,
                no_bid=round(1.0 - best_ask, 4),
                no_ask=round(1.0 - best_bid, 4),
            )
            state.poly_markets[nm.ticker] = updated
            self._asset_id_to_poly[asset_id] = updated

            # Record timestamp for stale price protection
            state.last_poly_update[nm.ticker] = time.monotonic()

            # Trigger cross-platform arb check on the Kalshi side
            kalshi_ticker = state.poly_to_kalshi.get(nm.ticker)
            if kalshi_ticker:
                kalshi_market = state.kalshi_markets.get(kalshi_ticker)
                if kalshi_market:
                    await self._fast_arb_check(kalshi_ticker, kalshi_market, trigger_source="poly_ws")

    async def _on_poly_book(self, msg: dict[str, Any]) -> None:
        """Handle Polymarket orderbook snapshot — track depth imbalance.

        Message format:
            {"event_type": "book", "market": "0x...", "asset_id": "...",
             "buys": [{"price": "0.55", "size": "100"}, ...],
             "sells": [{"price": "0.57", "size": "80"}, ...],
             "timestamp": ...}

        Depth imbalance (bid_depth >> ask_depth) suggests underpricing.
        Cross-reference with Kalshi price for confirmation.
        """
        state = self._state
        if state is None:
            return

        asset_id = msg.get("asset_id", "")
        if not asset_id:
            return

        nm = self._asset_id_to_poly.get(asset_id)
        if nm is None:
            return

        # Sum bid and ask depth in dollars
        buys = msg.get("buys") or []
        sells = msg.get("sells") or []

        bid_depth = 0.0
        for level in buys:
            try:
                price = float(level.get("price", 0))
                size = float(level.get("size", 0))
                bid_depth += price * size
            except (ValueError, TypeError):
                continue

        ask_depth = 0.0
        for level in sells:
            try:
                price = float(level.get("price", 0))
                size = float(level.get("size", 0))
                ask_depth += price * size
            except (ValueError, TypeError):
                continue

        total = bid_depth + ask_depth
        if total < 10.0:  # Skip illiquid books
            return

        imbalance = bid_depth / total  # >0.5 means more buyers

        snap = DepthSnapshot(
            asset_id=asset_id,
            bid_depth=bid_depth,
            ask_depth=ask_depth,
            imbalance=imbalance,
            updated_ts=time.monotonic(),
        )
        state.poly_depth[asset_id] = snap

        # Strong imbalance: >70% on one side suggests directional pressure
        if imbalance >= 0.70 or imbalance <= 0.30:
            # Cross-reference with Kalshi counterpart
            kalshi_ticker = state.poly_to_kalshi.get(nm.ticker)
            if kalshi_ticker:
                kalshi_market = state.kalshi_markets.get(kalshi_ticker)
                if kalshi_market:
                    direction = "YES" if imbalance >= 0.70 else "NO"
                    logger.info(
                        "Poly depth imbalance: %s bid=$%.0f ask=$%.0f imb=%.1f%% → %s pressure (Kalshi %s)",
                        nm.ticker[:30], bid_depth, ask_depth, imbalance * 100,
                        direction, kalshi_ticker,
                    )
                    # Trigger arb check on Kalshi side (may find XP arb)
                    await self._fast_arb_check(kalshi_ticker, kalshi_market, trigger_source="poly_book")

    async def _on_poly_trade(self, msg: dict[str, Any]) -> None:
        """Handle Polymarket last_trade_price — detect informed flow that Kalshi hasn't priced in.

        When a large Polymarket trade moves the YES price significantly, check if
        Kalshi's YES price has adjusted. If Kalshi is lagging, the price difference
        creates a directional edge.

        Academic basis: Ng et al. (SSRN, Jan 2026) — Polymarket leads Kalshi in
        price discovery. Large-trade order imbalance predicts subsequent returns.
        """
        state = self._state
        if state is None:
            return

        asset_id = msg.get("asset_id", "")
        if not asset_id:
            return

        nm = self._asset_id_to_poly.get(asset_id)
        if nm is None:
            return

        try:
            trade_price = float(msg.get("price", 0))
            trade_size = float(msg.get("size", 0))
        except (ValueError, TypeError):
            return

        if trade_price <= 0 or trade_size < 100:  # Min 100 contracts to be "large"
            return

        # Check if Poly trade price diverges from cached Poly market price
        cached_yes = nm.yes_ask
        if cached_yes <= 0:
            return

        price_move = trade_price - cached_yes
        if abs(price_move) < 0.02:  # Less than 2 cents — not significant
            return

        # Check Kalshi counterpart for lag
        kalshi_ticker = state.poly_to_kalshi.get(nm.ticker)
        if not kalshi_ticker:
            return
        kalshi_market = state.kalshi_markets.get(kalshi_ticker)
        if not kalshi_market or kalshi_market.yes_ask <= 0:
            return

        # Kalshi is "lagging" if its price hasn't moved in the same direction
        # as the Polymarket trade
        kalshi_yes = kalshi_market.yes_ask
        lag = trade_price - kalshi_yes  # Positive = Poly higher, Kalshi cheap

        if abs(lag) < 0.02:  # Kalshi already adjusted — no edge
            return

        # Signal: Polymarket informed flow detected, Kalshi lagging
        if not self._signal_on_cooldown(state, kalshi_ticker, "informed_flow"):
            direction = "YES" if lag > 0 else "NO"
            logger.info(
                "Informed flow: %s Poly trade %d@%.4f (move=%.4f) → Kalshi %s lag=%.4f → buy %s",
                nm.ticker[:30], int(trade_size), trade_price,
                price_move, kalshi_ticker, lag, direction,
            )
            # Trigger arb check which will find the cross-platform discrepancy
            await self._fast_arb_check(kalshi_ticker, kalshi_market, trigger_source="poly_informed_flow")

    # ── Fast arb detection ─────────────────────────────────────────────

    def _signal_on_cooldown(self, state: _LiveState, ticker: str, signal_type: str) -> bool:
        """Check if a signal for this ticker was recently dispatched.

        Returns True if the signal should be suppressed (still in cooldown).
        Checks both per-type cooldown AND cross-type ticker cooldown to prevent
        the same ticker from triggering signals from multiple scanners.
        """
        now = time.monotonic()

        # Cross-type ticker cooldown — prevents double-trades on same ticker
        ticker_key = f"_any_:{ticker}"
        ticker_last = state.signal_cooldown.get(ticker_key, 0.0)
        if now - ticker_last < _SIGNAL_COOLDOWN_SEC:
            return True

        # Per-type cooldown
        key = f"{signal_type}:{ticker}"
        last = state.signal_cooldown.get(key, 0.0)
        if now - last < _SIGNAL_COOLDOWN_SEC:
            return True

        state.signal_cooldown[key] = now
        state.signal_cooldown[ticker_key] = now
        return False

    async def _fast_arb_check(
        self, ticker: str, market: NormalizedMarket,
        trigger_source: str = "kalshi_ws",
    ) -> None:
        """Ultra-fast arb check triggered by every ticker update.

        Two checks in <1ms:
        1. Complement arb: yes_ask + no_ask < 1.0 (minus fees)
        2. Cross-platform: compare vs stored Polymarket price

        If either triggers, dispatch to the execution pipeline (runs in thread pool).
        Signals are deduplicated per ticker with a 30s cooldown.
        """
        state = self._state
        if state is None:
            return

        # Skip all signal generation when paused (kill switch set to "paused")
        if self._paused:
            return

        # ── Stale price protection: refuse to fire signals while WS is disconnected ──
        if not self._kalshi_ws_connected:
            state.signals_skipped_disconnected += 1
            return

        state.arb_checks += 1
        cfg = state.settings.pipeline
        max_age = state.settings.websocket.max_price_age_sec

        # Skip expired markets (close_time in the past)
        exp = market.expected_expiration or market.close_time
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                return

        # ── Stale price guard: skip if Kalshi price data is too old ──
        now_mono = time.monotonic()
        kalshi_ts = state.last_kalshi_update.get(ticker, 0.0)
        if kalshi_ts > 0 and (now_mono - kalshi_ts) > max_age:
            state.signals_skipped_stale += 1
            if state.signals_skipped_stale % 100 == 1:  # Log periodically, not every skip
                logger.warning(
                    "Stale price guard: Kalshi ticker %s last update %.1fs ago (max=%.1fs) — skipping arb check",
                    ticker, now_mono - kalshi_ts, max_age,
                )
            return

        # ── Check 1: Complement arb ──
        slippage_2 = cfg.slippage_per_leg * 2  # two-leg buffer
        if market.yes_ask > 0 and market.no_ask > 0:
            combined = market.yes_ask + market.no_ask
            if combined < 1.0:
                use_maker = state.settings.execution.use_maker_orders
                fee = estimate_total_fee(market.yes_ask, market.no_ask, venue="kalshi", maker=use_maker)
                net_edge = (1.0 - combined) - fee - slippage_2
                if net_edge > 0:
                    edge_pct = (net_edge / combined) * 100.0
                    if edge_pct >= cfg.min_edge_pct:
                        if not self._signal_on_cooldown(state, ticker, "complement"):
                            logger.info(
                                "RT complement arb: %s yes=%.4f no=%.4f edge=%.2f%%",
                                ticker, market.yes_ask, market.no_ask, edge_pct,
                            )
                            state.signals_detected += 1
                            loop = asyncio.get_event_loop()
                            loop.run_in_executor(
                                self._executor_pool,
                                self._execute_complement_arb,
                                ticker, market, net_edge, edge_pct,
                            )

        # ── Check 2: Cross-platform arb ──
        pair_info = state.xp_pairs.get(ticker)
        xp_stale = False
        if pair_info:
            pair, poly_ticker = pair_info
            poly_market = state.poly_markets.get(poly_ticker)
            if poly_market and poly_market.yes_ask > 0:
                # Stale Polymarket price guard: skip XP arb if Poly price is too old
                poly_ts = state.last_poly_update.get(poly_ticker, 0.0)
                if poly_ts > 0 and (now_mono - poly_ts) > max_age:
                    xp_stale = True
                    state.signals_skipped_stale += 1
                    if state.signals_skipped_stale % 100 == 1:
                        logger.warning(
                            "Stale price guard: Poly ticker %s last update %.1fs ago (max=%.1fs) — skipping XP arb",
                            poly_ticker, now_mono - poly_ts, max_age,
                        )
                # Also skip XP if Polymarket WS is disconnected
                if not self._poly_ws_connected and self._poly_ws is not None:
                    xp_stale = True
                    state.signals_skipped_disconnected += 1

                k_yes = market.yes_ask
                p_yes = poly_market.yes_ask

                if not xp_stale and k_yes > 0 and p_yes > 0 and abs(k_yes - p_yes) > 0.01:
                    # Determine arb direction
                    if k_yes < p_yes:
                        favored_yes = k_yes
                        other_no = poly_market.no_ask
                        yes_venue, no_venue = "kalshi", "polymarket"
                    else:
                        favored_yes = p_yes
                        other_no = market.no_ask
                        yes_venue, no_venue = "polymarket", "kalshi"

                    if other_no > 0:
                        combined = favored_yes + other_no
                        gross_edge = 1.0 - combined
                        use_maker = state.settings.execution.use_maker_orders
                        fee = estimate_cross_platform_fee(
                            yes_price=favored_yes, yes_venue=yes_venue,
                            no_price=other_no, no_venue=no_venue,
                            maker=use_maker,
                        )
                        net_edge = gross_edge - fee - slippage_2
                        edge_pct = (net_edge / combined) * 100.0 if combined > 0 else 0.0

                        # Record discrepancy observation (rate-limited per pair)
                        now = time.monotonic()
                        obs_key = f"disc:{ticker}"
                        last_obs = state.discrepancy_last_observed.get(obs_key, 0.0)
                        if now - last_obs >= _DISCREPANCY_COOLDOWN_SEC:
                            state.discrepancy_last_observed[obs_key] = now
                            k_mid = (market.yes_bid + market.yes_ask) / 2.0
                            p_mid = (poly_market.yes_bid + poly_market.yes_ask) / 2.0
                            state.discrepancy_buffer.append({
                                "kalshi_ticker": ticker,
                                "poly_ticker": poly_ticker,
                                "kalshi_yes_bid": market.yes_bid,
                                "kalshi_yes_ask": market.yes_ask,
                                "poly_yes_bid": poly_market.yes_bid,
                                "poly_yes_ask": poly_market.yes_ask,
                                "mid_discrepancy": round(abs(k_mid - p_mid), 6),
                                "gross_edge": round(gross_edge, 6),
                                "net_edge": round(net_edge, 6),
                                "edge_pct": round(edge_pct, 4),
                                "favored_venue": yes_venue,
                                "match_confidence": pair.similarity,
                                "trigger_source": trigger_source,
                                "actionable": net_edge > 0 and edge_pct >= cfg.min_xp_edge_pct,
                            })
                            state.discrepancy_total += 1

                        # Only dispatch signal if actionable
                        if net_edge > 0 and edge_pct >= cfg.min_xp_edge_pct:
                            if not self._signal_on_cooldown(state, ticker, "xp"):
                                logger.info(
                                    "RT cross-platform arb: %s K=%.4f P=%.4f edge=%.2f%% (buy YES on %s)",
                                    ticker, k_yes, p_yes, edge_pct, yes_venue,
                                )
                                state.signals_detected += 1
                                loop = asyncio.get_event_loop()
                                loop.run_in_executor(
                                    self._executor_pool,
                                    self._execute_xp_arb,
                                    ticker, market, poly_market,
                                    pair.similarity, net_edge, edge_pct,
                                    yes_venue, no_venue,
                                )

        # ── Check 3: Three-way (Dutch book) arb ──
        event_id = state.ticker_to_three_way.get(ticker)
        if event_id:
            group = state.three_way_kalshi.get(event_id)
            if group:
                # Update the outcome price that changed
                updated_outcomes = []
                for oc in group.outcomes:
                    if oc.ticker == ticker:
                        updated_outcomes.append(replace(oc, ask=market.yes_ask, bid=market.yes_bid))
                    else:
                        updated_outcomes.append(oc)

                # Rebuild group with updated prices
                group = replace(
                    group,
                    outcome_a=updated_outcomes[0],
                    outcome_b=updated_outcomes[1],
                    outcome_draw=updated_outcomes[2],
                )
                state.three_way_kalshi[event_id] = group

                combined = group.combined_ask
                if combined < 1.0 and all(oc.ask > 0 for oc in group.outcomes):
                    gross_edge = 1.0 - combined
                    use_maker = state.settings.execution.use_maker_orders
                    prices = tuple(oc.ask for oc in group.outcomes)
                    venues = tuple(oc.venue for oc in group.outcomes)
                    fee = estimate_three_way_fee(prices, venues, maker=use_maker)
                    slippage_3 = cfg.slippage_per_leg * 3  # three legs
                    net_edge = gross_edge - fee - slippage_3
                    if net_edge > 0:
                        edge_pct_3w = (net_edge / combined) * 100.0
                        if edge_pct_3w >= cfg.min_edge_pct:
                            if not self._signal_on_cooldown(state, event_id, "three_way"):
                                logger.info(
                                    "RT 3-way arb: %s A=%.4f B=%.4f D=%.4f combined=%.4f edge=%.2f%%",
                                    event_id,
                                    group.outcome_a.ask, group.outcome_b.ask,
                                    group.outcome_draw.ask, combined, edge_pct_3w,
                                )
                                state.signals_detected += 1
                                loop = asyncio.get_event_loop()
                                loop.run_in_executor(
                                    self._executor_pool,
                                    self._execute_three_way_arb,
                                    group, net_edge, edge_pct_3w,
                                )

        # ── Check 4: Volume momentum ──
        flow = state.trade_flow.get(ticker)
        if flow and flow.total_volume_5m >= 20:
            if not self._signal_on_cooldown(state, ticker, "volume"):
                # Look up Polymarket depth for this ticker (if matched)
                d_bid, d_ask = 0.0, 0.0
                xp_entry = state.xp_pairs.get(ticker)
                if xp_entry:
                    poly_ticker = xp_entry[1]
                    poly_market = state.poly_markets.get(poly_ticker)
                    if poly_market and poly_market.clob_token_ids:
                        depth = state.poly_depth.get(poly_market.clob_token_ids[0])
                        if depth:
                            d_bid, d_ask = depth.bid_depth, depth.ask_depth

                vol_signal = check_volume_momentum(
                    ticker, market,
                    buy_volume=flow.buy_volume_5m,
                    sell_volume=flow.sell_volume_5m,
                    total_volume=flow.total_volume_5m,
                    config=cfg,
                    depth_bid=d_bid,
                    depth_ask=d_ask,
                )
                if vol_signal is not None:
                    state.signals_detected += 1
                    loop = asyncio.get_event_loop()
                    loop.run_in_executor(
                        self._executor_pool,
                        self._execute_volume_momentum,
                        ticker, market, vol_signal,
                    )

    # ── Execution (runs in thread pool) ────────────────────────────────

    def _execute_complement_arb(
        self, ticker: str, market: NormalizedMarket,
        net_edge: float, edge_pct: float,
    ) -> None:
        """Score, guard-check, and execute a complement arb signal. Runs sync in thread pool."""
        state = self._state
        if state is None:
            return

        settings = state.settings
        cfg = settings.pipeline

        legs = (
            TradeLeg(
                ticker=ticker, side="yes",
                price_dollars=market.yes_ask,
                quantity_dollars=min(cfg.max_position_dollars, market.liquidity / 2),
            ),
            TradeLeg(
                ticker=ticker, side="no",
                price_dollars=market.no_ask,
                quantity_dollars=min(cfg.max_position_dollars, market.liquidity / 2),
            ),
        )

        signal = Signal(
            signal_type=SignalType.COMPLEMENT_ARB,
            ticker=ticker,
            event_ticker=market.event_ticker,
            yes_ask=market.yes_ask,
            no_ask=market.no_ask,
            combined_cost=round(market.yes_ask + market.no_ask, 6),
            gross_edge=round(1.0 - market.yes_ask - market.no_ask, 6),
            net_edge=round(net_edge, 6),
            edge_pct=round(edge_pct, 4),
            legs=legs,
            market_snapshot=market,
        )

        self._score_and_execute(signal, market, settings)

    def _execute_three_way_arb(
        self, group: ThreeWayGroup, net_edge: float, edge_pct: float,
    ) -> None:
        """Score, guard-check, and execute a 3-way Dutch book arb. Runs sync in thread pool."""
        state = self._state
        if state is None:
            return

        settings = state.settings
        cfg = settings.pipeline

        legs = tuple(
            TradeLeg(
                ticker=oc.ticker,
                side="yes",
                price_dollars=oc.ask,
                quantity_dollars=min(cfg.max_position_dollars, group.liquidity / 3),
                venue=oc.venue,
            )
            for oc in group.outcomes
        )

        # Use the first team market as the snapshot for guard evaluation
        market = state.kalshi_markets.get(group.outcome_a.ticker)
        if market is None:
            return

        signal = Signal(
            signal_type=SignalType.THREE_WAY_ARB,
            ticker=group.event_id,
            event_ticker=group.event_id,
            yes_ask=group.outcome_a.ask,
            no_ask=group.outcome_b.ask,
            combined_cost=round(group.combined_ask, 6),
            gross_edge=round(1.0 - group.combined_ask, 6),
            net_edge=round(net_edge, 6),
            edge_pct=round(edge_pct, 4),
            legs=legs,
            market_snapshot=market,
        )

        self._score_and_execute(signal, market, settings)

    def _execute_volume_momentum(
        self, ticker: str, market: NormalizedMarket, vol_signal: Signal,
    ) -> None:
        """Score, guard-check, and execute a volume momentum signal. Runs sync in thread pool."""
        state = self._state
        if state is None:
            return
        self._score_and_execute(vol_signal, market, state.settings)

    def _execute_xp_arb(
        self, ticker: str, k_market: NormalizedMarket, p_market: NormalizedMarket,
        match_confidence: float, net_edge: float, edge_pct: float,
        yes_venue: str, no_venue: str,
    ) -> None:
        """Score, guard-check, and execute a cross-platform arb signal."""
        state = self._state
        if state is None:
            return

        settings = state.settings

        if yes_venue == "kalshi":
            favored_yes = k_market.yes_ask
            other_no = p_market.no_ask
            yes_ticker, no_ticker = k_market.ticker, p_market.ticker
        else:
            favored_yes = p_market.yes_ask
            other_no = k_market.no_ask
            yes_ticker, no_ticker = p_market.ticker, k_market.ticker

        combined = favored_yes + other_no

        xp_match = CrossPlatformMatch(
            kalshi_ticker=k_market.ticker,
            kalshi_title=k_market.title,
            kalshi_yes_ask=k_market.yes_ask,
            kalshi_no_ask=k_market.no_ask,
            polymarket_id=p_market.ticker,
            polymarket_question=p_market.title,
            polymarket_yes_price=p_market.yes_ask,
            polymarket_no_price=p_market.no_ask,
            match_confidence=match_confidence,
            price_discrepancy_pct=round(abs(k_market.yes_ask - p_market.yes_ask) / min(k_market.yes_ask, p_market.yes_ask) * 100, 4),
            favored_venue=yes_venue,
        )

        legs = (
            TradeLeg(
                ticker=yes_ticker, side="yes",
                price_dollars=favored_yes,
                quantity_dollars=favored_yes,
                venue=yes_venue,
            ),
            TradeLeg(
                ticker=no_ticker, side="no",
                price_dollars=other_no,
                quantity_dollars=other_no,
                venue=no_venue,
            ),
        )

        signal = Signal(
            signal_type=SignalType.CROSS_PLATFORM_DISCREPANCY,
            ticker=k_market.ticker,
            event_ticker=k_market.event_ticker,
            yes_ask=k_market.yes_ask,
            no_ask=k_market.no_ask,
            combined_cost=round(combined, 6),
            gross_edge=round(1.0 - combined, 6),
            net_edge=round(net_edge, 6),
            edge_pct=round(edge_pct, 4),
            legs=legs,
            market_snapshot=k_market,
            cross_platform=xp_match,
        )

        self._score_and_execute(signal, k_market, settings, match_score=match_confidence)

    def _score_and_execute(
        self, signal: Signal, market: NormalizedMarket, settings: Settings,
        match_score: float | None = None,
    ) -> None:
        """Score a signal through the guard and execute if PASS. Runs sync."""
        state = self._state
        if state is None:
            return

        try:
            with PostgresStorage(settings.db) as storage:
                fee_accruer = None
                _user_id = os.environ.get("NEUTRALIS_USER_ID")
                if settings.performance_fees.enabled and _user_id:
                    fee_accruer = PerformanceFeeAccruer(
                        storage, settings.performance_fees, user_id=_user_id,
                    )
                portfolio = PortfolioManager(
                    storage, settings.portfolio, fee_accruer=fee_accruer,
                )
                portfolio_snapshot = portfolio.get_snapshot()

                # Score
                recent = storage.get_recent_snapshots_for_ticker(market.ticker, limit=10)
                features = compute_market_features(market, recent_snapshots=recent)
                costs = estimate_costs(signal, market)
                result = score_signal(signal, features, costs, match_score=match_score)

                scored = replace(
                    signal,
                    confidence_score=result["confidence_score"],
                    time_to_resolution_days=result["time_to_resolution_days"],
                    roi_per_day=result["roi_per_day"],
                    net_edge=result["net_edge"],
                    features_json=result,
                )

                # Guard
                snap_id = storage.save_market_snapshot(market)
                storage.save_signal(scored, snapshot_id=snap_id)

                decision = evaluate_signal(
                    scored, market, settings.pipeline,
                    portfolio_snapshot=portfolio_snapshot,
                    portfolio_config=settings.portfolio,
                )

                if decision.verdict != DecisionVerdict.PASS:
                    storage.save_decision(decision)
                    return

                # Ranked selection (single signal)
                ranked = select_portfolio(
                    [(scored, decision)],
                    portfolio_snapshot,
                    portfolio_config=settings.portfolio,
                )

                for sig, dec in ranked:
                    if not dec.selected:
                        storage.save_decision(dec)
                        continue

                    decision_id = storage.save_decision(dec)

                    # Try live execution
                    live_executed = False
                    if settings.execution.live_trading_enabled:
                        live_executed = self._try_live_execute(sig, dec, decision_id, settings, storage, portfolio)

                    if not live_executed:
                        # Paper execution fallback
                        tick_ctx = TickContext(
                            tick_id=f"ws_{state.run_number}_{datetime.now(timezone.utc).strftime('%H%M%S')}",
                            run_number=state.run_number,
                            timestamp=datetime.now(timezone.utc),
                        )
                        paper = PaperExecutor(storage, portfolio)
                        paper.execute(sig, dec, decision_id, tick_ctx, market=market)

                    state.orders_placed += 1
                    logger.info(
                        "RT execution: %s edge=%.2f%% %s",
                        signal.ticker, signal.edge_pct,
                        "LIVE" if live_executed else "PAPER",
                    )

        except Exception:
            logger.exception("Execution pipeline error for %s", signal.ticker)

    def _try_live_execute(
        self, signal: Signal, decision: Decision, decision_id: int,
        settings: Settings, storage: PostgresStorage, portfolio: PortfolioManager,
    ) -> bool:
        """Attempt live order placement on Kalshi and/or Polymarket. Returns True if successful."""
        kalshi_legs = [leg for leg in signal.legs if (leg.venue or "kalshi") == "kalshi"]
        poly_legs = [leg for leg in signal.legs if leg.venue == "polymarket"]

        # Cross-platform arb: both venues
        if kalshi_legs and poly_legs and settings.execution.polymarket_private_key:
            return self._execute_cross_platform_live(
                signal, decision, decision_id, settings, storage, portfolio,
                kalshi_legs, poly_legs,
            )

        # Single-venue Kalshi only (complement arb or Kalshi-only cross-platform)
        if kalshi_legs and settings.execution.kalshi_api_key_id:
            return self._execute_kalshi_live(
                signal, decision, decision_id, settings, storage, portfolio,
                kalshi_legs,
            )

        return False

    def _execute_kalshi_live(
        self, signal: Signal, decision: Decision, decision_id: int,
        settings: Settings, storage: PostgresStorage, portfolio: PortfolioManager,
        kalshi_legs: list[TradeLeg],
    ) -> bool:
        """Execute Kalshi-only legs. Returns True if all legs fill."""
        from neutralis.execution.kalshi import KalshiExecutor

        try:
            with KalshiExecutor(settings.kalshi, settings.execution) as executor:
                results = []
                for leg in kalshi_legs:
                    price_cents = max(1, min(99, round(leg.price_dollars * 100)))
                    if signal.combined_cost > 0:
                        leg_frac = leg.price_dollars / signal.combined_cost
                    else:
                        leg_frac = 1.0 / max(len(signal.legs), 1)
                    leg_dollars = decision.suggested_size_dollars * leg_frac
                    leg_dollars = min(leg_dollars, settings.execution.max_order_dollars)
                    count = max(1, math.floor(leg_dollars / leg.price_dollars))

                    resp = executor.place_order(leg.ticker, leg.side, price_cents, count)
                    order = resp.get("order", {})
                    if order.get("status") == "executed":
                        results.append(order)
                    else:
                        return False

                if results:
                    portfolio.record_fill(
                        signal, decision, decision_id,
                        is_paper=False, execution_results=results,
                    )
                    return True
        except (TimeoutError, httpx.TimeoutException):
            logger.warning("Kalshi live execution TIMED OUT for %s", signal.ticker)
        except Exception:
            logger.warning("Kalshi live execution failed for %s", signal.ticker, exc_info=True)
        return False

    def _resolve_poly_token_id(self, poly_ticker: str, side: str) -> str | None:
        """Get the CLOB token ID for a Polymarket leg.

        For side='yes' (buying YES): use YES token (index 0) with BUY.
        For side='no' (buying NO): use YES token (index 0) with SELL.
        Returns the YES token ID in both cases — the caller adjusts the side.
        """
        state = self._state
        if state is None:
            return None
        pm = state.poly_markets.get(poly_ticker)
        if pm and pm.clob_token_ids:
            return pm.clob_token_ids[0]  # Always use YES token
        return None

    def _compute_maker_price(
        self, market: NormalizedMarket, leg: TradeLeg, offset_cents: int,
    ) -> int:
        """Compute a maker-friendly limit price inside the spread.

        Posts above the best bid (so the order rests on the book as a maker).
        Capped at ask-1 to avoid crossing the spread and becoming a taker.
        """
        if leg.side == "yes":
            bid_cents = max(1, round(market.yes_bid * 100))
            ask_cents = max(2, round(market.yes_ask * 100))
        else:
            bid_cents = max(1, round(market.no_bid * 100))
            ask_cents = max(2, round(market.no_ask * 100))
        return max(1, min(bid_cents + offset_cents, ask_cents - 1))

    def _check_orderbook_depth(
        self, ticker: str, side: str, price_dollars: float,
        settings: Settings, min_depth_dollars: float = 10.0,
    ) -> bool:
        """Fetch Kalshi orderbook and verify sufficient depth at/better than expected price.

        Returns True if depth is sufficient (or if check fails — fail open).
        """
        try:
            with KalshiClient(settings.kalshi) as client:
                ob_raw = client.get_orderbook(ticker, depth=5)

            ob_fp = ob_raw.get("orderbook_fp", {})
            if side == "yes":
                levels = ob_fp.get("yes_dollars", [])
            else:
                levels = ob_fp.get("no_dollars", [])

            if not levels:
                logger.debug("No orderbook data for %s %s — passing through", ticker, side)
                return True

            # Sum depth at or better than our target price
            available = 0.0
            for level in levels:
                if len(level) < 2:
                    continue
                level_price = float(level[0])
                level_qty = float(level[1])
                # For buying: we want levels at or below our price (asks)
                if level_price <= price_dollars + 0.005:  # small tolerance
                    available += level_qty

            if available < min_depth_dollars:
                logger.info(
                    "Orderbook depth insufficient for %s %s: $%.2f available < $%.2f min",
                    ticker, side, available, min_depth_dollars,
                )
                return False

            logger.debug(
                "Orderbook depth OK for %s %s: $%.2f available",
                ticker, side, available,
            )
            return True
        except Exception:
            logger.debug("Orderbook depth check failed for %s — passing through", ticker, exc_info=True)
            return True  # Fail open

    def _execute_cross_platform_live(
        self, signal: Signal, decision: Decision, decision_id: int,
        settings: Settings, storage: PostgresStorage, portfolio: PortfolioManager,
        kalshi_legs: list[TradeLeg], poly_legs: list[TradeLeg],
    ) -> bool:
        """Execute a cross-platform arb across Kalshi and Polymarket.

        Two modes:
        - Maker (use_maker_orders=True): Kalshi GTC first → poll → Poly FOK second
          Kalshi posts a resting limit order (maker fee, 4x cheaper), then if filled
          we immediately execute the Polymarket side.
        - Taker (use_maker_orders=False): Poly FOK first → Kalshi FOK second
          Original flow — execute riskier side first.
        """
        if settings.execution.use_maker_orders:
            return self._execute_xp_maker(
                signal, decision, decision_id, settings, storage, portfolio,
                kalshi_legs, poly_legs,
            )
        return self._execute_xp_taker(
            signal, decision, decision_id, settings, storage, portfolio,
            kalshi_legs, poly_legs,
        )

    def _execute_xp_taker(
        self, signal: Signal, decision: Decision, decision_id: int,
        settings: Settings, storage: PostgresStorage, portfolio: PortfolioManager,
        kalshi_legs: list[TradeLeg], poly_legs: list[TradeLeg],
    ) -> bool:
        """Taker flow: Polymarket FOK first, then Kalshi FOK."""
        from neutralis.execution.kalshi import KalshiExecutor
        from neutralis.execution.polymarket import PolymarketExecutor

        poly_results = []
        kalshi_results = []

        # ── Step 1: Execute Polymarket leg(s) first (FOK) ──
        try:
            with PolymarketExecutor(settings.execution) as poly_exec:
                for leg in poly_legs:
                    token_id = self._resolve_poly_token_id(leg.ticker, leg.side)
                    if not token_id:
                        logger.warning(
                            "No CLOB token ID for Polymarket ticker %s — skipping",
                            leg.ticker,
                        )
                        return False

                    if signal.combined_cost > 0:
                        leg_frac = leg.price_dollars / signal.combined_cost
                    else:
                        leg_frac = 1.0 / max(len(signal.legs), 1)
                    leg_dollars = decision.suggested_size_dollars * leg_frac
                    leg_dollars = min(leg_dollars, settings.execution.max_order_dollars)

                    poly_side = "BUY" if leg.side == "yes" else "SELL"
                    resp = poly_exec.place_market_order(
                        token_id=token_id, side=poly_side,
                        amount=round(leg_dollars, 2),
                    )
                    if resp.get("success"):
                        poly_results.append(resp)
                    else:
                        logger.warning(
                            "Polymarket leg failed for %s: %s",
                            signal.ticker, resp.get("errorMsg", "unknown"),
                        )
                        return False
        except (TimeoutError, httpx.TimeoutException):
            logger.warning("Polymarket execution TIMED OUT for %s", signal.ticker)
            return False
        except Exception:
            logger.warning("Polymarket execution failed for %s", signal.ticker, exc_info=True)
            return False

        # ── Step 2: Kalshi FOK (with depth check) ──
        for leg in kalshi_legs:
            if not self._check_orderbook_depth(
                leg.ticker, leg.side, leg.price_dollars, settings,
            ):
                logger.warning(
                    "Insufficient Kalshi depth for %s %s @ $%.4f — aborting after Poly fill "
                    "(one-legged position, exit strategies will manage)",
                    leg.ticker, leg.side, leg.price_dollars,
                )
                return False

        try:
            with KalshiExecutor(settings.kalshi, settings.execution) as k_exec:
                for leg in kalshi_legs:
                    price_cents = max(1, min(99, round(leg.price_dollars * 100)))
                    if signal.combined_cost > 0:
                        leg_frac = leg.price_dollars / signal.combined_cost
                    else:
                        leg_frac = 1.0 / max(len(signal.legs), 1)
                    leg_dollars = decision.suggested_size_dollars * leg_frac
                    leg_dollars = min(leg_dollars, settings.execution.max_order_dollars)
                    count = max(1, math.floor(leg_dollars / leg.price_dollars))

                    resp = k_exec.place_order(leg.ticker, leg.side, price_cents, count)
                    order = resp.get("order", {})
                    if order.get("status") == "executed":
                        kalshi_results.append(order)
                    else:
                        logger.warning(
                            "Kalshi leg FAILED after Polymarket filled for %s — "
                            "one-legged position (exit strategies will manage)",
                            signal.ticker,
                        )
                        break
        except (TimeoutError, httpx.TimeoutException):
            logger.warning(
                "Kalshi execution TIMED OUT after Polymarket filled for %s — "
                "one-legged position", signal.ticker,
            )
        except Exception:
            logger.warning(
                "Kalshi execution failed after Polymarket filled for %s — "
                "one-legged position", signal.ticker, exc_info=True,
            )

        # ── Step 3: Record fills ──
        all_results = poly_results + kalshi_results
        if all_results:
            portfolio.record_fill(
                signal, decision, decision_id,
                is_paper=False, execution_results=all_results,
            )
            logger.info(
                "Cross-platform taker: %s poly=%d kalshi=%d fills",
                signal.ticker, len(poly_results), len(kalshi_results),
            )
            return True
        return False

    def _execute_xp_maker(
        self, signal: Signal, decision: Decision, decision_id: int,
        settings: Settings, storage: PostgresStorage, portfolio: PortfolioManager,
        kalshi_legs: list[TradeLeg], poly_legs: list[TradeLeg],
    ) -> bool:
        """Maker flow: Kalshi GTC first (maker fee), poll for fill, then Poly FOK.

        Execution order is reversed from taker flow because:
        - Kalshi GTC rests on the book (patient, cheap — maker fee 4x lower)
        - If Kalshi fills, immediately lock in the Poly side (FOK, zero fee)
        - If Kalshi doesn't fill within timeout → cancel, no capital at risk
        """
        from neutralis.execution.kalshi import KalshiExecutor
        from neutralis.execution.polymarket import PolymarketExecutor

        kalshi_results = []
        poly_results = []
        k_market = signal.market_snapshot  # Kalshi NormalizedMarket with bid/ask data
        if k_market is None:
            return False

        offset = settings.execution.maker_price_offset_cents
        timeout = settings.execution.maker_fill_timeout_sec

        # ── Step 0: Orderbook depth check before committing ──
        for leg in kalshi_legs:
            if not self._check_orderbook_depth(
                leg.ticker, leg.side, leg.price_dollars, settings,
            ):
                logger.info(
                    "Insufficient Kalshi depth for %s %s — skipping maker order",
                    leg.ticker, leg.side,
                )
                return False

        # ── Step 1: Kalshi GTC limit order (maker) ──
        try:
            with KalshiExecutor(settings.kalshi, settings.execution) as k_exec:
                for leg in kalshi_legs:
                    maker_price = self._compute_maker_price(k_market, leg, offset)
                    if signal.combined_cost > 0:
                        leg_frac = leg.price_dollars / signal.combined_cost
                    else:
                        leg_frac = 1.0 / max(len(signal.legs), 1)
                    leg_dollars = decision.suggested_size_dollars * leg_frac
                    leg_dollars = min(leg_dollars, settings.execution.max_order_dollars)
                    count = max(1, math.floor(leg_dollars / (maker_price / 100.0)))

                    resp = k_exec.place_order(
                        leg.ticker, leg.side, maker_price, count,
                        time_in_force="gtc",
                    )
                    order = resp.get("order", {})
                    order_id = order.get("order_id", "")
                    status = order.get("status", "")

                    # May fill immediately if price crosses the spread
                    if status == "executed":
                        kalshi_results.append(order)
                        continue

                    if not order_id or status in ("canceled", "rejected"):
                        logger.warning(
                            "Kalshi maker order rejected for %s: status=%s",
                            signal.ticker, status,
                        )
                        return False

                    # Poll for fill with exponential backoff
                    filled = False
                    partial_count = 0
                    deadline = time.monotonic() + timeout
                    poll_delay = 0.05  # Start at 50ms
                    while time.monotonic() < deadline:
                        time.sleep(poll_delay)
                        poll_delay = min(poll_delay * 2, 1.0)  # 50→100→200→400→800→1000ms
                        check = k_exec.get_order(order_id)
                        check_order = check.get("order", {})
                        check_status = check_order.get("status", "")
                        if check_status == "executed":
                            kalshi_results.append(check_order)
                            filled = True
                            break
                        # Track partial fills for proportional second-leg
                        partial_count = check_order.get("fill_count", 0)

                    if not filled:
                        # Cancel remaining portion of GTC order
                        k_exec.cancel_order(order_id)
                        if partial_count > 0:
                            # Partial fill — proceed with proportional second leg
                            logger.info(
                                "Kalshi maker partial fill: %d/%d contracts for %s — "
                                "executing proportional Poly leg",
                                partial_count, count, signal.ticker,
                            )
                            check_order["_partial_fill_count"] = partial_count
                            check_order["_original_count"] = count
                            kalshi_results.append(check_order)
                        else:
                            logger.info(
                                "Kalshi maker order unfilled after %.1fs, canceled for %s",
                                timeout, signal.ticker,
                            )
                            return False

        except (TimeoutError, httpx.TimeoutException):
            logger.warning("Kalshi maker execution TIMED OUT for %s", signal.ticker)
            return False
        except Exception:
            logger.warning("Kalshi maker execution failed for %s", signal.ticker, exc_info=True)
            return False

        # ── Step 2: Kalshi filled — immediately execute Poly FOK ──
        # Scale Poly leg if Kalshi was a partial fill
        fill_ratio = 1.0
        for kr in kalshi_results:
            if "_partial_fill_count" in kr:
                fill_ratio = kr["_partial_fill_count"] / kr["_original_count"]
                break

        try:
            with PolymarketExecutor(settings.execution) as poly_exec:
                for leg in poly_legs:
                    token_id = self._resolve_poly_token_id(leg.ticker, leg.side)
                    if not token_id:
                        logger.warning(
                            "No CLOB token ID for Polymarket ticker %s — "
                            "one-legged position after Kalshi fill",
                            leg.ticker,
                        )
                        break

                    if signal.combined_cost > 0:
                        leg_frac = leg.price_dollars / signal.combined_cost
                    else:
                        leg_frac = 1.0 / max(len(signal.legs), 1)
                    leg_dollars = decision.suggested_size_dollars * leg_frac * fill_ratio
                    leg_dollars = min(leg_dollars, settings.execution.max_order_dollars)

                    poly_side = "BUY" if leg.side == "yes" else "SELL"
                    resp = poly_exec.place_market_order(
                        token_id=token_id, side=poly_side,
                        amount=round(leg_dollars, 2),
                    )
                    if resp.get("success"):
                        poly_results.append(resp)
                    else:
                        logger.warning(
                            "Polymarket leg FAILED after Kalshi maker filled for %s — "
                            "one-legged position (exit strategies will manage)",
                            signal.ticker,
                        )
                        break
        except (TimeoutError, httpx.TimeoutException):
            logger.warning(
                "Polymarket execution TIMED OUT after Kalshi maker filled for %s — "
                "one-legged position", signal.ticker,
            )
        except Exception:
            logger.warning(
                "Polymarket execution failed after Kalshi maker filled for %s — "
                "one-legged position", signal.ticker, exc_info=True,
            )

        # ── Step 3: Record fills ──
        all_results = kalshi_results + poly_results
        if all_results:
            portfolio.record_fill(
                signal, decision, decision_id,
                is_paper=False, execution_results=all_results,
            )
            logger.info(
                "Cross-platform maker: %s kalshi=%d poly=%d fills",
                signal.ticker, len(kalshi_results), len(poly_results),
            )
            return True
        return False

    # ── Periodic tasks ─────────────────────────────────────────────────

    async def _periodic_settlement(self) -> None:
        """Check for settled markets every 60s."""
        while self._running:
            await asyncio.sleep(self._ws_cfg.settlement_interval_sec)
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    self._executor_pool, self._run_settlement,
                )
            except Exception:
                logger.exception("Settlement check failed")

    def _run_settlement(self) -> None:
        settings = self._state.settings if self._state else load_settings()
        from neutralis.alerts.discord import DiscordNotifier
        notifier = DiscordNotifier(settings.alerts)
        result = run_settlement(settings, notifier=notifier)
        if result.settled > 0:
            logger.info("Settlement: %d positions, P&L=$%.2f", result.settled, result.pnl)

    async def _periodic_mtm(self) -> None:
        """Mark-to-market every 30s using cached prices."""
        while self._running:
            await asyncio.sleep(self._ws_cfg.mtm_interval_sec)
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(self._executor_pool, self._run_mtm)
            except Exception:
                logger.exception("MTM failed")

    def _run_mtm(self) -> None:
        settings = self._state.settings if self._state else load_settings()
        with PostgresStorage(settings.db) as storage:
            portfolio = PortfolioManager(storage, settings.portfolio)
            marked = portfolio.mark_to_market(settings)
            if marked > 0:
                logger.info("MTM: updated %d positions", marked)

    async def _periodic_refresh(self) -> None:
        """Full REST refresh of Kalshi markets + re-match every 5 min."""
        while self._running:
            await asyncio.sleep(self._ws_cfg.rest_refresh_interval_sec)
            try:
                loop = asyncio.get_event_loop()
                state = await loop.run_in_executor(
                    self._executor_pool, self._refresh_kalshi,
                )
                if state and self._ws:
                    # Update WS subscriptions with new focus tickers
                    new_focus = self._build_focus_tickers(state)
                    old_subs = self._ws._subscribed_tickers
                    to_add = list(new_focus - old_subs)
                    to_remove = list(old_subs - new_focus)
                    if to_add:
                        await self._ws.update_subscription("ticker", add_tickers=to_add)
                        logger.info("Added %d ticker subscriptions", len(to_add))
                    if to_remove:
                        await self._ws.update_subscription("ticker", remove_tickers=to_remove)
                        logger.info("Removed %d ticker subscriptions", len(to_remove))
            except Exception:
                logger.exception("REST refresh failed")

    def _refresh_kalshi(self) -> _LiveState | None:
        """Kalshi refresh — re-fetch priority series on full refresh, incremental otherwise."""
        state = self._state
        if state is None:
            return None
        settings = state.settings
        filter_cfg = settings.market_filter

        with KalshiClient(settings.kalshi) as client:
            if self._market_cache.needs_full_refresh(self._ws_cfg.rest_refresh_interval_sec):
                all_raw = client.fetch_priority_series(filter_cfg.priority_series)
                self._market_cache.update_bulk(all_raw)
                self._market_cache.mark_full_refresh()
            elif self._market_cache.last_update_epoch > 0:
                updated = client.get_markets_updated_since(self._market_cache.last_update_epoch)
                active = [m for m in updated if m.get("status") == "active"]
                for m in updated:
                    if m.get("status") != "active" and m.get("ticker"):
                        self._market_cache.remove(m["ticker"])
                self._market_cache.update_bulk(active)

        all_raw = self._market_cache.get_all()
        kalshi_raw = {m["ticker"]: m for m in all_raw if m.get("ticker")}
        kalshi_markets: dict[str, NormalizedMarket] = {}
        for raw in all_raw:
            nm = kalshi_normalize(raw)
            if nm and nm.market_type == MarketType.BINARY:
                kalshi_markets[nm.ticker] = nm

        # Re-match with existing Polymarket data
        pairs = match_markets(
            list(kalshi_markets.values()),
            list(state.poly_markets.values()),
            settings.matching,
        )
        xp_pairs: dict[str, tuple[MarketPair, str]] = {}
        poly_to_kalshi: dict[str, str] = {}
        for pair in pairs:
            xp_pairs[pair.kalshi_market.ticker] = (pair, pair.polymarket_market.ticker)
            poly_to_kalshi[pair.polymarket_market.ticker] = pair.kalshi_market.ticker

        # Re-group 3-way match markets (single-venue + cross-venue)
        three_way_groups = group_kalshi_three_way(kalshi_markets)
        xv_three_way = merge_cross_venue_three_way(three_way_groups, state.poly_three_way)
        all_three_way = three_way_groups + xv_three_way

        three_way_kalshi: dict[str, ThreeWayGroup] = {}
        ticker_to_three_way: dict[str, str] = {}
        for g in all_three_way:
            three_way_kalshi[g.event_id] = g
            for oc in g.outcomes:
                if oc.venue == "kalshi":
                    ticker_to_three_way[oc.ticker] = g.event_id

        state.kalshi_markets = kalshi_markets
        state.kalshi_raw = kalshi_raw
        state.xp_pairs = xp_pairs
        state.poly_to_kalshi = poly_to_kalshi
        state.three_way_kalshi = three_way_kalshi
        state.ticker_to_three_way = ticker_to_three_way

        logger.info(
            "Kalshi refresh: %d markets, %d cross-platform pairs, %d 3-way groups (%d cross-venue)",
            len(kalshi_markets), len(xp_pairs), len(three_way_kalshi), len(xv_three_way),
        )
        return state

    async def _periodic_poly_refresh(self) -> None:
        """Refresh Polymarket markets every 2 min — discover new matches and update WS subs."""
        while self._running:
            await asyncio.sleep(120.0)
            try:
                loop = asyncio.get_event_loop()
                old_asset_ids = set(self._asset_id_to_poly.keys())

                await loop.run_in_executor(self._executor_pool, self._refresh_poly)

                # Update Polymarket WS subscriptions if pairs changed
                if self._poly_ws and self._poly_ws.is_connected:
                    new_asset_ids = set(self._asset_id_to_poly.keys())
                    to_add = list(new_asset_ids - old_asset_ids)
                    to_remove = list(old_asset_ids - new_asset_ids)
                    if to_add:
                        await self._poly_ws.update_subscription(add_ids=to_add)
                        logger.info("Poly WS: added %d asset subscriptions", len(to_add))
                    if to_remove:
                        await self._poly_ws.update_subscription(remove_ids=to_remove)
                        logger.info("Poly WS: removed %d asset subscriptions", len(to_remove))

            except Exception:
                logger.exception("Polymarket refresh failed")

    def _refresh_poly(self) -> None:
        state = self._state
        if state is None:
            return
        settings = state.settings

        with PolymarketClient(settings.polymarket) as client:
            raw_poly = client.get_all_active_markets()

        poly_markets: dict[str, NormalizedMarket] = {}
        for raw in raw_poly:
            nm = poly_normalize(raw)
            if nm and nm.market_type == MarketType.BINARY:
                poly_markets[nm.ticker] = nm

        state.poly_markets = poly_markets

        # Re-match
        pairs = match_markets(
            list(state.kalshi_markets.values()),
            list(poly_markets.values()),
            settings.matching,
        )
        xp_pairs: dict[str, tuple[MarketPair, str]] = {}
        poly_to_kalshi: dict[str, str] = {}
        for pair in pairs:
            xp_pairs[pair.kalshi_market.ticker] = (pair, pair.polymarket_market.ticker)
            poly_to_kalshi[pair.polymarket_market.ticker] = pair.kalshi_market.ticker

        state.xp_pairs = xp_pairs
        state.poly_to_kalshi = poly_to_kalshi

        # Rebuild Polymarket 3-way groups and cross-venue hybrids
        poly_three_way = [g for g in (poly_normalize_three_way(raw) for raw in raw_poly) if g is not None]
        state.poly_three_way = poly_three_way
        kalshi_groups = group_kalshi_three_way(state.kalshi_markets)
        xv_three_way = merge_cross_venue_three_way(kalshi_groups, poly_three_way)
        all_three_way = kalshi_groups + xv_three_way
        three_way_kalshi: dict[str, ThreeWayGroup] = {}
        ticker_to_three_way: dict[str, str] = {}
        for g in all_three_way:
            three_way_kalshi[g.event_id] = g
            for oc in g.outcomes:
                if oc.venue == "kalshi":
                    ticker_to_three_way[oc.ticker] = g.event_id
        state.three_way_kalshi = three_way_kalshi
        state.ticker_to_three_way = ticker_to_three_way

        # Rebuild asset mappings for Poly WS
        self._build_poly_asset_mappings(state)

        logger.info(
            "Polymarket refresh: %d markets, %d pairs, %d 3-way (%d cross-venue)",
            len(poly_markets), len(xp_pairs), len(three_way_kalshi), len(xv_three_way),
        )

    # ── Discrepancy flush ────────────────────────────────────────────

    async def _periodic_flush_discrepancies(self) -> None:
        """Flush discrepancy observations buffer to DB every 30s."""
        while self._running:
            await asyncio.sleep(_DISCREPANCY_FLUSH_INTERVAL_SEC)
            try:
                state = self._state
                if state is None or not state.discrepancy_buffer:
                    continue
                # Swap buffer atomically
                batch = state.discrepancy_buffer
                state.discrepancy_buffer = []
                # Write to DB in thread pool
                loop = asyncio.get_event_loop()
                count = await loop.run_in_executor(
                    self._executor_pool, self._flush_discrepancies, batch,
                )
                if count > 0:
                    logger.info("Flushed %d discrepancy observations to DB", count)
            except Exception:
                logger.exception("Discrepancy flush failed")

    def _flush_discrepancies(self, batch: list[dict]) -> int:
        """Write discrepancy batch to Postgres. Runs sync in thread pool."""
        state = self._state
        if state is None:
            return 0
        settings = state.settings
        try:
            with PostgresStorage(settings.db) as storage:
                return storage.save_discrepancy_batch(batch)
        except Exception:
            logger.exception("Failed to save %d discrepancy rows", len(batch))
            return 0

    # ── Daily loss circuit breaker ────────────────────────────────────

    async def _periodic_daily_loss_check(self) -> None:
        """Check daily P&L every 60s and stop the engine if loss limit is breached."""
        while self._running:
            await asyncio.sleep(60.0)
            if not self._running:
                break
            try:
                loop = asyncio.get_event_loop()
                breached = await loop.run_in_executor(
                    self._executor_pool, self._check_daily_loss,
                )
                if breached:
                    logger.critical(
                        "DAILY LOSS CIRCUIT BREAKER: stopping EventEngine"
                    )
                    self._running = False
            except Exception:
                logger.exception("Daily loss check failed")

    def _check_daily_loss(self) -> bool:
        """Evaluate the daily loss limit for all active users. Runs sync in thread pool.

        Returns True if ANY user has breached their daily loss limit.
        """
        state = self._state
        if state is None:
            return False
        settings = state.settings

        # Check per-user daily loss
        try:
            with PostgresStorage(settings.db) as global_storage:
                users = load_active_users(global_storage)
        except Exception:
            logger.warning("Failed to load users for daily loss check", exc_info=True)
            users = []

        # Fallback to legacy single-user mode
        if not users:
            _user_id = os.environ.get("NEUTRALIS_USER_ID")
            if _user_id:
                users = [{"user_id": _user_id}]
            else:
                return False

        any_breached = False
        for user in users:
            uid = str(user["user_id"])
            try:
                with PostgresStorage(settings.db, user_id=uid) as storage:
                    result = check_daily_loss_limit(storage, settings.portfolio)
                    if not result.passed:
                        any_breached = True
                        logger.critical(
                            "DAILY LOSS CIRCUIT BREAKER for user %s: %s",
                            uid[:8], result.reason,
                        )
                        try:
                            storage.update_automation_state(
                                status="paused",
                                reason=f"daily_loss_limit: {result.reason}",
                            )
                        except Exception:
                            logger.warning(
                                "Failed to auto-pause user %s", uid[:8],
                                exc_info=True,
                            )
            except Exception:
                logger.warning(
                    "Daily loss check failed for user %s", uid[:8],
                    exc_info=True,
                )

        return any_breached

    # ── Kill switch / automation state check ─────────────────────────

    _KILL_SWITCH_CHECK_INTERVAL_SEC = 10.0

    async def _periodic_kill_switch_check(self) -> None:
        """Check automation_state every 10s -- pause or kill the engine."""
        while self._running:
            await asyncio.sleep(self._KILL_SWITCH_CHECK_INTERVAL_SEC)
            try:
                loop = asyncio.get_event_loop()
                should_stop = await loop.run_in_executor(
                    self._executor_pool, self._check_kill_switch,
                )
                if should_stop:
                    logger.critical("Kill switch activated -- initiating graceful shutdown")
                    self._running = False
                    await self.stop()
                    return
            except Exception:
                logger.warning("Kill switch check failed", exc_info=True)

    def _check_kill_switch(self) -> bool:
        """Synchronous kill switch check. Returns True if engine should stop."""
        state = self._state
        if state is None:
            return False
        settings = state.settings
        try:
            with PostgresStorage(settings.db) as storage:
                active_users = load_active_users(storage)
                if active_users:
                    active_ids = {str(u["user_id"]) for u in active_users}
                    if not hasattr(self, "_known_active_user_ids"):
                        self._known_active_user_ids = active_ids
                    else:
                        dropped = self._known_active_user_ids - active_ids
                        for uid in dropped:
                            if uid not in self._killed_user_ids:
                                self._killed_user_ids.add(uid)
                                logger.warning(
                                    "User %s kill switch activated mid-run"
                                    " -- stopping trading for this user",
                                    uid[:8],
                                )
                        self._known_active_user_ids = active_ids
                    if not active_ids:
                        logger.info("No active users remain -- shutting down")
                        return True
                    was_paused = self._paused
                    self._paused = False
                    if was_paused:
                        logger.info("Automation resumed -- active users found")
                    return False
                auto_state = storage.get_automation_state()
                if auto_state is None:
                    return False
                status = auto_state.get("status", "")
                kill_switch = auto_state.get("kill_switch", False)
                if status == "killed" or kill_switch:
                    reason = auto_state.get("killed_reason", "manual")
                    logger.critical(
                        "Automation killed (reason: %s) -- shutting down event engine",
                        reason,
                    )
                    return True
                if status == "paused":
                    if not self._paused:
                        logger.info(
                            "Automation paused -- suppressing signals, "
                            "keeping WebSocket connections alive"
                        )
                    self._paused = True
                    return False
                if status == "running":
                    if self._paused:
                        logger.info("Automation resumed -- re-enabling signal generation")
                    self._paused = False
                    return False
        except Exception:
            logger.warning("Failed to check automation state", exc_info=True)
        return False

    # ── Health ─────────────────────────────────────────────────────────

    def health_snapshot(self) -> dict[str, Any]:
        state = self._state
        active_flow = 0
        if state:
            active_flow = sum(
                1 for s in state.trade_flow.values() if s.total_volume_5m > 0
            )
        kalshi_ws_ok = self._ws and self._ws.is_connected
        poly_ws_ok = self._poly_ws and self._poly_ws.is_connected

        # Compute staleness info for health reporting
        now_mono = time.monotonic()
        max_age = self._ws_cfg.max_price_age_sec
        oldest_kalshi_age = 0.0
        oldest_poly_age = 0.0
        any_stale = False

        if state:
            if state.last_kalshi_update:
                oldest_kalshi_ts = min(state.last_kalshi_update.values())
                oldest_kalshi_age = round(now_mono - oldest_kalshi_ts, 1)
                if oldest_kalshi_age > max_age:
                    any_stale = True
            if state.last_poly_update:
                oldest_poly_ts = min(state.last_poly_update.values())
                oldest_poly_age = round(now_mono - oldest_poly_ts, 1)
                if oldest_poly_age > max_age:
                    any_stale = True

        if not self._running:
            health_status = "stopped"
        elif self._paused:
            health_status = "paused"
        elif any_stale:
            health_status = "degraded"
        elif kalshi_ws_ok:
            health_status = "ok"
        else:
            health_status = "degraded"

        return {
            "status": health_status,
            "paused": self._paused,
            "kalshi_ws_connected": bool(kalshi_ws_ok),
            "kalshi_ws_subscriptions": self._ws.subscribed_count if self._ws else 0,
            "poly_ws_connected": bool(poly_ws_ok),
            "poly_ws_subscriptions": self._poly_ws.subscribed_count if self._poly_ws else 0,
            "kalshi_markets": len(state.kalshi_markets) if state else 0,
            "poly_markets": len(state.poly_markets) if state else 0,
            "xp_pairs": len(state.xp_pairs) if state else 0,
            "three_way_groups": len(state.three_way_kalshi) if state else 0,
            "active_trade_flow_tickers": active_flow,
            "poly_depth_tracked": len(state.poly_depth) if state else 0,
            "ticker_updates": state.ticker_updates if state else 0,
            "arb_checks": state.arb_checks if state else 0,
            "signals_detected": state.signals_detected if state else 0,
            "signals_skipped_stale": state.signals_skipped_stale if state else 0,
            "signals_skipped_disconnected": state.signals_skipped_disconnected if state else 0,
            "orders_placed": state.orders_placed if state else 0,
            "discrepancy_observations": state.discrepancy_total if state else 0,
            "discrepancy_buffer_size": len(state.discrepancy_buffer) if state else 0,
            "killed_users": len(self._killed_user_ids),
            # Stale price protection health info
            "oldest_kalshi_price_age_sec": oldest_kalshi_age,
            "oldest_poly_price_age_sec": oldest_poly_age,
            "prices_stale": any_stale,
            "max_price_age_sec": max_age,
        }
