#!/usr/bin/env python3
"""Single-pass pipeline: fetch -> normalize -> scan -> match -> score -> rank -> store."""

from __future__ import annotations

import math
import sys
import time
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.alerts.discord import DiscordNotifier
from neutralis.config import load_settings, load_settings_with_profile
from neutralis.execution.executor import PaperExecutor
from neutralis.execution.models import TickContext
from neutralis.profiles import load_active_profile
from neutralis.core.cross_scanner import scan_cross_platform
from neutralis.core.disagreement import compute_disagreement
from neutralis.core.features import compute_market_features, estimate_costs
from neutralis.core.matcher import match_markets
from neutralis.core.scanners import scan_complement_arb
from neutralis.core.scoring import score_signal
from neutralis.guard.decision import evaluate_signal, select_portfolio
from neutralis.guard.regime import apply_regime_to_pipeline, compute_regime
from neutralis.logging import get_logger
from neutralis.models import Decision, DecisionVerdict, MarketType, NormalizedMarket, Signal
from neutralis.portfolio.manager import PortfolioManager
from neutralis.settlement.settler import run_settlement
from neutralis.storage.postgres import PostgresStorage
from neutralis.venues.kalshi_client import KalshiClient
from neutralis.venues.kalshi_normalize import normalize_market as kalshi_normalize
from neutralis.venues.market_cache import MarketCache
from neutralis.venues.polymarket_client import PolymarketClient
from neutralis.venues.polymarket_normalize import normalize_market as poly_normalize

logger = get_logger("pipeline")

# Module-level state that persists across run_once() calls in daemon mode
_market_cache: MarketCache | None = None


@dataclass(frozen=True)
class RunStats:
    duration_ms: float = 0.0
    kalshi_markets: int = 0
    poly_markets: int = 0
    complement_signals: int = 0
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
    orders_created: int = 0
    fills_created: int = 0


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


def _fetch_cached_kalshi(settings) -> list[dict]:
    """Fetch Kalshi markets with caching and incremental updates.

    Strategy:
    - First run: Fetch from priority series (~200-500 markets, ~10s), cache them.
    - Subsequent runs: Incremental via min_updated_ts (0-5 pages, <5s).
    - Every 5 min: Full series re-fetch to catch any gaps.

    NOTE: The general get_all_active_markets() is unreliable for cross-platform
    matching — Kalshi has >50k active markets and the 50-page cap (50k) misses
    tournament winner markets (soccer, politics) that are the main overlap with
    Polymarket.
    """
    filter_cfg = settings.market_filter

    with KalshiClient(settings.kalshi) as client:
        if _market_cache.is_empty or _market_cache.needs_full_refresh(
            filter_cfg.full_refresh_interval_sec
        ):
            # Targeted series fetch — fast and reliable
            all_raw = client.fetch_priority_series(filter_cfg.priority_series)
            _market_cache.update_bulk(all_raw)
            _market_cache.mark_full_refresh()
            logger.info(
                "Priority series cache load: %d markets cached",
                _market_cache.size,
            )
        elif filter_cfg.incremental_updates and _market_cache.last_update_epoch > 0:
            # Incremental: only recently changed markets
            updated = client.get_markets_updated_since(_market_cache.last_update_epoch)
            # Add active markets, remove settled/closed from cache
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


