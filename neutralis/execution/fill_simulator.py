"""Fill simulator for paper execution."""

from __future__ import annotations

from datetime import datetime

from neutralis.execution.models import Fill, Order, OrderStatus, SlippageConfig, VENUE_SLIPPAGE
from neutralis.execution.slippage import compute_slippage
from neutralis.fees import kalshi_fee_per_contract, polymarket_fee
from neutralis.models import NormalizedMarket


def _compute_fee(price: float, quantity: float, venue: str, fee_tier: str = "standard") -> float:
    """Compute total fee for a fill."""
    if venue == "kalshi":
        return round(kalshi_fee_per_contract(price) * quantity, 4)
    if venue in ("polymarket", "polymarket_us"):
        return round(polymarket_fee(price, int(quantity), fee_tier=fee_tier), 4)
    return round(kalshi_fee_per_contract(price) * quantity, 4)


def _orderbook_depth(market: NormalizedMarket | None, side: str) -> float:
    """Total dollar depth available in the orderbook for a side."""
    if market is None:
        return 0.0
    levels = market.yes_bids if side == "buy_yes" else market.no_bids
    return sum(level.quantity_dollars for level in levels)


def simulate_fill(
    order: Order,
    market: NormalizedMarket | None = None,
    slippage_config: SlippageConfig | None = None,
) -> list[Fill]:
    """Simulate fills for a paper order.

    Returns a list of Fill objects (0 or 1 fills in practice).
    Orders not fully filled are cancelled (no carry-over in paper mode).
    """
    if slippage_config is None:
        slippage_config = VENUE_SLIPPAGE.get(order.venue, VENUE_SLIPPAGE["kalshi"])

    has_orderbook = (
        market is not None
        and bool(market.yes_bids if order.side == "buy_yes" else market.no_bids)
    )

    if has_orderbook:
        depth = _orderbook_depth(market, order.side)
        if depth >= order.requested_size_dollars:
            # Full fill
            fill_size = order.requested_size_dollars
        elif depth > 0:
            # Partial fill -- only fill what's available
            fill_size = depth
        else:
            return []
    else:
        # Heuristic: use market liquidity
        liquidity = market.liquidity if market else 0.0
        if liquidity < order.requested_size_dollars * 0.5:
            # Very thin -- fill 80%
            fill_size = round(order.requested_size_dollars * 0.8, 2)
        else:
            fill_size = order.requested_size_dollars

    if fill_size <= 0:
        return []

    fill_price, slippage_bps = compute_slippage(
        requested_price=order.requested_price,
        size_dollars=fill_size,
        market=market,
        side=order.side,
        config=slippage_config,
    )

    quantity = fill_size / fill_price if fill_price > 0 else 0.0
    fee_tier = market.poly_fee_tier if market else "standard"
    fee = _compute_fee(fill_price, quantity, order.venue, fee_tier=fee_tier)

    fill = Fill(
        order_id=order.id,
        fill_number=1,
        price=round(fill_price, 6),
        quantity=round(quantity, 4),
        size_dollars=round(fill_size, 2),
        fee_dollars=fee,
        slippage_bps=round(slippage_bps, 2),
        liquidity_consumed=fill_size,
    )

    return [fill]
