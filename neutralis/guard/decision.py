"""Guard evaluator -- runs all constraints and produces a Decision."""

from __future__ import annotations

from typing import Any

from neutralis.categories import classify_market, is_category_enabled, resolve_pipeline_config
from neutralis.config import DirectionalConfig, PipelineConfig, PortfolioConfig
from neutralis.guard.constraints import (
    check_category_exposure,
    check_duplicate_position,
    check_event_exposure,
    check_liquidity,
    check_min_edge,
    check_min_implied_probability,
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

    # Preliminary size for depth check and exposure checks (base sizing, no headroom)
    preliminary_size = compute_size(signal, market, cfg)

    # Phase 1: Market-level checks
    market_results: list[GuardResult] = [
        check_min_edge(signal.edge_pct, cfg, cross_platform=signal.cross_platform),
        check_liquidity(market, cfg),
        check_time_to_expiry(market, cfg),
        check_orderbook_depth(market, position_size=preliminary_size),
    ]

    # Phase 2: Portfolio-level checks (only when snapshot provided)
    portfolio_results: list[GuardResult] = []
    if portfolio_snapshot is not None:
        pcfg = portfolio_config or PortfolioConfig()

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


def evaluate_directional_signal(
    signal: Signal,
    market: NormalizedMarket,
    config: DirectionalConfig,
    portfolio_snapshot: PortfolioSnapshot | None = None,
) -> Decision:
    """Run guard checks on a directional signal and produce a Decision.

    Uses DirectionalConfig for sizing and portfolio limits, with an
    isolated portfolio snapshot (directional positions only).
    """
    # Phase 1: Directional-specific checks
    results: list[GuardResult] = [
        check_min_implied_probability(signal, config.min_implied_probability),
        check_duplicate_position(signal, portfolio_snapshot or PortfolioSnapshot()),
    ]

    # Position sizing — use directional config limits
    size = min(config.max_position_dollars, market.liquidity * 0.20)
    if size < 1.0:
        size = 0.0

    # Phase 2: Portfolio-level checks against directional-only snapshot
    if portfolio_snapshot is not None:
        # Build a PortfolioConfig from DirectionalConfig for reuse of existing guards
        pcfg = PortfolioConfig(
            max_total_exposure_dollars=config.max_total_exposure_dollars,
            max_event_exposure_dollars=config.max_event_exposure_dollars,
            max_ticker_exposure_dollars=config.max_ticker_exposure_dollars,
            max_open_positions=config.max_open_positions,
        )
        results.extend([
            check_open_position_count(portfolio_snapshot, pcfg),
            check_total_exposure(size, portfolio_snapshot, pcfg),
            check_event_exposure(size, signal.event_ticker, portfolio_snapshot, pcfg),
            check_ticker_exposure(size, signal.ticker, portfolio_snapshot, pcfg),
        ])

        # Clamp size to headroom
        total_headroom = config.max_total_exposure_dollars - portfolio_snapshot.total_exposure_dollars
        size = min(size, max(total_headroom, 0.0))

        event_current = dict(portfolio_snapshot.event_exposure).get(signal.event_ticker, 0.0)
        event_headroom = config.max_event_exposure_dollars - event_current
        size = min(size, max(event_headroom, 0.0))

        ticker_current = sum(
            p.size_dollars for p in portfolio_snapshot.positions if p.ticker == signal.ticker
        )
        ticker_headroom = config.max_ticker_exposure_dollars - ticker_current
        size = min(size, max(ticker_headroom, 0.0))

    if size < 1.0:
        size = 0.0

    all_results = tuple(results)
    all_passed = all(r.passed for r in all_results)

    if all_passed and size > 0:
        verdict = DecisionVerdict.PASS
        suggested_size = round(size, 2)
    else:
        verdict = DecisionVerdict.REJECT
        suggested_size = 0.0

    decision = Decision(
        signal_id=signal.id,
        verdict=verdict,
        guard_results=all_results,
        suggested_size_dollars=suggested_size,
    )

    logger.info(
        "Directional decision: signal=%s verdict=%s size=$%.2f guards=%d/%d passed",
        signal.id, verdict.value, suggested_size,
        sum(1 for r in all_results if r.passed), len(all_results),
    )

    return decision


# ---------------------------------------------------------------------------
# Ranked selection (alpha vNext)
# ---------------------------------------------------------------------------


def select_portfolio(
    decisions: list[tuple[Signal, Decision]],
    portfolio_snapshot: PortfolioSnapshot,
    portfolio_config: PortfolioConfig | None = None,
    min_confidence: int = 0,
) -> list[tuple[Signal, Decision]]:
    """Rank approved decisions by selection_score and greedily select
    the best subset that fits within portfolio constraints.

    Each provisional PASS decision gets:
    - selection_score = roi_per_day * confidence_score / 100
    - selected = True if it fits within constraints

    Non-PASS decisions are passed through unchanged.

    Args:
        decisions: List of (signal, decision) pairs from evaluate_signal.
        portfolio_snapshot: Current portfolio state.
        portfolio_config: Portfolio limits.
        min_confidence: Minimum confidence score required (from regime).

    Returns:
        Updated list of (signal, decision) with selected flags set.
    """
    pcfg = portfolio_config or PortfolioConfig()

    # Separate PASS and non-PASS
    candidates: list[tuple[Signal, Decision, float]] = []
    results: list[tuple[Signal, Decision]] = []

    for signal, decision in decisions:
        if decision.verdict != DecisionVerdict.PASS:
            results.append((signal, decision))
            continue

        # Compute selection score
        confidence = signal.confidence_score
        roi = signal.roi_per_day
        sel_score = roi * confidence / 100.0 if confidence > 0 else 0.0

        # Reject if below regime confidence minimum
        if confidence < min_confidence:
            updated = Decision(
                signal_id=decision.signal_id,
                verdict=DecisionVerdict.REJECT,
                guard_results=decision.guard_results + (
                    GuardResult(
                        guard_name="regime_confidence",
                        passed=False,
                        reason=f"confidence {confidence} < regime min {min_confidence}",
                        value=float(confidence),
                        threshold=float(min_confidence),
                    ),
                ),
                suggested_size_dollars=0.0,
                selected=False,
                selection_score=sel_score,
                allocation_reasons=("below regime confidence minimum",),
            )
            results.append((signal, updated))
            continue

        candidates.append((signal, decision, sel_score))

    # Sort by selection score descending
    candidates.sort(key=lambda c: c[2], reverse=True)

    # Greedy allocation
    used_exposure = portfolio_snapshot.total_exposure_dollars
    used_positions = portfolio_snapshot.open_position_count
    used_events: dict[str, float] = dict(portfolio_snapshot.event_exposure)
    used_tickers: set[str] = set()
    for p in portfolio_snapshot.positions:
        used_tickers.add(p.ticker)

    selected_count = 0

    for signal, decision, sel_score in candidates:
        size = decision.suggested_size_dollars
        reasons: list[str] = []

        # Check constraints
        if used_positions >= pcfg.max_open_positions:
            reasons.append("max open positions reached")
        if used_exposure + size > pcfg.max_total_exposure_dollars:
            reasons.append("total exposure budget exhausted")

        event_exp = used_events.get(signal.event_ticker, 0.0)
        if event_exp + size > pcfg.max_event_exposure_dollars:
            reasons.append(f"event '{signal.event_ticker}' cap reached")

        if reasons:
            updated = Decision(
                signal_id=decision.signal_id,
                verdict=DecisionVerdict.PASS,
                guard_results=decision.guard_results,
                suggested_size_dollars=decision.suggested_size_dollars,
                selected=False,
                selection_score=sel_score,
                allocation_reasons=tuple(reasons),
            )
            results.append((signal, updated))
            continue

        # Selected
        updated = Decision(
            signal_id=decision.signal_id,
            verdict=DecisionVerdict.PASS,
            guard_results=decision.guard_results,
            suggested_size_dollars=decision.suggested_size_dollars,
            selected=True,
            selection_score=sel_score,
            allocation_reasons=("selected",),
        )
        results.append((signal, updated))
        selected_count += 1

        # Update running totals
        used_exposure += size
        used_positions += 1
        used_events[signal.event_ticker] = event_exp + size

    logger.info(
        "Ranked selection: %d candidates, %d selected, %d dropped",
        len(candidates), selected_count, len(candidates) - selected_count,
    )

    return results
