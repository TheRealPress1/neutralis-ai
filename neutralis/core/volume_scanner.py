"""Volume momentum scanner — detects directional flow imbalance.

Uses TradeFlowStats (5-min sliding window) from the event engine to identify
markets where buy/sell volume is heavily skewed, suggesting informed flow.

Strategy:
  - 70%+ buy volume in 5-min window → price likely to rise → buy YES
  - 70%+ sell volume in 5-min window → price likely to fall → buy NO
  - Minimum volume threshold to filter noise (at least 20 contracts)
  - Cross-reference with current bid/ask to confirm favorable pricing
"""

from __future__ import annotations

from dataclasses import replace

from neutralis.config import PipelineConfig
from neutralis.logging import get_logger
from neutralis.models import NormalizedMarket, Signal, SignalType, TradeLeg

logger = get_logger(__name__)

# Minimum contracts in 5-min window to consider a signal
_MIN_VOLUME_CONTRACTS = 20
# Directional imbalance threshold (70% = strong skew)
_IMBALANCE_THRESHOLD = 0.70
# Maximum ask price to buy (avoid overpriced entries)
_MAX_ENTRY_PRICE = 0.92
# Minimum ask price (avoid penny markets with no liquidity)
_MIN_ENTRY_PRICE = 0.08


def check_volume_momentum(
    ticker: str,
    market: NormalizedMarket,
    buy_volume: int,
    sell_volume: int,
    total_volume: int,
    config: PipelineConfig | None = None,
    *,
    depth_bid: float = 0.0,
    depth_ask: float = 0.0,
) -> Signal | None:
    """Check if a single ticker has a volume momentum signal.

    Returns a Signal if the volume imbalance exceeds the threshold,
    or None if no signal.

    depth_bid/depth_ask: Orderbook depth from Polymarket WS (optional).
    When provided, confirms volume signal with depth:
      - High volume + matching depth imbalance = higher confidence
      - High volume + thin depth = likely wash trading, penalize
    """
    cfg = config or PipelineConfig()

    if total_volume < _MIN_VOLUME_CONTRACTS:
        return None

    if market.yes_ask <= 0 or market.no_ask <= 0:
        return None

    buy_ratio = buy_volume / total_volume
    sell_ratio = sell_volume / total_volume

    if buy_ratio >= _IMBALANCE_THRESHOLD:
        # Strong buying pressure → buy YES
        side = "yes"
        price = market.yes_ask
        imbalance = buy_ratio
    elif sell_ratio >= _IMBALANCE_THRESHOLD:
        # Strong selling pressure → buy NO
        side = "no"
        price = market.no_ask
        imbalance = sell_ratio
    else:
        return None

    # Price sanity checks
    if price > _MAX_ENTRY_PRICE or price < _MIN_ENTRY_PRICE:
        return None

    # Edge estimate: imbalance strength above threshold as proxy for edge
    edge_pct = (imbalance - _IMBALANCE_THRESHOLD) * 100.0 / (1.0 - _IMBALANCE_THRESHOLD)
    # Scale edge_pct to a reasonable range (0.5-5%)
    edge_pct = max(0.5, min(edge_pct * 5.0, 5.0))

    # Depth confirmation: adjust edge based on orderbook depth alignment
    total_depth = depth_bid + depth_ask
    if total_depth > 0:
        depth_imbalance = depth_bid / total_depth  # >0.5 = more bids
        if side == "yes" and depth_imbalance > 0.60:
            # Buy volume + bid-heavy book = structural demand, boost edge
            edge_pct *= 1.0 + (depth_imbalance - 0.50) * 0.5  # up to +25%
        elif side == "no" and depth_imbalance < 0.40:
            # Sell volume + ask-heavy book = structural supply, boost edge
            edge_pct *= 1.0 + (0.50 - depth_imbalance) * 0.5
        elif (side == "yes" and depth_imbalance < 0.35) or \
             (side == "no" and depth_imbalance > 0.65):
            # Volume contradicts depth — likely noise, penalize heavily
            edge_pct *= 0.50

    edge_pct = max(0.5, min(edge_pct, 6.0))

    size = min(cfg.max_position_dollars, market.liquidity * 0.10)
    if size < 1.0:
        return None

    leg = TradeLeg(
        ticker=ticker,
        side=side,
        price_dollars=price,
        quantity_dollars=size,
        venue=market.venue,
    )

    signal = Signal(
        signal_type=SignalType.VOLUME_MOMENTUM,
        ticker=ticker,
        event_ticker=market.event_ticker,
        yes_ask=market.yes_ask,
        no_ask=market.no_ask,
        combined_cost=price,
        gross_edge=edge_pct / 100.0,
        net_edge=edge_pct / 100.0,
        edge_pct=round(edge_pct, 4),
        legs=(leg,),
        market_snapshot=market,
        implied_probability=imbalance,
        entry_side=side,
    )

    logger.info(
        "Volume momentum: %s %s imbalance=%.1f%% vol=%d (buy=%d sell=%d) "
        "depth=%.0f/%.0f edge=%.2f%%",
        ticker, side, imbalance * 100, total_volume, buy_volume, sell_volume,
        depth_bid, depth_ask, edge_pct,
    )

    return signal
