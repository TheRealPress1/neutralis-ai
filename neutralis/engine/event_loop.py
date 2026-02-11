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
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Any

from neutralis.config import Settings, WebSocketConfig, load_settings, load_settings_with_profile
from neutralis.core.cross_scanner import scan_cross_platform
from neutralis.core.matcher import MarketPair, match_markets
from neutralis.core.scanners import scan_complement_arb
from neutralis.core.scoring import score_signal
from neutralis.core.features import compute_market_features, estimate_costs
from neutralis.execution.executor import PaperExecutor
from neutralis.execution.models import TickContext
from neutralis.fees import estimate_total_fee, estimate_cross_platform_fee
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
from neutralis.venues.polymarket_normalize import normalize_market as poly_normalize

logger = get_logger("event_engine")


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
    # Counters
    ticker_updates: int = 0
    arb_checks: int = 0
    signals_detected: int = 0
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

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._ws_cfg = settings.websocket
        self._ws: KalshiWebSocket | None = None
        self._state: _LiveState | None = None
        self._executor_pool = ThreadPoolExecutor(max_workers=4)
        self._market_cache = MarketCache()
        self._running = False
        self._tasks: list[asyncio.Task] = []

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
        self._ws = KalshiWebSocket(self._ws_cfg, self._settings.execution)
        self._ws.on("ticker", self._on_ticker)
        self._ws.on("fill", self._on_fill)
        self._ws.on("trade", self._on_trade)

        await self._ws.connect()

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
        await self._ws.subscribe_lifecycle()

        # Step 4: Start periodic tasks
        self._running = True
        self._tasks = [
            asyncio.create_task(self._ws.listen(), name="ws_listen"),
            asyncio.create_task(self._periodic_settlement(), name="settlement"),
            asyncio.create_task(self._periodic_mtm(), name="mtm"),
            asyncio.create_task(self._periodic_refresh(), name="refresh"),
            asyncio.create_task(self._periodic_poly_refresh(), name="poly_refresh"),
        ]

        logger.info(
            "EventEngine running — %d WS subscriptions, %d periodic tasks",
            len(focus_tickers), len(self._tasks) - 1,
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
            # If WS listener dies, restart it
            for task in done:
                if task.get_name() == "ws_listen" and self._running:
                    logger.warning("WS listener died, restarting")
                    self._tasks.remove(task)
                    ws_task = asyncio.create_task(
                        self._ws.run_forever(), name="ws_listen",
                    )
                    self._tasks.append(ws_task)
                    await self.run_until_stopped()
                    return
        except asyncio.CancelledError:
            pass

    async def stop(self) -> None:
        """Graceful shutdown."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        if self._ws:
            await self._ws.close()
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

        # Fetch Kalshi
        with KalshiClient(settings.kalshi) as client:
            all_raw = client.get_all_active_markets()
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

        logger.info(
            "State built: %d Kalshi, %d Polymarket, %d pairs",
            len(kalshi_markets), len(poly_markets), len(pairs),
        )

        return _LiveState(
            kalshi_markets=kalshi_markets,
            poly_markets=poly_markets,
            kalshi_raw=kalshi_raw,
            xp_pairs=xp_pairs,
            poly_to_kalshi=poly_to_kalshi,
            settings=settings,
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

        nm = state.kalshi_markets.get(ticker)
        if nm is None:
            return

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
        await self._fast_arb_check(ticker, updated)

    async def _on_fill(self, msg: dict[str, Any]) -> None:
        """Handle a fill notification from Kalshi."""
        logger.info(
            "Fill: ticker=%s side=%s count=%s price=%s",
            msg.get("ticker"), msg.get("side"),
            msg.get("count"), msg.get("yes_price") or msg.get("no_price"),
        )

    async def _on_trade(self, msg: dict[str, Any]) -> None:
        """Handle public trade notification — useful for volume tracking."""
        pass  # Future: update volume metrics

    # ── Fast arb detection ─────────────────────────────────────────────

    async def _fast_arb_check(self, ticker: str, market: NormalizedMarket) -> None:
        """Ultra-fast arb check triggered by every ticker update.

        Two checks in <1ms:
        1. Complement arb: yes_ask + no_ask < 1.0 (minus fees)
        2. Cross-platform: compare vs stored Polymarket price

        If either triggers, dispatch to the execution pipeline (runs in thread pool).
        """
        state = self._state
        if state is None:
            return
        state.arb_checks += 1
        cfg = state.settings.pipeline

        # ── Check 1: Complement arb ──
        if market.yes_ask > 0 and market.no_ask > 0:
            combined = market.yes_ask + market.no_ask
            if combined < 1.0:
                fee = estimate_total_fee(market.yes_ask, market.no_ask, venue="kalshi")
                net_edge = (1.0 - combined) - fee
                if net_edge > 0:
                    edge_pct = (net_edge / combined) * 100.0
                    if edge_pct >= cfg.min_edge_pct:
                        logger.info(
                            "RT complement arb: %s yes=%.4f no=%.4f edge=%.2f%%",
                            ticker, market.yes_ask, market.no_ask, edge_pct,
                        )
                        state.signals_detected += 1
                        # Dispatch to thread pool for scoring + execution
                        loop = asyncio.get_event_loop()
                        loop.run_in_executor(
                            self._executor_pool,
                            self._execute_complement_arb,
                            ticker, market, net_edge, edge_pct,
                        )

        # ── Check 2: Cross-platform arb ──
        pair_info = state.xp_pairs.get(ticker)
        if pair_info:
            pair, poly_ticker = pair_info
            poly_market = state.poly_markets.get(poly_ticker)
            if poly_market and poly_market.yes_ask > 0:
                k_yes = market.yes_ask
                p_yes = poly_market.yes_ask

                if k_yes > 0 and p_yes > 0 and abs(k_yes - p_yes) > 0.01:
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
                        if gross_edge > 0:
                            fee = estimate_cross_platform_fee(
                                yes_price=favored_yes, yes_venue=yes_venue,
                                no_price=other_no, no_venue=no_venue,
                            )
                            net_edge = gross_edge - fee
                            if net_edge > 0:
                                edge_pct = (net_edge / combined) * 100.0
                                if edge_pct >= cfg.min_edge_pct:
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
                portfolio = PortfolioManager(storage, settings.portfolio)
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
                    if settings.execution.live_trading_enabled and settings.execution.kalshi_api_key_id:
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
        """Attempt live Kalshi order placement. Returns True if successful."""
        from neutralis.execution.kalshi import KalshiExecutor

        try:
            with KalshiExecutor(settings.kalshi, settings.execution) as executor:
                kalshi_legs = [
                    leg for leg in signal.legs
                    if (leg.venue or "kalshi") == "kalshi"
                ]
                if not kalshi_legs:
                    return False

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
        except Exception:
            logger.warning("Live execution failed for %s", signal.ticker, exc_info=True)
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
        """Full Kalshi refresh — incremental if cache supports it."""
        state = self._state
        if state is None:
            return None
        settings = state.settings

        with KalshiClient(settings.kalshi) as client:
            if self._market_cache.needs_full_refresh(self._ws_cfg.rest_refresh_interval_sec):
                all_raw = client.get_all_active_markets()
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

        state.kalshi_markets = kalshi_markets
        state.kalshi_raw = kalshi_raw
        state.xp_pairs = xp_pairs
        state.poly_to_kalshi = poly_to_kalshi

        logger.info(
            "Kalshi refresh: %d markets, %d cross-platform pairs",
            len(kalshi_markets), len(xp_pairs),
        )
        return state

    async def _periodic_poly_refresh(self) -> None:
        """Refresh Polymarket prices every 2 min for cross-platform arb accuracy."""
        while self._running:
            await asyncio.sleep(120.0)
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(self._executor_pool, self._refresh_poly)
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
        logger.info(
            "Polymarket refresh: %d markets, %d cross-platform pairs",
            len(poly_markets), len(xp_pairs),
        )

    # ── Health ─────────────────────────────────────────────────────────

    def health_snapshot(self) -> dict[str, Any]:
        state = self._state
        return {
            "status": "ok" if self._running and self._ws and self._ws.is_connected else "degraded",
            "ws_connected": self._ws.is_connected if self._ws else False,
            "ws_subscriptions": self._ws.subscribed_count if self._ws else 0,
            "kalshi_markets": len(state.kalshi_markets) if state else 0,
            "poly_markets": len(state.poly_markets) if state else 0,
            "xp_pairs": len(state.xp_pairs) if state else 0,
            "ticker_updates": state.ticker_updates if state else 0,
            "arb_checks": state.arb_checks if state else 0,
            "signals_detected": state.signals_detected if state else 0,
            "orders_placed": state.orders_placed if state else 0,
        }
