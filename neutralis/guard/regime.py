"""Regime controller — adapts guard parameters based on market conditions.

Two-state model:
- NORMAL: standard parameters
- RISK_OFF: tightened parameters (higher edge threshold, smaller positions)

Regime is determined by market-wide aggregates each pipeline run.
"""

from __future__ import annotations

import statistics
from typing import Any

from neutralis.config import PipelineConfig, PortfolioConfig
from neutralis.logging import get_logger
from neutralis.models import NormalizedMarket

logger = get_logger(__name__)

# Thresholds for triggering RISK_OFF
_MEDIAN_SPREAD_RISK_OFF = 0.15  # median spread above this = thin markets
_MEDIAN_LIQUIDITY_RISK_OFF = 20.0  # median liquidity below this = dry market
_DISAGREEMENT_SPIKE = 0.20  # disagreement index above this = chaos


def compute_regime(
    markets: list[NormalizedMarket],
    disagreement: float = 0.0,
) -> tuple[str, dict[str, Any], dict[str, Any]]:
    """Determine the current market regime.

    Args:
        markets: All normalized markets from this pipeline run.
        disagreement: Disagreement index from cross-venue matching.

    Returns:
        (regime, metrics, derived_params)

        regime: "normal" or "risk_off"
        metrics: raw aggregates used for the decision
        derived_params: guard parameter overrides for this regime
    """
    if not markets:
        return "risk_off", {"reason": "no_markets"}, _risk_off_params()

    # Compute market-wide aggregates
    spreads: list[float] = []
    liquidities: list[float] = []

    for m in markets:
        if m.yes_ask > 0 and m.yes_bid > 0:
            spreads.append(m.yes_ask - m.yes_bid)
        if m.liquidity > 0:
            liquidities.append(m.liquidity)

    median_spread = statistics.median(spreads) if spreads else 0.5
    median_liquidity = statistics.median(liquidities) if liquidities else 0.0

    metrics = {
        "median_spread": round(median_spread, 6),
        "median_liquidity": round(median_liquidity, 2),
        "disagreement_index": round(disagreement, 6),
        "market_count": len(markets),
        "markets_with_spread": len(spreads),
        "markets_with_liquidity": len(liquidities),
    }

    # Decision logic
    risk_off_reasons: list[str] = []

    if median_spread > _MEDIAN_SPREAD_RISK_OFF:
        risk_off_reasons.append(
            f"median_spread={median_spread:.4f} > {_MEDIAN_SPREAD_RISK_OFF}"
        )

    if median_liquidity < _MEDIAN_LIQUIDITY_RISK_OFF and liquidities:
        risk_off_reasons.append(
            f"median_liquidity=${median_liquidity:.2f} < ${_MEDIAN_LIQUIDITY_RISK_OFF}"
        )

    if disagreement > _DISAGREEMENT_SPIKE:
        risk_off_reasons.append(
            f"disagreement={disagreement:.4f} > {_DISAGREEMENT_SPIKE}"
        )

    if risk_off_reasons:
        regime = "risk_off"
        metrics["risk_off_reasons"] = risk_off_reasons
        params = _risk_off_params()
        logger.warning("Regime: RISK_OFF — %s", "; ".join(risk_off_reasons))
    else:
        regime = "normal"
        params = _normal_params()
        logger.info("Regime: NORMAL")

    return regime, metrics, params


def _normal_params() -> dict[str, Any]:
    """Standard guard parameters."""
    return {
        "min_edge_pct": 1.0,
        "min_confidence": 20,
        "max_position_pct": 1.0,  # multiplier on base position size
        "kelly_fraction": 0.25,  # standard quarter-Kelly
    }


def _risk_off_params() -> dict[str, Any]:
    """Tightened guard parameters for adverse conditions."""
    return {
        "min_edge_pct": 2.0,  # require 2x normal edge
        "min_confidence": 40,  # require higher confidence
        "max_position_pct": 0.50,  # half position sizes
        "kelly_fraction": 0.10,  # conservative 10% Kelly in risk-off
    }


def apply_regime_to_pipeline(
    base_config: PipelineConfig,
    regime_params: dict[str, Any],
) -> PipelineConfig:
    """Create a new PipelineConfig with regime adjustments applied."""
    min_edge = max(base_config.min_edge_pct, regime_params.get("min_edge_pct", 0.0))
    position_mult = regime_params.get("max_position_pct", 1.0)
    max_pos = round(base_config.max_position_dollars * position_mult, 2)

    return PipelineConfig(
        scan_interval_sec=base_config.scan_interval_sec,
        min_edge_pct=min_edge,
        min_liquidity_dollars=base_config.min_liquidity_dollars,
        max_time_to_expiry_hours=base_config.max_time_to_expiry_hours,
        min_time_to_expiry_hours=base_config.min_time_to_expiry_hours,
        fee_rate=base_config.fee_rate,
        max_position_dollars=max_pos,
    )
