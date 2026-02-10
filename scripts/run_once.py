#!/usr/bin/env python3
"""Single-pass pipeline: fetch -> normalize -> scan -> match -> store."""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.alerts.discord import DiscordNotifier
from neutralis.config import load_settings
from neutralis.core.cross_scanner import scan_cross_platform
from neutralis.core.matcher import match_markets
from neutralis.core.scanners import scan_complement_arb
from neutralis.guard.decision import evaluate_signal
from neutralis.logging import get_logger
from neutralis.models import DecisionVerdict, MarketType, NormalizedMarket
from neutralis.portfolio.manager import PortfolioManager
from neutralis.settlement.settler import run_settlement
from neutralis.storage.postgres import PostgresStorage
from neutralis.venues.kalshi_client import KalshiClient
from neutralis.venues.kalshi_normalize import normalize_market as kalshi_normalize
from neutralis.venues.polymarket_client import PolymarketClient
from neutralis.venues.polymarket_normalize import normalize_market as poly_normalize

logger = get_logger("pipeline")


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
    open_positions: int = 0
    total_exposure: float = 0.0
    positions_settled: int = 0
    settlement_pnl: float = 0.0


def run_once() -> RunStats:
    settings = load_settings()
    notifier = DiscordNotifier(settings.alerts)
    start = time.monotonic()

    # Step 0: Settle resolved positions before scanning
    logger.info("Step 0: Checking for resolved markets")
    settlement = run_settlement(settings, notifier=notifier)

    # Step 1a: Fetch active markets from Kalshi
    logger.info("Step 1a: Fetching active markets from Kalshi")
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

    # Step 4: Store everything
    logger.info("Step 4: Storing results")
    with PostgresStorage(settings.db) as storage:
        portfolio = PortfolioManager(storage, settings.portfolio)

        # Snapshot portfolio state once — all signals evaluated against same baseline
        portfolio_snapshot = portfolio.get_snapshot()
        logger.info(
            "Portfolio baseline: %d open, $%.2f exposure",
            portfolio_snapshot.open_position_count,
            portfolio_snapshot.total_exposure_dollars,
        )

        # 4a: Complement arb signals + guard decisions + portfolio
        pass_count = 0
        reject_count = 0

        for signal in complement_signals:
            market = enriched_markets.get(signal.ticker, signal.market_snapshot)
            if market is None:
                continue
            snapshot_id = storage.save_market_snapshot(market)
            storage.save_signal(signal, snapshot_id=snapshot_id)
            decision = evaluate_signal(
                signal, market, settings.pipeline,
                portfolio_snapshot=portfolio_snapshot,
                portfolio_config=settings.portfolio,
            )
            decision_id = storage.save_decision(decision)

            if decision.verdict == DecisionVerdict.PASS:
                pass_count += 1
                portfolio.record_fill(signal, decision, decision_id)
                for leg in signal.legs:
                    notifier.notify_fill(
                        ticker=leg.ticker,
                        side=leg.side,
                        venue=leg.venue or "kalshi",
                        size=leg.quantity_dollars,
                        price=leg.price_dollars,
                    )
            else:
                reject_count += 1

        # 4b: Cross-platform matches and signals
        # Build a lookup from ticker to snapshot_id for signal storage
        match_ids: dict[str, int] = {}  # "kalshi_ticker:poly_ticker" -> match_id
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

        # 4c: Evaluate cross-platform signals through Guard
        for signal in xp_signals:
            market = signal.market_snapshot
            if market is None:
                continue
            decision = evaluate_signal(
                signal, market, settings.pipeline,
                portfolio_snapshot=portfolio_snapshot,
                portfolio_config=settings.portfolio,
            )
            decision_id = storage.save_decision(decision)
            if decision.verdict == DecisionVerdict.PASS:
                pass_count += 1
                portfolio.record_fill(signal, decision, decision_id)
                for leg in signal.legs:
                    notifier.notify_fill(
                        ticker=leg.ticker,
                        side=leg.side,
                        venue=leg.venue or signal.venue,
                        size=leg.quantity_dollars,
                        price=leg.price_dollars,
                    )
            else:
                reject_count += 1

        # 4d: Portfolio summary
        snapshot = portfolio.get_snapshot()
        logger.info(
            "Portfolio: %d open positions, $%.2f total exposure",
            snapshot.open_position_count,
            snapshot.total_exposure_dollars,
        )

    elapsed = (time.monotonic() - start) * 1000
    logger.info(
        "Pipeline complete: %d complement arb, %d cross-platform, %d matches, "
        "%d pass, %d reject, %.0fms",
        len(complement_signals),
        len(xp_signals),
        len(pairs),
        pass_count,
        reject_count,
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
        open_positions=snapshot.open_position_count,
        total_exposure=snapshot.total_exposure_dollars,
        positions_settled=settlement.settled,
        settlement_pnl=settlement.pnl,
    )

    # Alert if anything interesting happened
    if pass_count > 0 or settlement.settled > 0:
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
