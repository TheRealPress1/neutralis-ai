"""Settlement arb scanner for near-expiry markets.

Markets within 24h of close compress toward 0 or 1. Complement arbs in
the final hours have much higher annualized ROI because the capital is
locked for a shorter period. This scanner uses a relaxed edge threshold
for short-duration opportunities.

Strategy:
  - Same as complement arb (yes_ask + no_ask < 1.0 after fees)
  - But only for markets expiring within 24h
  - Relaxed min_edge_pct (0.5% vs normal 1.0%)
  - Higher priority due to guaranteed short-duration resolution
"""

from __future__ import annotations

from datetime import datetime, timezone

from neutralis.config import PipelineConfig
from neutralis.fees import estimate_total_fee
from neutralis.logging import get_logger
from neutralis.models import (
    MarketType,
    NormalizedMarket,
    Signal,
    SignalType,
    TradeLeg,
)

logger = get_logger(__name__)

# Relaxed threshold for settlement arbs — shorter lock-up compensates
_SETTLEMENT_MIN_EDGE_PCT = 0.5
# Only scan markets within this window
_MAX_HOURS_TO_EXPIRY = 24.0
_MIN_HOURS_TO_EXPIRY = 0.25  # 15 min minimum (avoid race with settlement)


def _hours_until(dt: datetime | None) -> float | None:
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (dt - now).total_seconds() / 3600.0


def scan_settlement_arb(
    markets: list[NormalizedMarket],
    config: PipelineConfig | None = None,
    *,
    maker: bool = False,
) -> list[Signal]:
    """Scan near-expiry markets for complement arb opportunities.

    Similar to scan_complement_arb but specifically targets markets
    within 24h of settlement where prices compress toward 0/1 and
    arb edges appear more frequently.
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

        # Only near-expiry markets
        hours_left = _hours_until(m.expected_expiration) or _hours_until(m.close_time)
        if hours_left is None:
            continue
        if hours_left < _MIN_HOURS_TO_EXPIRY or hours_left > _MAX_HOURS_TO_EXPIRY:
            continue

        combined_cost = m.yes_ask + m.no_ask
        if combined_cost >= 1.0:
            continue

        gross_edge = 1.0 - combined_cost
        estimated_fee = estimate_total_fee(m.yes_ask, m.no_ask, venue=m.venue, maker=maker)
        slippage = cfg.slippage_per_leg * 2
        net_edge = gross_edge - estimated_fee - slippage

        if net_edge <= 0:
            continue

        edge_pct = (net_edge / combined_cost) * 100.0
        if edge_pct < _SETTLEMENT_MIN_EDGE_PCT:
            continue

        if m.liquidity < cfg.min_liquidity_dollars:
            continue

        # Annualized ROI — short duration means very high ROI
        annualized_roi = (edge_pct / max(hours_left, 0.25)) * 8760.0  # % per year

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
            "Settlement arb: %s yes=%.4f no=%.4f edge=%.2f%% hours=%.1f annROI=%.0f%%",
            m.ticker, m.yes_ask, m.no_ask, edge_pct, hours_left, annualized_roi,
        )

    signals.sort(key=lambda s: s.edge_pct, reverse=True)
    logger.info(
        "Settlement scan: %d signals from %d markets (<%dh window)",
        len(signals), len(markets), int(_MAX_HOURS_TO_EXPIRY),
    )
    return signals
