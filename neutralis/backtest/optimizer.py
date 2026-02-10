"""Grid-search optimizer over scoring weight space."""

from __future__ import annotations

import math
from typing import Any, Callable

from neutralis.backtest.engine import BacktestResult, run_backtest
from neutralis.logging import get_logger

logger = get_logger(__name__)

# The six scoring weight keys
WEIGHT_KEYS = [
    "edge_robustness",
    "liquidity_robustness",
    "price_stability",
    "spread_health",
    "time_efficiency",
    "match_confidence",
]


def generate_weight_combinations(
    step: float = 0.10,
    min_weight: float = 0.05,
    max_combos: int = 100,
) -> list[dict[str, float]]:
    """Generate weight combos that sum to 1.0 within constraints.

    Each weight is in [min_weight, 1.0 - (N-1)*min_weight] at `step` increments.
    Caps at max_combos by increasing step if needed.
    """
    combos: list[dict[str, float]] = []
    n = len(WEIGHT_KEYS)
    floor = round(min_weight, 4)

    def _recurse(idx: int, remaining: float, current: list[float]) -> None:
        if len(combos) >= max_combos:
            return
        if idx == n - 1:
            # Last weight gets whatever is left
            w = round(remaining, 4)
            if w >= floor:
                combos.append(dict(zip(WEIGHT_KEYS, current + [w])))
            return
        # Range for this weight
        max_w = remaining - (n - idx - 1) * floor
        w = floor
        while w <= max_w + 1e-9:
            if len(combos) >= max_combos:
                return
            _recurse(idx + 1, round(remaining - w, 4), current + [round(w, 4)])
            w = round(w + step, 4)

    _recurse(0, 1.0, [])

    # If we got too few combos, that's fine — return what we have
    logger.info("Generated %d weight combinations (step=%.2f)", len(combos), step)
    return combos


def compute_objective(result: BacktestResult, objective: str) -> float:
    """Score a backtest result by the chosen objective function."""
    if objective == "total_pnl":
        return result.total_pnl

    if objective == "sharpe_ratio":
        return _sharpe_from_equity(result.equity_curve)

    if objective == "profit_factor":
        wins = sum(c["realized_pnl"] for c in result.closed_positions if c["realized_pnl"] > 0)
        losses = abs(sum(c["realized_pnl"] for c in result.closed_positions if c["realized_pnl"] <= 0))
        return wins / losses if losses > 0 else wins if wins > 0 else 0.0

    if objective == "composite":
        pnl = result.total_pnl
        wr = result.win_rate * 100
        sharpe = _sharpe_from_equity(result.equity_curve)
        return 0.4 * pnl + 0.3 * wr + 0.3 * sharpe * 10

    return 0.0


def _sharpe_from_equity(equity_curve: list[dict]) -> float:
    """Compute annualized Sharpe ratio from daily equity points."""
    if len(equity_curve) < 2:
        return 0.0

    daily_returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i - 1]["realized_pnl"]
        curr = equity_curve[i]["realized_pnl"]
        daily_returns.append(curr - prev)

    if not daily_returns:
        return 0.0

    mean_r = sum(daily_returns) / len(daily_returns)
    if len(daily_returns) < 2:
        return 0.0

    variance = sum((r - mean_r) ** 2 for r in daily_returns) / (len(daily_returns) - 1)
    std_r = math.sqrt(variance) if variance > 0 else 0.0

    if std_r == 0:
        return mean_r * math.sqrt(252) if mean_r > 0 else 0.0

    return (mean_r / std_r) * math.sqrt(252)


def run_optimization(
    start_date: str,
    end_date: str,
    objective: str = "total_pnl",
    step_size: float = 0.10,
    max_combos: int = 50,
    top_n: int = 10,
    pipeline_overrides: dict[str, Any] | None = None,
    portfolio_overrides: dict[str, Any] | None = None,
    matching_overrides: dict[str, Any] | None = None,
    exit_overrides: dict[str, Any] | None = None,
    progress_callback: Callable[[int, int], None] | None = None,
) -> list[dict[str, Any]]:
    """Run grid search over scoring weights, return top N results.

    Args:
        start_date: Backtest start date.
        end_date: Backtest end date.
        objective: Objective function name.
        step_size: Weight increment step.
        max_combos: Maximum weight combinations to test.
        top_n: Return top N results.
        progress_callback: Called with (completed, total) after each run.

    Returns:
        List of dicts sorted by objective value (descending), each with:
        rank, objective_value, total_pnl, win_rate, sharpe_ratio, total_trades, weights
    """
    combos = generate_weight_combinations(
        step=step_size,
        min_weight=0.05,
        max_combos=max_combos,
    )

    if not combos:
        return []

    total = len(combos)
    scored: list[tuple[float, BacktestResult, dict[str, float]]] = []

    for i, weights in enumerate(combos):
        logger.info("Optimizer: running combo %d/%d", i + 1, total)
        try:
            result = run_backtest(
                start_date=start_date,
                end_date=end_date,
                pipeline_overrides=pipeline_overrides,
                portfolio_overrides=portfolio_overrides,
                matching_overrides=matching_overrides,
                exit_overrides=exit_overrides,
                scoring_weights=weights,
            )
            obj_value = compute_objective(result, objective)
            scored.append((obj_value, result, weights))
        except Exception:
            logger.warning("Optimizer: combo %d failed, skipping", i + 1, exc_info=True)

        if progress_callback:
            progress_callback(i + 1, total)

    # Sort by objective descending
    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    for rank, (obj_value, result, weights) in enumerate(scored[:top_n], 1):
        results.append({
            "rank": rank,
            "objective_value": round(obj_value, 4),
            "total_pnl": round(result.total_pnl, 4),
            "win_rate": round(result.win_rate, 4),
            "sharpe_ratio": round(_sharpe_from_equity(result.equity_curve), 4),
            "total_trades": result.total_trades,
            "weights": {k: round(v, 4) for k, v in weights.items()},
        })

    return results
