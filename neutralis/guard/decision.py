"""Guard evaluator -- runs all constraints and produces a Decision."""

from __future__ import annotations

from neutralis.config import PipelineConfig, PortfolioConfig
from neutralis.guard.constraints import (
    check_duplicate_position,
    check_event_exposure,
    check_liquidity,
    check_min_edge,
    check_open_position_count,
    check_orderbook_depth,
    check_ticker_exposure,
    check_time_to_expiry,
    check_total_exposure,
    check_venue_concentration,
)
from neutralis.guard.sizing import compute_size
from neutralis.logging import get_logger
from neutralis.models import (
    Decision,
    DecisionVerdict,
    GuardResult,
    NormalizedMarket,
    PortfolioSnapshot,
    Signal,
)

logger = get_logger(__name__)


def evaluate_signal(
    signal: Signal,
    market: NormalizedMarket,
    config: PipelineConfig | None = None,
    portfolio_snapshot: PortfolioSnapshot | None = None,
    portfolio_config: PortfolioConfig | None = None,
) -> Decision:
    """Run all guard checks on a signal and produce a Decision.

    When portfolio_snapshot is provided, runs 6 additional portfolio-aware
    checks on top of the 4 market-level checks (v1). Without it, behaves
    identically to Guard v1.
    """
    cfg = config or PipelineConfig()

    # Phase 1: Market-level checks (v1, unchanged)
    market_results: list[GuardResult] = [
        check_min_edge(signal.edge_pct, cfg),
        check_liquidity(market, cfg),
        check_time_to_expiry(market, cfg),
        check_orderbook_depth(market),
    ]

    # Phase 2: Portfolio-level checks (v2, only when snapshot provided)
    portfolio_results: list[GuardResult] = []
    if portfolio_snapshot is not None:
        pcfg = portfolio_config or PortfolioConfig()

        # Preliminary size for exposure checks (v1 sizing, no headroom)
        preliminary_size = compute_size(signal, market, cfg)

        portfolio_results = [
            check_open_position_count(portfolio_snapshot, pcfg),
            check_duplicate_position(signal, portfolio_snapshot),
            check_total_exposure(preliminary_size, portfolio_snapshot, pcfg),
            check_event_exposure(
                preliminary_size, signal.event_ticker, portfolio_snapshot, pcfg,
            ),
            check_ticker_exposure(
                preliminary_size, signal.ticker, portfolio_snapshot, pcfg,
            ),
            check_venue_concentration(
                preliminary_size, market.venue, portfolio_snapshot, pcfg,
            ),
        ]

    results = tuple(market_results + portfolio_results)
    all_passed = all(r.passed for r in results)

    if all_passed:
        suggested_size = compute_size(
            signal, market, cfg,
            portfolio_snapshot=portfolio_snapshot,
            portfolio_config=portfolio_config,
        )
        verdict = DecisionVerdict.PASS if suggested_size > 0 else DecisionVerdict.REJECT
    else:
        suggested_size = 0.0
        verdict = DecisionVerdict.REJECT

    decision = Decision(
        signal_id=signal.id,
        verdict=verdict,
        guard_results=results,
        suggested_size_dollars=suggested_size,
    )

    logger.info(
        "Decision: signal=%s verdict=%s size=$%.2f guards=%d/%d passed",
        signal.id,
        verdict.value,
        suggested_size,
        sum(1 for r in results if r.passed),
        len(results),
        extra={"signal_id": signal.id},
    )

    return decision
