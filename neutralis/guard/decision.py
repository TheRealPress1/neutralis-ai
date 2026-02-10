"""Guard evaluator -- runs all constraints and produces a Decision."""

from __future__ import annotations

from typing import Any

from neutralis.categories import classify_market, is_category_enabled, resolve_pipeline_config
from neutralis.config import PipelineConfig, PortfolioConfig
from neutralis.guard.constraints import (
    check_category_exposure,
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
    category_overrides: dict[str, Any] | None = None,
) -> Decision:
    """Run all guard checks on a signal and produce a Decision.

    When portfolio_snapshot is provided, runs portfolio-aware checks.
    When category_overrides is provided, applies per-category risk tuning.
    """
    cfg = config or PipelineConfig()

    # Phase 0: Category classification and override checks
    category = classify_market(market.title, market.event_ticker)

    if category_overrides:
        # Reject if category is disabled
        if not is_category_enabled(category, category_overrides):
            logger.info(
                "Decision: signal=%s REJECTED — category '%s' disabled",
                signal.id, category,
            )
            return Decision(
                signal_id=signal.id,
                verdict=DecisionVerdict.REJECT,
                guard_results=(GuardResult(
                    guard_name="category_disabled",
                    passed=False,
                    reason=f"category '{category}' is disabled in active profile",
                ),),
            )
        # Adjust config thresholds for this category's risk level
        cfg = resolve_pipeline_config(cfg, category, category_overrides)

    # Phase 1: Market-level checks
    market_results: list[GuardResult] = [
        check_min_edge(signal.edge_pct, cfg),
        check_liquidity(market, cfg),
        check_time_to_expiry(market, cfg),
        check_orderbook_depth(market),
    ]

    # Phase 2: Portfolio-level checks (only when snapshot provided)
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

        # Per-category exposure guard
        if category_overrides:
            portfolio_results.append(
                check_category_exposure(
                    preliminary_size, category, category_overrides, portfolio_snapshot,
                )
            )

    results = tuple(market_results + portfolio_results)
    all_passed = all(r.passed for r in results)

    if all_passed:
        suggested_size = compute_size(
            signal, market, cfg,
            portfolio_snapshot=portfolio_snapshot,
            portfolio_config=portfolio_config,
            category=category,
            category_overrides=category_overrides,
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
        "Decision: signal=%s category=%s verdict=%s size=$%.2f guards=%d/%d passed",
        signal.id,
        category,
        verdict.value,
        suggested_size,
        sum(1 for r in results if r.passed),
        len(results),
        extra={"signal_id": signal.id},
    )

    return decision
