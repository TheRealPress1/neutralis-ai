#!/usr/bin/env python3
"""Single-pass pipeline: fetch -> normalize -> scan -> match -> score -> rank -> store.

Multi-tenant architecture:
    scan_markets()                   — shared market scan (runs once per tick)
    evaluate_and_execute_for_user()  — per-user evaluation and execution
    run_once()                       — orchestrator: scan → iterate users
"""

from __future__ import annotations

import math
import sys
import time
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import os

import httpx

from neutralis.alerts.discord import DiscordNotifier
from neutralis.config import Settings, load_settings, load_settings_with_profile
from neutralis.execution.executor import PaperExecutor
from neutralis.execution.models import TickContext
from neutralis.fees.performance import PerformanceFeeAccruer
from neutralis.profiles import load_active_profile
from neutralis.core.cross_scanner import scan_cross_platform
from neutralis.core.directional_scanner import scan_high_probability
from neutralis.core.disagreement import compute_disagreement
from neutralis.core.features import compute_market_features, estimate_costs
from neutralis.core.matcher import match_markets
from neutralis.core.scanners import scan_complement_arb
from neutralis.core.settlement_scanner import scan_settlement_arb
from neutralis.core.three_way import group_kalshi_three_way, merge_cross_venue_three_way, scan_three_way_arb
from neutralis.core.scoring import score_signal
from neutralis.guard.constraints import check_daily_loss_limit
from neutralis.guard.decision import evaluate_directional_signal, evaluate_signal, select_portfolio
from neutralis.guard.regime import apply_regime_to_pipeline, compute_regime
from neutralis.logging import get_logger
from neutralis.models import Decision, DecisionVerdict, MarketType, NormalizedMarket, Signal
from neutralis.portfolio.manager import PortfolioManager
from neutralis.services.user_credentials import load_active_users, load_user_credentials
from neutralis.settlement.settler import run_settlement
from neutralis.storage.postgres import PostgresStorage
from neutralis.venues.kalshi_client import KalshiClient
from neutralis.venues.kalshi_normalize import normalize_market as kalshi_normalize
from neutralis.venues.market_cache import MarketCache
from neutralis.venues.polymarket_client import PolymarketClient
from neutralis.venues.polymarket_normalize import normalize_market as poly_normalize, normalize_three_way_market as poly_normalize_three_way

logger = get_logger("pipeline")

def _is_poly_maintenance_window() -> bool:
    """Check if we're in Polymarket's weekly maintenance window.

    Polymarket restarts the matching engine every Tuesday around 7:00 AM ET
    for ~90 seconds. During this window, HTTP 425 errors are expected.
    """
    from zoneinfo import ZoneInfo
    now_et = datetime.now(ZoneInfo("America/New_York"))
    if now_et.weekday() == 1 and now_et.hour == 7 and now_et.minute < 3:
        return True
    return False


# Module-level state that persists across run_once() calls in daemon mode
_market_cache: MarketCache | None = None


@dataclass(frozen=True)
class RunStats:
    duration_ms: float = 0.0
    kalshi_markets: int = 0
    poly_markets: int = 0
    complement_signals: int = 0
    three_way_signals: int = 0
    cross_platform_signals: int = 0
    matches: int = 0
    decisions_pass: int = 0
    decisions_reject: int = 0
    decisions_selected: int = 0
    open_positions: int = 0
    total_exposure: float = 0.0
    positions_settled: int = 0
    settlement_pnl: float = 0.0
    marked_positions: int = 0
    exits_triggered: int = 0
    exit_pnl: float = 0.0
    regime: str = "normal"
    disagreement_index: float = 0.0
    directional_signals: int = 0
    orders_created: int = 0
    fills_created: int = 0
    users_processed: int = 0


@dataclass
class ScanResult:
    """Shared scan output — computed once per tick, reused for every user."""
    kalshi_markets: list[NormalizedMarket]
    poly_markets: list[NormalizedMarket]
    raw_kalshi: list[dict]
    raw_poly: list[dict]
    complement_signals: list[Signal]
    three_way_signals: list[Signal]
    xp_signals: list[Signal]
    directional_signals: list[Signal]
    pairs: list  # MarketPair
    enriched_markets: dict[str, NormalizedMarket]
    kalshi_by_ticker: dict[str, NormalizedMarket]
    regime: str
    regime_metrics: dict
    regime_params: dict
    pipeline_cfg: Any  # PipelineConfig after regime adjustment
    di_overall: float
    di_by_category: dict
    di_sample: int
    min_confidence: int
    match_ids: dict[str, int]  # populated during first user's store pass


