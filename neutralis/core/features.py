"""Market feature extraction for signal scoring."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from neutralis.fees import kalshi_fee_per_contract, polymarket_fee
from neutralis.models import NormalizedMarket, Signal


def compute_market_features(
    market: NormalizedMarket,
    recent_snapshots: list[NormalizedMarket] | None = None,
) -> dict[str, Any]:
    """Extract scoring features from a market and its recent price history.

    Features returned:
        spread: bid-ask spread on YES side
        spread_pct: spread as fraction of mid price
        mid_price: (yes_bid + yes_ask) / 2
        liquidity: raw liquidity from venue
        ob_depth: top-of-book quantity (0 if no orderbook)
        prob_volatility: std dev of mid price across recent snapshots
        staleness_hours: hours since most recent snapshot (0 if none)
        time_to_resolution_days: days until expected expiration
    """
    yes_bid = market.yes_bid
    yes_ask = market.yes_ask
    mid = (yes_bid + yes_ask) / 2.0 if (yes_bid + yes_ask) > 0 else 0.5

    spread = yes_ask - yes_bid if yes_ask > yes_bid else 0.0
    spread_pct = spread / mid if mid > 0 else 0.0

    # Orderbook depth
    ob_depth = 0.0
    if market.yes_bids:
        ob_depth = market.yes_bids[0].quantity_dollars
    if market.no_bids:
        ob_depth = min(ob_depth, market.no_bids[0].quantity_dollars) if ob_depth > 0 else market.no_bids[0].quantity_dollars

    # Rolling volatility from recent snapshots
    prob_volatility = 0.0
    staleness_hours = 0.0

    if recent_snapshots and len(recent_snapshots) >= 2:
        mids = []
        for s in recent_snapshots:
            m = (s.yes_bid + s.yes_ask) / 2.0
            if m > 0:
                mids.append(m)

        if len(mids) >= 2:
            mean = sum(mids) / len(mids)
            variance = sum((x - mean) ** 2 for x in mids) / len(mids)
            prob_volatility = math.sqrt(variance)

        # Staleness: time since the most recent snapshot
        latest_ts = max(s.snapshot_ts for s in recent_snapshots)
        now = datetime.now(timezone.utc)
        if latest_ts.tzinfo is None:
            latest_ts = latest_ts.replace(tzinfo=timezone.utc)
        staleness_hours = max(0.0, (now - latest_ts).total_seconds() / 3600.0)

    # Time to resolution
    time_to_resolution_days = _time_to_resolution(market)

    return {
        "spread": round(spread, 6),
        "spread_pct": round(spread_pct, 6),
        "mid_price": round(mid, 6),
        "liquidity": market.liquidity,
        "ob_depth": round(ob_depth, 2),
        "prob_volatility": round(prob_volatility, 6),
        "staleness_hours": round(staleness_hours, 2),
        "time_to_resolution_days": round(time_to_resolution_days, 2),
    }


def estimate_costs(
    signal: Signal,
    market: NormalizedMarket,
) -> dict[str, float]:
    """Estimate total execution costs for a signal.

    Returns:
        fees_est: estimated fees using venue-specific models
        slippage_est: estimated slippage (conservative if no orderbook)
        total_cost: fees_est + slippage_est
    """
    venue = market.venue

    # Fee estimation per leg
    fees = 0.0
    for leg in signal.legs:
        leg_venue = leg.venue or venue
        if leg_venue == "kalshi":
            fees += kalshi_fee_per_contract(leg.price_dollars)
        else:
            fees += polymarket_fee(leg.price_dollars)

    # Slippage: conservative estimate
    # If we have orderbook depth, slippage is small.
    # If not, assume 0.5% of position value.
    slippage = 0.0
    if market.yes_bids or market.no_bids:
        # Minimal slippage when orderbook exists
        slippage = 0.001 * signal.combined_cost
    else:
        slippage = 0.005 * signal.combined_cost

    return {
        "fees_est": round(fees, 6),
        "slippage_est": round(slippage, 6),
        "total_cost": round(fees + slippage, 6),
    }


def _time_to_resolution(market: NormalizedMarket) -> float:
    """Estimate days until market resolves."""
    dt = market.expected_expiration or market.close_time
    if dt is None:
        return 30.0  # Default assumption: 30 days

    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    days = (dt - now).total_seconds() / 86400.0
    return max(days, 0.01)  # Floor at ~15 minutes
