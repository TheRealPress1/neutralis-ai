"""Signal confidence scoring — composite score from market features."""

from __future__ import annotations

from typing import Any

from neutralis.models import Signal, SignalType


# Default component weights (sum to 1.0)
_DEFAULT_WEIGHTS = {
    "edge_robustness": 0.30,
    "liquidity_robustness": 0.20,
    "price_stability": 0.15,
    "spread_health": 0.15,
    "time_efficiency": 0.10,
    "match_confidence": 0.10,
}

# Volume momentum: flow strength replaces match confidence, spread de-weighted
_VOLUME_MOMENTUM_WEIGHTS = {
    "edge_robustness": 0.25,
    "liquidity_robustness": 0.20,
    "price_stability": 0.10,
    "spread_health": 0.05,  # Directional trades tolerate wider spreads
    "time_efficiency": 0.15,
    "flow_strength": 0.25,  # Replaces match_confidence
}

# Three-way arb: venue diversification replaces match confidence
_THREE_WAY_WEIGHTS = {
    "edge_robustness": 0.30,
    "liquidity_robustness": 0.20,
    "price_stability": 0.10,
    "spread_health": 0.10,
    "time_efficiency": 0.10,
    "venue_diversification": 0.20,  # Cross-venue = lower fee risk
}


def score_signal(
    signal: Signal,
    features: dict[str, Any],
    costs: dict[str, float],
    match_score: float | None = None,
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Compute a confidence score (0-100) and capital efficiency metrics.

    Args:
        signal: The raw signal from scanner.
        features: Output of compute_market_features().
        costs: Output of estimate_costs().
        match_score: Cross-platform match confidence (0-1), None for complement arb.
        weights: Override component weights.

    Returns:
        Dict with confidence_score, roi_per_day, time_to_resolution_days,
        net_edge_after_costs, and component_scores breakdown.
    """
    # Select weights based on signal type
    if weights is not None:
        w = weights
    elif signal.signal_type == SignalType.VOLUME_MOMENTUM:
        w = _VOLUME_MOMENTUM_WEIGHTS
    elif signal.signal_type == SignalType.THREE_WAY_ARB:
        w = _THREE_WAY_WEIGHTS
    else:
        w = _DEFAULT_WEIGHTS

    # Net edge after all estimated costs
    total_cost_impact = costs.get("total_cost", 0.0)
    net_edge = signal.gross_edge - total_cost_impact
    if net_edge < 0:
        net_edge = 0.0

    # Time to resolution
    ttr_days = features.get("time_to_resolution_days", 30.0)

    # ROI per day (the key capital efficiency metric)
    combined_cost = signal.combined_cost if signal.combined_cost > 0 else 1.0
    edge_pct = (net_edge / combined_cost) * 100.0
    roi_per_day = edge_pct / max(ttr_days, 0.01)

    # Component scores (each 0.0 to 1.0)
    components = {}

    # 1. Edge robustness: how much edge survives after costs + buffer
    # Map: 0% -> 0.0, 2%+ -> 1.0 (diminishing returns above 2%)
    components["edge_robustness"] = _saturate(edge_pct / 2.0)

    # 2. Liquidity robustness: depth relative to a $25 position
    # Map: $0 -> 0.0, $500+ -> 1.0
    liquidity = features.get("liquidity", 0.0)
    components["liquidity_robustness"] = _saturate(liquidity / 500.0)

    # 3. Price stability: inverse of rolling probability volatility
    # Low volatility = high stability = good
    # Map: vol=0 -> 1.0, vol>=0.10 -> 0.0
    vol = features.get("prob_volatility", 0.0)
    components["price_stability"] = max(0.0, 1.0 - vol / 0.10)

    # 4. Spread health: tight spread = good
    # Map: spread=0 -> 1.0, spread>=0.10 -> 0.0
    spread = features.get("spread", 0.0)
    components["spread_health"] = max(0.0, 1.0 - spread / 0.10)

    # 5. Time efficiency: faster resolution = better
    # Map: 1 day -> 1.0, 30+ days -> ~0.03
    components["time_efficiency"] = min(1.0, 1.0 / max(ttr_days, 1.0))

    # 6. Signal-type-specific components
    if signal.signal_type == SignalType.VOLUME_MOMENTUM:
        # Flow strength: how far above the 70% imbalance threshold
        # implied_probability stores the imbalance ratio (0.70-1.0)
        imbalance = signal.implied_probability if signal.implied_probability > 0 else 0.7
        components["flow_strength"] = _saturate((imbalance - 0.70) / 0.30)
    elif signal.signal_type == SignalType.THREE_WAY_ARB:
        # Venue diversification: cross-venue (mixed Kalshi+Poly) reduces fee risk
        venues = set(leg.venue or "kalshi" for leg in signal.legs)
        components["venue_diversification"] = 1.0 if len(venues) > 1 else 0.5
    else:
        # Match confidence (cross-platform arb) or full score (complement arb)
        if match_score is not None:
            components["match_confidence"] = min(match_score, 1.0)
        else:
            components["match_confidence"] = 1.0

    # Composite: weighted sum -> scale to 0-100
    composite = sum(
        w.get(k, 0.0) * components.get(k, 0.0)
        for k in w
    )
    confidence_score = max(0, min(100, round(composite * 100)))

    return {
        "confidence_score": confidence_score,
        "net_edge": round(net_edge, 6),
        "edge_pct": round(edge_pct, 4),
        "time_to_resolution_days": round(ttr_days, 2),
        "roi_per_day": round(roi_per_day, 4),
        "component_scores": {k: round(v, 4) for k, v in components.items()},
        "costs": costs,
        "weights_used": w,
    }


def _saturate(x: float) -> float:
    """Clamp to [0, 1]."""
    return max(0.0, min(1.0, x))
