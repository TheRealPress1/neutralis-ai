"""Slippage model for paper execution."""

from __future__ import annotations

import math

from neutralis.execution.models import SlippageConfig, VENUE_SLIPPAGE
from neutralis.models import NormalizedMarket


def _walk_orderbook(
    levels: tuple,
    size_dollars: float,
) -> tuple[float, float]:
    """Walk orderbook levels and return (vwap, total_consumed).

    Each level is an OrderbookLevel(price_dollars, quantity_dollars).
    Returns the volume-weighted average price and total depth consumed.
    """
    remaining = size_dollars
    total_cost = 0.0
    total_qty = 0.0

    for level in levels:
        if remaining <= 0:
            break
        available = level.quantity_dollars
        consume = min(remaining, available)
        qty = consume / level.price_dollars if level.price_dollars > 0 else 0.0
        total_cost += consume
        total_qty += qty
        remaining -= consume

    if total_qty <= 0:
        return 0.0, 0.0

    vwap = total_cost / total_qty
    return vwap, total_cost


def compute_slippage(
    requested_price: float,
    size_dollars: float,
    market: NormalizedMarket | None,
    side: str,
    config: SlippageConfig | None = None,
) -> tuple[float, float]:
    """Compute slippage for a paper fill.

    Returns:
        (fill_price, slippage_bps)
    """
    if config is None:
        config = VENUE_SLIPPAGE.get(
            market.venue if market else "kalshi",
            VENUE_SLIPPAGE["kalshi"],
        )

    # Path 1: orderbook available
    if market is not None:
        levels = market.yes_bids if side == "buy_yes" else market.no_bids
        if levels:
            vwap, consumed = _walk_orderbook(levels, size_dollars)
            if vwap > 0 and consumed > 0:
                raw_bps = abs(vwap - requested_price) / requested_price * 10_000
                slippage_bps = max(raw_bps, config.base_slippage_bps)
                slippage_bps = min(slippage_bps, config.max_slippage_bps)
                fill_price = requested_price * (1 + slippage_bps / 10_000)
                fill_price = min(fill_price, 0.99)
                return fill_price, slippage_bps

    # Path 2: no orderbook -- sqrt-impact heuristic
    liquidity = market.liquidity if market else 0.0
    if liquidity <= 0:
        liquidity = config.liquidity_threshold

    slippage_bps = (
        config.base_slippage_bps
        + config.impact_coefficient * math.sqrt(size_dollars / liquidity) * 10_000
    )

    if liquidity < config.liquidity_threshold:
        slippage_bps += config.thin_book_penalty_bps

    slippage_bps = min(slippage_bps, config.max_slippage_bps)

    fill_price = requested_price * (1 + slippage_bps / 10_000)
    fill_price = min(fill_price, 0.99)
    return fill_price, slippage_bps