def _score_signal(
    signal: Signal,
    market: NormalizedMarket,
    storage: PostgresStorage,
    match_score: float | None = None,
) -> Signal:
    """Enrich a signal with confidence scoring and capital efficiency metrics."""
    recent = storage.get_recent_snapshots_for_ticker(market.ticker, limit=10)
    features = compute_market_features(market, recent_snapshots=recent)
    costs = estimate_costs(signal, market)
    result = score_signal(signal, features, costs, match_score=match_score)

    return replace(
        signal,
        confidence_score=result["confidence_score"],
        time_to_resolution_days=result["time_to_resolution_days"],
        roi_per_day=result["roi_per_day"],
        net_edge=result["net_edge"],
        features_json=result,
    )


def _fetch_cached_kalshi(settings: Settings) -> list[dict]:
    """Fetch Kalshi markets with caching and incremental updates."""
    filter_cfg = settings.market_filter

    with KalshiClient(settings.kalshi) as client:
        if _market_cache.is_empty or _market_cache.needs_full_refresh(
            filter_cfg.full_refresh_interval_sec
        ):
            all_raw = client.fetch_priority_series(filter_cfg.priority_series)
            _market_cache.update_bulk(all_raw)
            _market_cache.mark_full_refresh()
            logger.info(
                "Priority series cache load: %d markets cached",
                _market_cache.size,
            )
        elif filter_cfg.incremental_updates and _market_cache.last_update_epoch > 0:
            updated = client.get_markets_updated_since(_market_cache.last_update_epoch)
            active = [m for m in updated if m.get("status") == "active"]
            for m in updated:
                if m.get("status") != "active" and m.get("ticker"):
                    _market_cache.remove(m["ticker"])
            changed = _market_cache.update_bulk(active)
            logger.info(
                "Incremental update: %d changed (%d fetched, %d active) | cache=%d",
                changed, len(updated), len(active), _market_cache.size,
            )

    return _market_cache.get_all()


# ---------------------------------------------------------------------------
# Phase 1: Shared market scan (runs once per tick)
# ---------------------------------------------------------------------------