def run_once(run_number: int = 0) -> RunStats:
    base_settings = load_settings()

    # Generate tick context for idempotency
    tick_ts = datetime.now(timezone.utc)
    tick_id = f"tick_{run_number}_{tick_ts.strftime('%Y-%m-%dT%H:%MZ')}"
    tick_ctx = TickContext(tick_id=tick_id, run_number=run_number, timestamp=tick_ts)
    category_overrides = None
    with PostgresStorage(base_settings.db) as profile_storage:
        settings = load_settings_with_profile(profile_storage)
        profile = load_active_profile(profile_storage)
        if profile and profile.category_overrides:
            category_overrides = profile.category_overrides
    notifier = DiscordNotifier(settings.alerts)
    start = time.monotonic()

    # Step 0: Settle resolved positions before scanning
    logger.info("Step 0: Checking for resolved markets")
    settlement = run_settlement(settings, notifier=notifier)

    # Step 0b: Mark open positions to market (unrealized P&L)
    logger.info("Step 0b: Marking positions to market")
    with PostgresStorage(settings.db) as mtm_storage:
        mtm_portfolio = PortfolioManager(mtm_storage, settings.portfolio)
        marked_positions = mtm_portfolio.mark_to_market(settings)

    # Step 0c: Evaluate exit strategies for open positions
    exit_count = 0
    exit_pnl = 0.0
    if settings.exits.enabled:
        logger.info("Step 0c: Evaluating exit strategies")
        with PostgresStorage(settings.db) as exit_storage:
            exit_portfolio = PortfolioManager(exit_storage, settings.portfolio)
            exits = exit_portfolio.evaluate_exits(settings, settings.exits)
            for pos, reason, price in exits:
                closed = exit_portfolio.execute_exit(pos, reason, price)
                exit_count += 1
                exit_pnl += closed.realized_pnl
                notifier.notify_exit(
                    ticker=pos.ticker,
                    side=pos.side.value,
                    venue=pos.venue,
                    exit_reason=reason,
                    exit_price=price,
                    pnl=closed.realized_pnl,
                )
            if exit_count > 0:
                logger.info("Exits: %d positions closed, P&L=$%.2f", exit_count, exit_pnl)

    # Step 1a: Fetch active markets from Kalshi (filtered if cache available)
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
    complement_signals = scan_complement_arb(kalshi_markets, settings.pipeline)

    # Step 3b: Cross-platform matching
    logger.info("Step 3b: Matching markets across venues")
    pairs = match_markets(kalshi_markets, poly_markets, settings.matching)

    # Step 3c: Cross-platform signal scan
    logger.info("Step 3c: Scanning matched pairs for price discrepancies")
    xp_signals = scan_cross_platform(pairs, settings.matching)

    # Alert on signals found
    if complement_signals or xp_signals:
        notifier.notify_signals(len(complement_signals), len(xp_signals), len(pairs))

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

    # Step 4: Score, evaluate, rank, and store
    logger.info("Step 4: Scoring and evaluating signals")
    with PostgresStorage(settings.db) as storage:
        portfolio = PortfolioManager(storage, settings.portfolio)

        # Save regime state and disagreement
        storage.save_regime_state(regime, regime_metrics, regime_params)
        if di_sample > 0:
            storage.save_disagreement_index(di_overall, di_by_category, di_sample)

        # Snapshot portfolio state once — all signals evaluated against same baseline
        portfolio_snapshot = portfolio.get_snapshot()
        logger.info(
            "Portfolio baseline: %d open, $%.2f exposure",
            portfolio_snapshot.open_position_count,
            portfolio_snapshot.total_exposure_dollars,
        )

        # Set up live executor if enabled
        live_executor = None
        if settings.execution.live_trading_enabled and settings.execution.kalshi_api_key_id:
            try:
                from neutralis.execution.kalshi import KalshiExecutor
                live_executor = KalshiExecutor(settings.kalshi, settings.execution)
                balance = live_executor.get_balance()
                if balance < settings.execution.balance_floor_dollars:
                    logger.warning(
                        "Kalshi balance $%.2f below floor $%.2f, falling back to paper",
                        balance, settings.execution.balance_floor_dollars,
                    )
                    live_executor.close()
                    live_executor = None
                else:
                    logger.info("Live execution enabled: Kalshi balance $%.2f", balance)
            except Exception:
                logger.warning("Failed to initialize Kalshi executor, falling back to paper", exc_info=True)
                live_executor = None

        # Build unified list of (scored_signal, market) pairs
        signal_market_pairs: list[tuple[Signal, NormalizedMarket]] = []

        # 4a: Score complement arb signals
        for signal in complement_signals:
            market = enriched_markets.get(signal.ticker, signal.market_snapshot)
            if market is None:
                continue
            scored = _score_signal(signal, market, storage)
            signal_market_pairs.append((scored, market))

        # 4b: Store cross-platform matches and score xp signals
        match_ids: dict[str, int] = {}
        for pair in pairs:
            k_snap = storage.save_market_snapshot(pair.kalshi_market)
            p_snap = storage.save_market_snapshot(pair.polymarket_market)
            mid = storage.save_market_match(pair, k_snap, p_snap)
            key = f"{pair.kalshi_market.ticker}:{pair.polymarket_market.ticker}"
            match_ids[key] = mid

        for signal in xp_signals:
            xp = signal.cross_platform
            if xp is None:
                continue
            key = f"{xp.kalshi_ticker}:{xp.polymarket_id}"
            mid = match_ids.get(key)
            storage.save_cross_platform_signal(signal, match_id=mid)

            market = signal.market_snapshot
            if market is None:
                continue
            match_conf = xp.match_confidence if xp else None
            scored = _score_signal(signal, market, storage, match_score=match_conf)
            signal_market_pairs.append((scored, market))

        # 4c: Evaluate all signals through guard (provisional)
        provisional: list[tuple[Signal, Decision]] = []
        snapshot_ids: dict[str, int] = {}  # signal_id -> snapshot_id
        pass_count = 0
        reject_count = 0

        for scored_signal, market in signal_market_pairs:
            snap_id = storage.save_market_snapshot(market)
            storage.save_signal(scored_signal, snapshot_id=snap_id)
            snapshot_ids[scored_signal.id] = snap_id

            decision = evaluate_signal(
                scored_signal, market, pipeline_cfg,
                portfolio_snapshot=portfolio_snapshot,
                portfolio_config=settings.portfolio,
                category_overrides=category_overrides,
            )
            provisional.append((scored_signal, decision))
            if decision.verdict == DecisionVerdict.PASS:
                pass_count += 1
            else:
                reject_count += 1

        # 4d: Ranked selection — pick the best signals that fit
        ranked = select_portfolio(
            provisional,
            portfolio_snapshot,
            portfolio_config=settings.portfolio,
            min_confidence=min_confidence,
        )

        # 4e: Save decisions and fill only selected (via PaperExecutor)
        paper_executor = PaperExecutor(storage, portfolio)
        selected_count = 0
        total_orders = 0
        total_fills = 0
        for signal, decision in ranked:
            decision_id = storage.save_decision(decision)

            if decision.verdict == DecisionVerdict.PASS and decision.selected:
                selected_count += 1

                # Attempt live Kalshi execution if enabled
                live_results = None
                if live_executor is not None:
                    kalshi_only = all(
                        (leg.venue or "kalshi") == "kalshi" for leg in signal.legs
                    )
                    if kalshi_only:
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
                                resp = live_executor.place_order(
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
                    # Live execution succeeded — record via portfolio directly
                    portfolio.record_fill(
                        signal, decision, decision_id,
                        is_paper=False, execution_results=live_results,
                    )
                else:
                    # Paper execution — use PaperExecutor with slippage simulation
                    market = enriched_markets.get(signal.ticker, signal.market_snapshot)
                    exec_result = paper_executor.execute(
                        signal, decision, decision_id, tick_ctx, market=market,
                    )
                    total_orders += len(exec_result.orders)
                    total_fills += len(exec_result.fills)
                portfolio_snapshot = portfolio.get_snapshot()
                for leg in signal.legs:
                    notifier.notify_fill(
                        ticker=leg.ticker,
                        side=leg.side,
                        venue=leg.venue or signal.legs[0].venue or "kalshi",
                        size=leg.quantity_dollars,
                        price=leg.price_dollars,
                    )

        # 4f: Portfolio summary
        snapshot = portfolio.get_snapshot()
        logger.info(
            "Portfolio: %d open positions, $%.2f total exposure",
            snapshot.open_position_count,
            snapshot.total_exposure_dollars,
        )

    if live_executor is not None:
        live_executor.close()

    elapsed = (time.monotonic() - start) * 1000
    logger.info(
        "Pipeline complete: %d complement arb, %d cross-platform, %d matches, "
        "%d pass (%d selected), %d reject, regime=%s, %.0fms",
        len(complement_signals),
        len(xp_signals),
        len(pairs),
        pass_count,
        selected_count,
        reject_count,
        regime,
        elapsed,
        extra={"duration_ms": elapsed},
    )

    stats = RunStats(
        duration_ms=elapsed,
        kalshi_markets=len(kalshi_markets),
        poly_markets=len(poly_markets),
        complement_signals=len(complement_signals),
        cross_platform_signals=len(xp_signals),
        matches=len(pairs),
        decisions_pass=pass_count,
        decisions_reject=reject_count,
        decisions_selected=selected_count,
        open_positions=snapshot.open_position_count,
        total_exposure=snapshot.total_exposure_dollars,
        positions_settled=settlement.settled,
        settlement_pnl=settlement.pnl,
        marked_positions=marked_positions,
        exits_triggered=exit_count,
        exit_pnl=exit_pnl,
        regime=regime,
        disagreement_index=di_overall,
        orders_created=total_orders,
        fills_created=total_fills,
    )

    # Alert if anything interesting happened
    if selected_count > 0 or settlement.settled > 0 or exit_count > 0:
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
