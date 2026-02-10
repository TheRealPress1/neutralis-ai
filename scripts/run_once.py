#!/usr/bin/env python3
"""Single-pass pipeline: fetch -> normalize -> scan -> guard -> store."""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.config import load_settings
from neutralis.core.scanners import scan_complement_arb
from neutralis.guard.decision import evaluate_signal
from neutralis.logging import get_logger
from neutralis.models import MarketType, NormalizedMarket
from neutralis.storage.postgres import PostgresStorage
from neutralis.venues.kalshi_client import KalshiClient
from neutralis.venues.kalshi_normalize import normalize_market

logger = get_logger("pipeline")


def run_once() -> None:
    settings = load_settings()
    start = time.monotonic()

    # Step 1: Fetch active markets
    logger.info("Step 1: Fetching active markets from Kalshi")
    with KalshiClient(settings.kalshi) as client:
        raw_markets = client.get_all_active_markets()

        # Step 2: Normalize (binary only)
        logger.info("Step 2: Normalizing %d raw markets", len(raw_markets))
        markets: list[NormalizedMarket] = []
        for raw in raw_markets:
            m = normalize_market(raw)
            if m is not None and m.market_type == MarketType.BINARY:
                markets.append(m)

        logger.info("Normalized %d binary markets", len(markets))

        # Step 3: Scan for complement arb
        logger.info("Step 3: Running complement arb scanner")
        signals = scan_complement_arb(markets, settings.pipeline)

        if not signals:
            logger.info("No signals found. Pipeline complete.")
            elapsed = (time.monotonic() - start) * 1000
            logger.info("Duration: %.0fms", elapsed, extra={"duration_ms": elapsed})
            return

        logger.info("Found %d signals", len(signals))

        # Step 3b: Fetch orderbooks for signal markets (enrichment)
        logger.info("Step 3b: Fetching orderbooks for %d signal markets", len(signals))
        enriched_markets: dict[str, NormalizedMarket] = {}
        for signal in signals:
            if signal.ticker not in enriched_markets:
                raw_market = next(
                    (r for r in raw_markets if r.get("ticker") == signal.ticker),
                    None,
                )
                if raw_market:
                    ob_raw = client.get_orderbook(signal.ticker)
                    enriched = normalize_market(raw_market, ob_raw)
                    if enriched:
                        enriched_markets[signal.ticker] = enriched

    # Step 4: Guard + Store
    logger.info("Step 4: Evaluating signals through guards and storing")
    with PostgresStorage(settings.db) as storage:
        for signal in signals:
            market = enriched_markets.get(signal.ticker, signal.market_snapshot)
            if market is None:
                continue

            snapshot_id = storage.save_market_snapshot(market)
            storage.save_signal(signal, snapshot_id=snapshot_id)
            decision = evaluate_signal(signal, market, settings.pipeline)
            storage.save_decision(decision)

    elapsed = (time.monotonic() - start) * 1000
    logger.info(
        "Pipeline complete: %d signals, %.0fms",
        len(signals),
        elapsed,
        extra={"duration_ms": elapsed},
    )


if __name__ == "__main__":
    try:
        run_once()
    except KeyboardInterrupt:
        logger.info("Interrupted")
    except Exception:
        logger.exception("Pipeline failed")
        sys.exit(1)