def scan_markets(settings: Settings) -> ScanResult:
    """Fetch, normalize, match, and detect arb signals.

    This is venue-level work — identical for all users.  Run once per tick.
    """
    use_maker = settings.execution.use_maker_orders

    # Step 1a: Fetch active markets from Kalshi
    logger.info("Step 1a: Fetching active markets from Kalshi")
    if settings.market_filter.enabled and _market_cache is not None:
        raw_kalshi = _fetch_cached_kalshi(settings)
    else:
        with KalshiClient(settings.kalshi) as kalshi_client:
            raw_kalshi = kalshi_client.get_all_active_markets()

    # Step 1b: Fetch active markets from Polymarket
    logger.info("Step 1b: Fetching active markets from Polymarket")
    with PolymarketClient(settings.polymarket) as poly_client:
        raw_poly = poly_client.get_all_active_markets()

    # Step 2a: Normalize Kalshi (binary only)
    logger.info("Step 2a: Normalizing %d raw Kalshi markets", len(raw_kalshi))
    kalshi_markets: list[NormalizedMarket] = []
    for raw in raw_kalshi:
        m = kalshi_normalize(raw)
        if m is not None and m.market_type == MarketType.BINARY:
            kalshi_markets.append(m)
    logger.info("Normalized %d Kalshi binary markets", len(kalshi_markets))

    # Step 2b: Normalize Polymarket (binary only)
    logger.info("Step 2b: Normalizing %d raw Polymarket markets", len(raw_poly))
    poly_markets: list[NormalizedMarket] = []
    for raw in raw_poly:
        m = poly_normalize(raw)
        if m is not None and m.market_type == MarketType.BINARY:
            poly_markets.append(m)
    logger.info("Normalized %d Polymarket binary markets", len(poly_markets))

    # Step 3a: Complement arb scan (Kalshi only)
    logger.info("Step 3a: Running complement arb scanner")
    complement_signals = scan_complement_arb(kalshi_markets, settings.pipeline, maker=use_maker)

    # Step 3a2: 3-way (Dutch book) arb scan
    logger.info("Step 3a2: Running 3-way arb scanner")
    kalshi_by_ticker = {m.ticker: m for m in kalshi_markets}
    three_way_groups = group_kalshi_three_way(kalshi_by_ticker)
    poly_three_way = [g for g in (poly_normalize_three_way(raw) for raw in raw_poly) if g is not None]
    xv_three_way = merge_cross_venue_three_way(three_way_groups, poly_three_way)
    all_three_way_groups = three_way_groups + xv_three_way
    three_way_signals = scan_three_way_arb(all_three_way_groups, settings.pipeline, maker=use_maker)

    # Step 3a3: Settlement arb scan
    logger.info("Step 3a3: Running settlement arb scanner")
    settlement_signals = scan_settlement_arb(kalshi_markets, settings.pipeline, maker=use_maker)
    settlement_tickers = {s.ticker for s in complement_signals}
    for s in settlement_signals:
        if s.ticker not in settlement_tickers:
            complement_signals.append(s)

    # Step 3b: Cross-platform matching
    logger.info("Step 3b: Matching markets across venues")
    pairs = match_markets(kalshi_markets, poly_markets, settings.matching)

    # Step 3c: Cross-platform signal scan
    logger.info("Step 3c: Scanning matched pairs for price discrepancies")
    xp_signals = scan_cross_platform(pairs, settings.matching, pipeline_config=settings.pipeline, maker=use_maker)

    # Step 3f: High-probability directional scan
    directional_signals: list[Signal] = []
    if settings.directional.enabled:
        logger.info("Step 3f: Running directional scanner on sports markets")
        all_normalized = kalshi_markets + poly_markets
        directional_signals = scan_high_probability(all_normalized, settings.directional)
        logger.info("Directional scanner: %d signals found", len(directional_signals))

    # Step 3d: Orderbook enrichment for complement arb signals
    enriched_markets: dict[str, NormalizedMarket] = {}
    if complement_signals:
        logger.info("Step 3d: Fetching orderbooks for %d complement arb signals", len(complement_signals))
        with KalshiClient(settings.kalshi) as kalshi_client:
            for signal in complement_signals:
                if signal.ticker not in enriched_markets:
                    raw_market = next(
                        (r for r in raw_kalshi if r.get("ticker") == signal.ticker),
                        None,
                    )
                    if raw_market:
                        ob_raw = kalshi_client.get_orderbook(signal.ticker)
                        enriched = kalshi_normalize(raw_market, ob_raw)
                        if enriched:
                            enriched_markets[signal.ticker] = enriched

    # Step 3e: Compute disagreement index and regime
    logger.info("Step 3e: Computing regime")
    di_overall, di_by_category, di_sample = compute_disagreement(pairs)
    all_markets = kalshi_markets + poly_markets
    regime, regime_metrics, regime_params = compute_regime(
        all_markets, disagreement=di_overall,
    )
    pipeline_cfg = apply_regime_to_pipeline(settings.pipeline, regime_params)
    min_confidence = regime_params.get("min_confidence", 0)
    logger.info(
        "Regime: %s | disagreement=%.4f (%d pairs) | min_edge=%.1f%% min_conf=%d",
        regime, di_overall, di_sample,
        pipeline_cfg.min_edge_pct, min_confidence,
    )

    return ScanResult(
        kalshi_markets=kalshi_markets,
        poly_markets=poly_markets,
        raw_kalshi=raw_kalshi,
        raw_poly=raw_poly,
        complement_signals=complement_signals,
        three_way_signals=three_way_signals,
        xp_signals=xp_signals,
        directional_signals=directional_signals,
        pairs=pairs,
        enriched_markets=enriched_markets,
        kalshi_by_ticker=kalshi_by_ticker,
        regime=regime,
        regime_metrics=regime_metrics,
        regime_params=regime_params,
        pipeline_cfg=pipeline_cfg,
        di_overall=di_overall,
        di_by_category=di_by_category,
        di_sample=di_sample,
        min_confidence=min_confidence,
        match_ids={},
    )


# ---------------------------------------------------------------------------
# Phase 2: Per-user evaluation and execution
# ---------------------------------------------------------------------------

@dataclass
class UserRunResult:
    """Per-user stats from a single tick."""
    user_id: str
    decisions_pass: int = 0
    decisions_reject: int = 0
    decisions_selected: int = 0
    open_positions: int = 0
    total_exposure: float = 0.0
    positions_settled: int = 0
    settlement_pnl: float = 0.0
    marked_positions: int = 0
    exits_triggered: int = 0
    exit_pnl: float = 0.0
    orders_created: int = 0
    fills_created: int = 0


