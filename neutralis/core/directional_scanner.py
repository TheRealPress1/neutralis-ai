"""High-probability directional scanner for sports markets.

Identifies binary sports markets (tennis, soccer, basketball) where one side
trades at >= 80% implied probability. Creates single-leg directional signals
with a probability-based stop-loss floor.
"""

from __future__ import annotations

from datetime import datetime, timezone

from neutralis.categories import classify_sport
from neutralis.config import DirectionalConfig
from neutralis.fees import kalshi_fee_per_contract, polymarket_fee
from neutralis.logging import get_logger
from neutralis.models import (
    MarketType,
    NormalizedMarket,
    Signal,
    SignalType,
    TradeLeg,
)

logger = get_logger(__name__)


def _hours_until(dt: datetime | None) -> float | None:
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (dt - now).total_seconds() / 3600.0


def _estimate_single_leg_fee(price: float, venue: str) -> float:
    """Estimate fee for a single-leg directional trade."""
    if venue == "kalshi":
        return kalshi_fee_per_contract(price)
    return polymarket_fee(price)


def scan_high_probability(
    markets: list[NormalizedMarket],
    config: DirectionalConfig | None = None,
) -> list[Signal]:
    """Scan for high-probability directional opportunities in sports markets.

    For each active binary sports market where yes_ask >= threshold or
    no_ask >= threshold, emit a single-leg Signal betting on the heavy favorite.
    """
    cfg = config or DirectionalConfig()
    if not cfg.enabled:
        return []

    threshold = cfg.min_implied_probability
    signals: list[Signal] = []

    for m in markets:
        if m.market_type != MarketType.BINARY:
            continue
        if m.status.value != "active":
            continue

        # Sports filter
        sport = classify_sport(m.title, m.event_ticker)
        if sport is None:
            continue

        # Liquidity filter
        if m.liquidity < cfg.min_liquidity_dollars:
            continue

        # Time-to-expiry filter
        hours_left = _hours_until(m.expected_expiration) or _hours_until(m.close_time)
        if hours_left is not None:
            if hours_left < cfg.min_time_to_expiry_hours:
                continue
            if hours_left > cfg.max_time_to_expiry_hours:
                continue

        # Check both sides for high-probability entry
        candidates: list[tuple[str, float]] = []  # (side, ask_price)

        if m.yes_ask >= threshold and m.yes_ask < 1.0:
            candidates.append(("yes", m.yes_ask))
        if m.no_ask >= threshold and m.no_ask < 1.0:
            candidates.append(("no", m.no_ask))

        for side, entry_price in candidates:
            # Edge = payout - cost - fees - slippage
            gross_edge = 1.0 - entry_price
            fee = _estimate_single_leg_fee(entry_price, m.venue)
            slippage = 0.005
            net_edge = gross_edge - fee - slippage

            if net_edge <= 0:
                continue

            edge_pct = (net_edge / entry_price) * 100.0

            leg_size = min(cfg.max_position_dollars, m.liquidity * 0.20)

            leg = TradeLeg(
                ticker=m.ticker,
                side=side,
                price_dollars=entry_price,
                quantity_dollars=leg_size,
                venue=m.venue,
            )

            signal = Signal(
                signal_type=SignalType.HIGH_PROBABILITY_DIRECTIONAL,
                ticker=m.ticker,
                event_ticker=m.event_ticker,
                yes_ask=m.yes_ask,
                no_ask=m.no_ask,
                combined_cost=entry_price,
                gross_edge=round(gross_edge, 6),
                net_edge=round(net_edge, 6),
                edge_pct=round(edge_pct, 4),
                legs=(leg,),
                market_snapshot=m,
                implied_probability=entry_price,
                entry_side=side,
                probability_floor=cfg.probability_floor,
            )

            signals.append(signal)
            logger.info(
                "Directional signal: %s %s %s_ask=%.4f edge=%.2f%% sport=%s",
                m.ticker, side, side, entry_price, edge_pct, sport,
            )

    signals.sort(key=lambda s: s.edge_pct, reverse=True)

    logger.info(
        "Directional scan complete: %d signals from %d markets",
        len(signals), len(markets),
    )
    return signals
