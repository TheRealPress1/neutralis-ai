"""Position sizing with portfolio headroom awareness."""

from __future__ import annotations

from neutralis.config import PipelineConfig, PortfolioConfig
from neutralis.models import NormalizedMarket, PortfolioSnapshot, Signal


def compute_size(
    signal: Signal,
    market: NormalizedMarket,
    config: PipelineConfig | None = None,
    portfolio_snapshot: PortfolioSnapshot | None = None,
    portfolio_config: PortfolioConfig | None = None,
) -> float:
    """Compute suggested position size in dollars (per leg).

    Returns 0.0 if the signal should not be traded.
    When portfolio state is provided, the size is clamped to respect
    portfolio-level headroom (total, event, and ticker budgets).
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

    # Portfolio headroom clamping (v2)
    if portfolio_snapshot is not None:
        pcfg = portfolio_config or PortfolioConfig()

        # Total exposure headroom
        total_headroom = pcfg.max_total_exposure_dollars - portfolio_snapshot.total_exposure_dollars
        size = min(size, max(total_headroom, 0.0))

        # Event exposure headroom
        event_current = dict(portfolio_snapshot.event_exposure).get(
            signal.event_ticker, 0.0,
        )
        event_headroom = pcfg.max_event_exposure_dollars - event_current
        size = min(size, max(event_headroom, 0.0))

        # Ticker exposure headroom
        ticker_current = sum(
            p.size_dollars
            for p in portfolio_snapshot.positions
            if p.ticker == signal.ticker
        )
        ticker_headroom = pcfg.max_ticker_exposure_dollars - ticker_current
        size = min(size, max(ticker_headroom, 0.0))

    if size < 1.0:
        return 0.0

    return round(size, 2)
