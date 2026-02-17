"""Guard evaluator -- runs all constraints and produces a Decision.

Includes kill switch and daily loss limit checks (v3).
"""

from __future__ import annotations

from neutralis.config import PipelineConfig, PortfolioConfig
from neutralis.guard.constraints import (
    check_automation_active,
    check_daily_loss_limit,
    check_duplicate_position,
    check_event_exposure,
    check_kill_switch,
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
    *,
    automation_active: bool = True,
    kill_switch_engaged: bool = False,
    daily_loss: float = 0.0,
) -> Decision:
    """Run all guard checks on a signal and produce a Decision.

    Phase 0 (v3): Automation + kill switch + daily loss safety checks.
    Phase 1 (v1): Market-level checks (edge, liquidity, expiry, depth).
    Phase 2 (v2): Portfolio-level checks (exposure, concentration, duplicates).
    """
    cfg = config or PipelineConfig()

    # Phase 0: Safety checks (v3 — kill switch, automation state)
    safety_results: list[GuardResult] = [
        check_automation_active(automation_active),
        check_kill_switch(kill_switch_engaged),
    ]

    # Phase 1: Market-level checks (v1, unchanged)
    market_results: list[GuardResult] = [
        check_min_edge(signal.edge_pct, cfg),
        check_liquidity(market, cfg),
        check_time_to_expiry(market, cfg),
        check_orderbook_depth(market),
    ]

    # Phase 2: Portfolio-level checks (v2 + v3 daily loss)
    portfolio_results: list[GuardResult] = []
    if portfolio_snapshot is not None:
        pcfg = portfolio_config or PortfolioConfig()

        # Preliminary size for exposure checks (v1 sizing, no headroom)
        preliminary_size = compute_size(signal, market, cfg)

        portfolio_results = [
            check_daily_loss_limit(daily_loss, pcfg),
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

    results = tuple(safety_results + market_results + portfolio_results)
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
