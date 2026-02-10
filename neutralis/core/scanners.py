"""Complement arbitrage scanner for Kalshi binary markets.

If yes_ask + no_ask < 1.0, buying both guarantees profit at settlement
(minus fees). This scanner identifies such opportunities.
"""

from __future__ import annotations

from datetime import datetime, timezone

from neutralis.config import PipelineConfig
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
    delta = dt - now
    return delta.total_seconds() / 3600.0


def scan_complement_arb(
    markets: list[NormalizedMarket],
    config: PipelineConfig | None = None,
) -> list[Signal]:
    """Scan normalized markets for complement arbitrage opportunities.

    For each active binary market where yes_ask + no_ask < 1.0 (after fees),
    emit a Signal with the computed edge.
    """
    cfg = config or PipelineConfig()
    signals: list[Signal] = []

    for m in markets:
        if m.market_type != MarketType.BINARY:
            continue
        if m.status.value != "active":
            continue
        if m.yes_ask <= 0 or m.no_ask <= 0:
            continue

        hours_left = _hours_until(m.expected_expiration) or _hours_until(m.close_time)
        if hours_left is not None:
            if hours_left < cfg.min_time_to_expiry_hours:
                continue
            if hours_left > cfg.max_time_to_expiry_hours:
                continue

        combined_cost = m.yes_ask + m.no_ask

        if combined_cost >= 1.0:
            continue

        gross_edge = 1.0 - combined_cost
        estimated_fee = cfg.fee_rate * m.notional_value
        net_edge = gross_edge - estimated_fee

        if net_edge <= 0:
            continue

        edge_pct = (net_edge / combined_cost) * 100.0

        if edge_pct < cfg.min_edge_pct:
            continue

        if m.liquidity < cfg.min_liquidity_dollars:
            continue

        legs = (
            TradeLeg(
                ticker=m.ticker,
                side="yes",
                price_dollars=m.yes_ask,
                quantity_dollars=min(cfg.max_position_dollars, m.liquidity / 2),
            ),
            TradeLeg(
                ticker=m.ticker,
                side="no",
                price_dollars=m.no_ask,
                quantity_dollars=min(cfg.max_position_dollars, m.liquidity / 2),
            ),
        )

        signal = Signal(
            signal_type=SignalType.COMPLEMENT_ARB,
            ticker=m.ticker,
            event_ticker=m.event_ticker,
            yes_ask=m.yes_ask,
            no_ask=m.no_ask,
            combined_cost=round(combined_cost, 6),
            gross_edge=round(gross_edge, 6),
            net_edge=round(net_edge, 6),
            edge_pct=round(edge_pct, 4),
            legs=legs,
            market_snapshot=m,
        )

        signals.append(signal)
        logger.info(
            "Signal: %s  yes_ask=%.4f  no_ask=%.4f  edge=%.2f%%",
            m.ticker,
            m.yes_ask,
            m.no_ask,
            edge_pct,
            extra={"ticker": m.ticker, "edge_pct": edge_pct},
        )

    signals.sort(key=lambda s: s.edge_pct, reverse=True)

    logger.info(
        "Scan complete: %d signals from %d markets",
        len(signals),
        len(markets),
    )
    return signals
