"""Guard evaluator -- runs all constraints and produces a Decision."""

from __future__ import annotations

from neutralis.config import PipelineConfig
from neutralis.guard.constraints import (
    check_liquidity,
    check_min_edge,
    check_orderbook_depth,
    check_time_to_expiry,
)
from neutralis.guard.sizing import compute_size
from neutralis.logging import get_logger
from neutralis.models import (
    Decision,
    DecisionVerdict,
    NormalizedMarket,
    Signal,
)

logger = get_logger(__name__)


def evaluate_signal(
    signal: Signal,
    market: NormalizedMarket,
    config: PipelineConfig | None = None,
) -> Decision:
    """Run all guard checks on a signal and produce a Decision."""
    cfg = config or PipelineConfig()

    results = (
        check_min_edge(signal.edge_pct, cfg),
        check_liquidity(market, cfg),
        check_time_to_expiry(market, cfg),
        check_orderbook_depth(market),
    )

    all_passed = all(r.passed for r in results)

    if all_passed:
        suggested_size = compute_size(signal, market, cfg)
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
