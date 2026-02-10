"""Conservative position sizing for v1."""

from __future__ import annotations

from neutralis.config import PipelineConfig
from neutralis.models import NormalizedMarket, Signal


def compute_size(
    signal: Signal,
    market: NormalizedMarket,
    config: PipelineConfig | None = None,
) -> float:
    """Compute suggested position size in dollars (per leg).

    Returns 0.0 if the signal should not be traded.
    """
    cfg = config or PipelineConfig()

    size = cfg.max_position_dollars

    # Never use more than 20% of reported liquidity
    liquidity_cap = market.liquidity * 0.20
    if liquidity_cap > 0:
        size = min(size, liquidity_cap)

    # Scale down if edge is close to minimum threshold
    if signal.edge_pct > 0 and cfg.min_edge_pct > 0:
        edge_ratio = signal.edge_pct / (cfg.min_edge_pct * 3)
        edge_ratio = min(edge_ratio, 1.0)
        size *= edge_ratio

    if size < 1.0:
        return 0.0

    return round(size, 2)