def evaluate_and_execute_for_user(
    user: dict,
    scan: ScanResult,
    settings: Settings,
    notifier: DiscordNotifier,
    tick_ctx: TickContext,
) -> UserRunResult:
    """Run settlement, MTM, exits, scoring, guard, and execution for one user.

    All DB writes are scoped to ``user["user_id"]``.
    """
    uid = str(user["user_id"])
    email = user.get("email", "?")
    logger.info("── Processing user %s (%s) ──", uid[:8], email)

    result = UserRunResult(user_id=uid)

    with PostgresStorage(settings.db, user_id=uid) as storage:
        # ── Step 0: Settle resolved positions ──
        settlement = run_settlement(
            settings, notifier=notifier, storage=storage, user_id=uid,
        )
        result.positions_settled = settlement.settled
        result.settlement_pnl = settlement.pnl

        # ── Step 0b: Mark to market ──
        mtm_portfolio = PortfolioManager(storage, settings.portfolio)
        result.marked_positions = mtm_portfolio.mark_to_market(settings)

        # ── Step 0c: Evaluate exits ──
        if settings.exits.enabled:
            fee_accruer = None
            if settings.performance_fees.enabled:
                fee_accruer = PerformanceFeeAccruer(
                    storage, settings.performance_fees, user_id=uid,
                )
            exit_portfolio = PortfolioManager(
                storage, settings.portfolio, fee_accruer=fee_accruer,
            )
            exits = exit_portfolio.evaluate_exits(
                settings, settings.exits,
                directional_config=settings.directional,
            )
            for pos, reason, price in exits:
                closed = exit_portfolio.execute_exit(pos, reason, price)
                result.exits_triggered += 1
                result.exit_pnl += closed.realized_pnl
                notifier.notify_exit(
                    ticker=pos.ticker,
                    side=pos.side.value,
                    venue=pos.venue,
                    exit_reason=reason,
                    exit_price=price,
                    pnl=closed.realized_pnl,
                )
            if result.exits_triggered > 0:
                logger.info(
                    "Exits: %d positions closed, P&L=$%.2f",
                    result.exits_triggered, result.exit_pnl,
                )

        # ── Step 3d: Daily loss circuit breaker ──
        daily_loss_check = check_daily_loss_limit(storage, settings.portfolio)
        if not daily_loss_check.passed:
            logger.critical(
                "DAILY LOSS CIRCUIT BREAKER TRIPPED for user %s: %s",
                uid[:8], daily_loss_check.reason,
            )
            try:
                storage.update_automation_state(
                    status="paused",
                    reason=f"daily_loss_limit: {daily_loss_check.reason}",
                )
                logger.info("Automation auto-paused for user %s due to daily loss limit", uid[:8])
            except Exception:
                logger.warning(
                    "Failed to auto-pause automation state for user %s",
                    uid[:8], exc_info=True,
                )
            # Still return partial results (settlement + exits already ran, no new trades)
            snapshot = mtm_portfolio.get_snapshot()
            result.open_positions = snapshot.open_position_count
            result.total_exposure = snapshot.total_exposure_dollars
            return result

        # ── Step 4: Score, evaluate, rank, execute ──
        main_fee_accruer = None
        if settings.performance_fees.enabled:
            main_fee_accruer = PerformanceFeeAccruer(
                storage, settings.performance_fees, user_id=uid,
            )
        portfolio = PortfolioManager(
            storage, settings.portfolio, fee_accruer=main_fee_accruer,
        )

        # Save regime state & disagreement (global, saved once — first user)
        if not scan.match_ids:  # first user stores shared data
            storage_global = PostgresStorage(settings.db)
            storage_global.connect()
            try:
                storage_global.save_regime_state(
                    scan.regime, scan.regime_metrics, scan.regime_params,
                )
                if scan.di_sample > 0:
                    storage_global.save_disagreement_index(
                        scan.di_overall, scan.di_by_category, scan.di_sample,
                    )
                # Store cross-platform matches (global data)
                for pair in scan.pairs:
                    k_snap = storage_global.save_market_snapshot(pair.kalshi_market)
                    p_snap = storage_global.save_market_snapshot(pair.polymarket_market)
                    mid = storage_global.save_market_match(pair, k_snap, p_snap)
                    key = f"{pair.kalshi_market.ticker}:{pair.polymarket_market.ticker}"
                    scan.match_ids[key] = mid

                for signal in scan.xp_signals:
                    xp = signal.cross_platform
                    if xp is None:
                        continue
                    key = f"{xp.kalshi_ticker}:{xp.polymarket_id}"
                    mid = scan.match_ids.get(key)
                    storage_global.save_cross_platform_signal(signal, match_id=mid)
            finally:
                storage_global.close()

        # Portfolio snapshot baseline for this user
        portfolio_snapshot = portfolio.get_snapshot()
        logger.info(
            "Portfolio baseline: %d open, $%.2f exposure",
            portfolio_snapshot.open_position_count,
            portfolio_snapshot.total_exposure_dollars,
        )

        # ── Initialize executors from user's credentials ──
        live_kalshi = None
        live_poly = None
        try:
            from neutralis.execution.kalshi import KalshiExecutor
            from neutralis.execution.polymarket import PolymarketExecutor

            creds = load_user_credentials(storage, uid)

            if creds.kalshi and settings.execution.live_trading_enabled:
                try:
                    live_kalshi = KalshiExecutor.from_credentials(
                        creds.kalshi.api_key_id,
                        creds.kalshi.private_key_pem,
                        settings.kalshi,
                    )
                    balance = live_kalshi.get_balance()
                    if balance < settings.execution.balance_floor_dollars:
                        logger.warning(
                            "Kalshi balance $%.2f below floor $%.2f, falling back to paper",
                            balance, settings.execution.balance_floor_dollars,
                        )
                        live_kalshi.close()
                        live_kalshi = None
                    else:
                        logger.info("Live Kalshi execution ready: $%.2f", balance)
                except Exception:
                    logger.warning("Failed to init Kalshi executor for %s", uid[:8], exc_info=True)
                    live_kalshi = None

            if creds.polymarket and settings.execution.live_trading_enabled:
                try:
                    live_poly = PolymarketExecutor.from_credentials(
                        api_key=creds.polymarket.api_key,
                        api_secret=creds.polymarket.api_secret,
                        passphrase=creds.polymarket.passphrase,
                        funder_address=creds.polymarket.funder_address,
                    )
                    logger.info("Live Polymarket execution ready for %s", uid[:8])
                except Exception:
                    logger.warning("Failed to init Polymarket executor for %s", uid[:8], exc_info=True)
                    live_poly = None
        except Exception:
            logger.warning("Failed to load credentials for %s", uid[:8], exc_info=True)

        # ── Load user's risk profile overrides ──
        category_overrides = None
        profile = load_active_profile(storage)
        if profile and profile.category_overrides:
            category_overrides = profile.category_overrides

        # Build unified list of (scored_signal, market) pairs
        signal_market_pairs: list[tuple[Signal, NormalizedMarket]] = []

        # Score complement arb signals
        for signal in scan.complement_signals:
            market = scan.enriched_markets.get(signal.ticker, signal.market_snapshot)
            if market is None:
                continue
            scored = _score_signal(signal, market, storage)
            signal_market_pairs.append((scored, market))

        # Score 3-way arb signals
        for signal in scan.three_way_signals:
            first_leg_ticker = signal.legs[0].ticker if signal.legs else signal.ticker
            market = scan.kalshi_by_ticker.get(first_leg_ticker) or signal.market_snapshot
            if market is None:
                continue
            scored = _score_signal(signal, market, storage)
            signal_market_pairs.append((scored, market))

        # Score cross-platform signals
        for signal in scan.xp_signals:
            xp = signal.cross_platform
            if xp is None:
                continue
            market = signal.market_snapshot
            if market is None:
                continue
            match_conf = xp.match_confidence if xp else None
            scored = _score_signal(signal, market, storage, match_score=match_conf)
            signal_market_pairs.append((scored, market))

        # Paper executor for this user
        paper_executor = PaperExecutor(storage, portfolio)

        # ── Directional signals (isolated portfolio) ──
        directional_selected = 0
        if scan.directional_signals:
            dir_snapshot = portfolio.get_snapshot_filtered("high_probability_directional")
            for signal in scan.directional_signals:
                market = signal.market_snapshot
                if market is None:
                    continue
                scored = _score_signal(signal, market, storage)
                snap_id = storage.save_market_snapshot(market)
                storage.save_signal(scored, snapshot_id=snap_id)

                decision = evaluate_directional_signal(
                    scored, market, settings.directional,
                    portfolio_snapshot=dir_snapshot,
                )
                storage.save_decision(decision)

                if decision.verdict == DecisionVerdict.PASS:
                    directional_selected += 1
                    exec_result = paper_executor.execute(
                        scored, decision, 0, tick_ctx, market=market,
                    )
                    result.orders_created += len(exec_result.orders)
                    result.fills_created += len(exec_result.fills)
                    dir_snapshot = portfolio.get_snapshot_filtered("high_probability_directional")

        # ── Guard evaluation (provisional) ──
        provisional: list[tuple[Signal, Decision]] = []
        pass_count = 0
        reject_count = 0

        for scored_signal, market in signal_market_pairs:
            snap_id = storage.save_market_snapshot(market)
            storage.save_signal(scored_signal, snapshot_id=snap_id)

            decision = evaluate_signal(
                scored_signal, market, scan.pipeline_cfg,
                portfolio_snapshot=portfolio_snapshot,
                portfolio_config=settings.portfolio,
                category_overrides=category_overrides,
                regime_params=scan.regime_params,
            )
            provisional.append((scored_signal, decision))
            if decision.verdict == DecisionVerdict.PASS:
                pass_count += 1
            else:
                reject_count += 1

        # ── Ranked selection ──
        ranked = select_portfolio(
            provisional,
            portfolio_snapshot,
            portfolio_config=settings.portfolio,
            min_confidence=scan.min_confidence,
        )

        # ── Execute selected signals ──
        selected_count = 0
        # Build Polymarket ticker → NormalizedMarket lookup for token_id resolution
        poly_by_ticker = {m.ticker: m for m in scan.poly_markets}

        for signal, decision in ranked:
            decision_id = storage.save_decision(decision)

            if decision.verdict == DecisionVerdict.PASS and decision.selected:
                selected_count += 1

                # Attempt live execution if enabled
                live_results = None
                kalshi_legs = [leg for leg in signal.legs if (leg.venue or "kalshi") == "kalshi"]
                poly_legs = [leg for leg in signal.legs if leg.venue == "polymarket"]

                if poly_legs and kalshi_legs and live_kalshi is not None and live_poly is not None:
                    # ── Polymarket maintenance window check ──
                    if settings.execution.suppress_poly_maintenance and _is_poly_maintenance_window():
                        logger.warning("Polymarket maintenance window — skipping XP execution, paper fallback")
                        poly_legs = []  # fall through to paper executor

                if poly_legs and kalshi_legs and live_kalshi is not None and live_poly is not None:
                    # ── Cross-platform: Polymarket FOK first, then Kalshi ──
                    xp_results: list[dict] = []
                    xp_ok = True

                    # Execute Polymarket legs first (riskier venue)
                    for leg in poly_legs:
                        if signal.combined_cost > 0:
                            leg_frac = leg.price_dollars / signal.combined_cost
                        else:
                            leg_frac = 1.0 / max(len(signal.legs), 1)
                        leg_dollars = decision.suggested_size_dollars * leg_frac
                        leg_dollars = min(leg_dollars, settings.execution.max_order_dollars)

                        # Resolve CLOB token ID from the Polymarket NormalizedMarket
                        poly_market = poly_by_ticker.get(leg.ticker)
                        token_id = (
                            poly_market.clob_token_ids[0]
                            if poly_market and poly_market.clob_token_ids
                            else None
                        )
                        if not token_id:
                            logger.warning(
                                "No CLOB token ID for Polymarket ticker %s, falling back to paper",
                                leg.ticker,
                            )
                            xp_ok = False
                            break

                        # Buying NO on Polymarket = SELL the YES token
                        poly_side = "BUY" if leg.side == "yes" else "SELL"
                        try:
                            resp = live_poly.place_market_order(token_id, poly_side, leg_dollars)
                            if resp.get("success"):
                                xp_results.append({
                                    "order_id": resp.get("orderID", ""),
                                    "status": "executed",
                                    "venue": "polymarket",
                                })
                            else:
                                logger.warning(
                                    "Polymarket order rejected: %s error=%s",
                                    leg.ticker, resp.get("errorMsg", ""),
                                )
                                xp_ok = False
                                break
                        except (TimeoutError, httpx.TimeoutException):
                            logger.warning(
                                "Polymarket order TIMED OUT for %s, falling back to paper",
                                leg.ticker,
                            )
                            xp_ok = False
                            break
                        except Exception:
                            logger.warning(
                                "Polymarket order failed for %s, falling back to paper",
                                leg.ticker, exc_info=True,
                            )
                            xp_ok = False
                            break

                    # Execute Kalshi legs second (if Polymarket succeeded)
                    if xp_ok:
                        for leg in kalshi_legs:
                            price_cents = max(1, min(99, round(leg.price_dollars * 100)))
                            if signal.combined_cost > 0:
                                leg_frac = leg.price_dollars / signal.combined_cost
                            else:
                                leg_frac = 1.0 / max(len(signal.legs), 1)
                            leg_dollars = decision.suggested_size_dollars * leg_frac
                            leg_dollars = min(leg_dollars, settings.execution.max_order_dollars)
                            count = max(1, math.floor(leg_dollars / leg.price_dollars))
                            try:
                                resp = live_kalshi.place_order(
                                    leg.ticker, leg.side, price_cents, count,
                                )
                                order = resp.get("order", {})
                                if order.get("status") == "executed":
                                    xp_results.append(order)
                                else:
                                    logger.warning(
                                        "Kalshi order not filled after Poly fill: %s status=%s",
                                        leg.ticker, order.get("status"),
                                    )
                                    xp_ok = False
                                    break
                            except (TimeoutError, httpx.TimeoutException):
                                logger.warning(
                                    "Kalshi order TIMED OUT after Poly fill: %s",
                                    leg.ticker,
                                )
                                xp_ok = False
                                break
                            except Exception:
                                logger.warning(
                                    "Kalshi order failed after Poly fill: %s",
                                    leg.ticker, exc_info=True,
                                )
                                xp_ok = False
                                break

                    if xp_ok and xp_results:
                        live_results = xp_results
                    elif xp_results:
                        # Partial fill (Poly succeeded, Kalshi failed) — record what
                        # filled so exit strategies can manage the one-legged position
                        logger.warning(
                            "Cross-platform partial fill: %d/%d legs filled, "
                            "recording partial — exit strategies will manage risk",
                            len(xp_results), len(signal.legs),
                        )
                        live_results = xp_results

                elif not poly_legs and live_kalshi is not None:
                    # ── Kalshi-only signal ──
                    results = []
                    all_filled = True
                    for leg in signal.legs:
                        price_cents = max(1, min(99, round(leg.price_dollars * 100)))
                        if signal.combined_cost > 0:
                            leg_frac = leg.price_dollars / signal.combined_cost
                        else:
                            leg_frac = 1.0 / max(len(signal.legs), 1)
                        leg_dollars = decision.suggested_size_dollars * leg_frac
                        leg_dollars = min(leg_dollars, settings.execution.max_order_dollars)
                        count = max(1, math.floor(leg_dollars / leg.price_dollars))
                        try:
                            resp = live_kalshi.place_order(
                                leg.ticker, leg.side, price_cents, count,
                            )
                            order = resp.get("order", {})
                            if order.get("status") == "executed":
                                results.append(order)
                            else:
                                logger.warning(
                                    "Order not filled: %s status=%s",
                                    leg.ticker, order.get("status"),
                                )
                                all_filled = False
                                break
                        except (TimeoutError, httpx.TimeoutException):
                            logger.warning(
                                "Kalshi order TIMED OUT for %s, falling back to paper",
                                leg.ticker,
                            )
                            all_filled = False
                            break
                        except Exception:
                            logger.warning(
                                "Live order failed for %s, falling back to paper",
                                leg.ticker, exc_info=True,
                            )
                            all_filled = False
                            break
                    if all_filled and results:
                        live_results = results

                if live_results is not None:
                    portfolio.record_fill(
                        signal, decision, decision_id,
                        is_paper=False, execution_results=live_results,
                    )
                else:
                    market = scan.enriched_markets.get(signal.ticker, signal.market_snapshot)
                    exec_result = paper_executor.execute(
                        signal, decision, decision_id, tick_ctx, market=market,
                    )
                    result.orders_created += len(exec_result.orders)
                    result.fills_created += len(exec_result.fills)
                portfolio_snapshot = portfolio.get_snapshot()
                for leg in signal.legs:
                    notifier.notify_fill(
                        ticker=leg.ticker,
                        side=leg.side,
                        venue=leg.venue or signal.legs[0].venue or "kalshi",
                        size=leg.quantity_dollars,
                        price=leg.price_dollars,
                    )

        # ── Final snapshot ──
        snapshot = portfolio.get_snapshot()
        result.decisions_pass = pass_count
        result.decisions_reject = reject_count
        result.decisions_selected = selected_count
        result.open_positions = snapshot.open_position_count
        result.total_exposure = snapshot.total_exposure_dollars

        logger.info(
            "User %s: %d open, $%.2f exposure, %d pass (%d selected), %d reject",
            uid[:8],
            snapshot.open_position_count,
            snapshot.total_exposure_dollars,
            pass_count, selected_count, reject_count,
        )

    # Clean up live executors
    if live_kalshi is not None:
        live_kalshi.close()
    if live_poly is not None:
        live_poly.close()

    return result


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_once(run_number: int = 0) -> RunStats:
    base_settings = load_settings()

    # Generate tick context for idempotency
    tick_ts = datetime.now(timezone.utc)
    tick_id = f"tick_{run_number}_{tick_ts.strftime('%Y-%m-%dT%H:%MZ')}"
    tick_ctx = TickContext(tick_id=tick_id, run_number=run_number, timestamp=tick_ts)

    with PostgresStorage(base_settings.db) as profile_storage:
        settings = load_settings_with_profile(profile_storage)

    notifier = DiscordNotifier(settings.alerts)
    start = time.monotonic()

    # Phase 1: Shared market scan
    scan = scan_markets(settings)

    # Alert on signals found
    if scan.complement_signals or scan.three_way_signals or scan.xp_signals:
        notifier.notify_signals(
            len(scan.complement_signals) + len(scan.three_way_signals),
            len(scan.xp_signals),
            len(scan.pairs),
        )

    # Phase 2: Load active users and iterate
    with PostgresStorage(settings.db) as global_storage:
        users = load_active_users(global_storage)

    if not users:
        # Fallback: run in legacy single-user mode (env-var credentials)
        logger.info("No active users found, running in legacy single-user mode")
        _user_id = os.environ.get("NEUTRALIS_USER_ID")
        if _user_id:
            users = [{"user_id": _user_id, "email": "env", "is_founder": True}]
        else:
            logger.warning("No users and no NEUTRALIS_USER_ID — nothing to do")
            elapsed = (time.monotonic() - start) * 1000
            return RunStats(
                duration_ms=elapsed,
                kalshi_markets=len(scan.kalshi_markets),
                poly_markets=len(scan.poly_markets),
                regime=scan.regime,
            )

    logger.info("Processing %d active users", len(users))

    # Aggregate stats across all users
    total_pass = 0
    total_reject = 0
    total_selected = 0
    total_settled = 0
    total_settlement_pnl = 0.0
    total_marked = 0
    total_exits = 0
    total_exit_pnl = 0.0
    total_orders = 0
    total_fills = 0
    last_open = 0
    last_exposure = 0.0

    for user in users:
        try:
            user_result = evaluate_and_execute_for_user(
                user, scan, settings, notifier, tick_ctx,
            )
            total_pass += user_result.decisions_pass
            total_reject += user_result.decisions_reject
            total_selected += user_result.decisions_selected
            total_settled += user_result.positions_settled
            total_settlement_pnl += user_result.settlement_pnl
            total_marked += user_result.marked_positions
            total_exits += user_result.exits_triggered
            total_exit_pnl += user_result.exit_pnl
            total_orders += user_result.orders_created
            total_fills += user_result.fills_created
            last_open = user_result.open_positions
            last_exposure = user_result.total_exposure
        except Exception:
            logger.exception(
                "Pipeline error for user %s", str(user.get("user_id", "?"))[:8],
            )

    elapsed = (time.monotonic() - start) * 1000
    logger.info(
        "Pipeline complete: %d complement, %d 3-way, %d cross-platform, %d directional, "
        "%d matches, %d pass (%d selected), %d reject, %d users, regime=%s, %.0fms",
        len(scan.complement_signals),
        len(scan.three_way_signals),
        len(scan.xp_signals),
        len(scan.directional_signals),
        len(scan.pairs),
        total_pass,
        total_selected,
        total_reject,
        len(users),
        scan.regime,
        elapsed,
        extra={"duration_ms": elapsed},
    )

    stats = RunStats(
        duration_ms=elapsed,
        kalshi_markets=len(scan.kalshi_markets),
        poly_markets=len(scan.poly_markets),
        complement_signals=len(scan.complement_signals),
        three_way_signals=len(scan.three_way_signals),
        cross_platform_signals=len(scan.xp_signals),
        directional_signals=len(scan.directional_signals),
        matches=len(scan.pairs),
        decisions_pass=total_pass,
        decisions_reject=total_reject,
        decisions_selected=total_selected,
        open_positions=last_open,
        total_exposure=last_exposure,
        positions_settled=total_settled,
        settlement_pnl=total_settlement_pnl,
        marked_positions=total_marked,
        exits_triggered=total_exits,
        exit_pnl=total_exit_pnl,
        regime=scan.regime,
        disagreement_index=scan.di_overall,
        orders_created=total_orders,
        fills_created=total_fills,
        users_processed=len(users),
    )

    # Alert if anything interesting happened
    if total_selected > 0 or total_settled > 0 or total_exits > 0:
        notifier.notify_pipeline_summary(stats)

    return stats


if __name__ == "__main__":
    try:
        run_once()
    except KeyboardInterrupt:
        logger.info("Interrupted")
    except Exception:
        logger.exception("Pipeline failed")
        sys.exit(1)
