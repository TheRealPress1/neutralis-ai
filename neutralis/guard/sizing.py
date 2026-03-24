"""Position sizing with fractional Kelly criterion and portfolio headroom awareness."""

from __future__ import annotations

from typing import Any

from neutralis.categories import RISK_MULTIPLIERS, classify_market
from neutralis.config import PipelineConfig, PortfolioConfig
from neutralis.models import NormalizedMarket, PortfolioSnapshot, Signal

# Use 25% Kelly for safety — full Kelly is too aggressive for correlated bets
_KELLY_FRACTION = 0.25


def _kelly_optimal(signal: Signal) -> float:
    """Compute the optimal Kelly bet fraction for a signal.

    For arbs (guaranteed payout):
        f* = net_edge / combined_cost
        This is exact — arbs are risk-free given execution, so Kelly
        reduces to the net return per dollar invested.

    For directional (binary prediction market bet):
        f* = (p - q) / b  where p = win probability, q = 1-p, b = net odds
        For a market where you pay `entry_price` and collect $1.00 on win:
            b = (1 - entry_price) / entry_price  (net odds per dollar wagered)
        Substituting: f* = (p - entry_price) / (1 - entry_price)
        This is only valid when p > entry_price (positive edge exists).

    Falls back to edge_pct / 100 when implied_probability is unavailable.
    """
    # Directional signals: use binary Kelly when we have a true probability estimate.
    # Check this BEFORE the arb formula — directional signals also carry combined_cost
    # and net_edge but they don't represent a risk-free arb; the binary formula is correct.
    if signal.implied_probability > 0 and signal.entry_side:
        p = signal.implied_probability
        # Use the ask price for the side we're buying
        if signal.entry_side == "yes":
            entry_price = signal.yes_ask if signal.yes_ask > 0 else signal.combined_cost
        else:
            entry_price = signal.no_ask if signal.no_ask > 0 else signal.combined_cost

        if 0 < entry_price < 1.0 and p > entry_price:
            return (p - entry_price) / (1.0 - entry_price)
        return 0.0

    # Arb signals: risk-free → Kelly optimal is 1.0 (bet everything).
    # Fractional Kelly (0.25) and max_position_dollars will cap the actual size.
    # The expected profit per trade = size * (net_edge / combined_cost).
    if signal.combined_cost > 0 and signal.net_edge > 0:
        return 1.0

    # Fallback for signals without probability estimates
    if signal.edge_pct > 0:
        return signal.edge_pct / 100.0
    return 0.0


def compute_size(
    signal: Signal,
    market: NormalizedMarket,
    config: PipelineConfig | None = None,
    portfolio_snapshot: PortfolioSnapshot | None = None,
    portfolio_config: PortfolioConfig | None = None,
    category: str | None = None,
    category_overrides: dict[str, Any] | None = None,
    regime_params: dict[str, Any] | None = None,
) -> float:
    """Compute suggested position size in dollars (per leg) using fractional Kelly.

    Returns 0.0 if the signal should not be traded.
    Kelly criterion scales position with edge quality — higher edge = larger bet.
    Still clamped to max_position_dollars, liquidity caps, and portfolio headroom.

    regime_params: If provided, uses regime-specific Kelly fraction
        (e.g., 0.10 in RISK_OFF vs 0.25 in NORMAL).
    """
    cfg = config or PipelineConfig()
    pcfg = portfolio_config or PortfolioConfig()
    kelly_frac = (regime_params or {}).get("kelly_fraction", _KELLY_FRACTION)

    # ── Fractional Kelly base sizing ──
    kelly = _kelly_optimal(signal)
    if kelly <= 0:
        # Fall back to edge-ratio scaling for signals without Kelly-compatible fields
        size = cfg.max_position_dollars
        if signal.edge_pct > 0 and cfg.min_edge_pct > 0:
            edge_ratio = min(signal.edge_pct / (cfg.min_edge_pct * 3), 1.0)
            size *= edge_ratio
    else:
        bankroll = pcfg.max_total_exposure_dollars
        size = kelly * kelly_frac * bankroll

    # Cap at configured max per-position
    size = min(size, cfg.max_position_dollars)

    # Apply per-category position multiplier
    if category and category_overrides and category in category_overrides:
        override = category_overrides[category]
        risk_level = override.get("risk_level", "moderate")
        mults = RISK_MULTIPLIERS.get(risk_level, RISK_MULTIPLIERS["moderate"])
        size *= mults["position_mult"]

    # Never use more than 20% of reported liquidity (skip when liquidity unknown)
    if market.liquidity > 0:
        liquidity_cap = market.liquidity * 0.20
        size = min(size, liquidity_cap)

    # Confidence scaling: reduce size for low-confidence signals
    if signal.confidence_score > 0:
        confidence_factor = min(signal.confidence_score / 70.0, 1.0)
        size *= confidence_factor

    # Portfolio headroom clamping
    if portfolio_snapshot is not None:
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

        # Per-category exposure headroom
        if category and category_overrides and category in category_overrides:
            cat_max = category_overrides[category].get("max_exposure_dollars")
            if cat_max is not None:
                cat_current = sum(
                    p.size_dollars
                    for p in portfolio_snapshot.positions
                    if classify_market(p.ticker, p.event_ticker) == category
                )
                cat_headroom = cat_max - cat_current
                size = min(size, max(cat_headroom, 0.0))

    if size < 1.0:
        return 0.0

    return round(size, 2)
