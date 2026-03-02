"""Cross-platform price discrepancy scanner."""

from __future__ import annotations

from datetime import datetime, timezone

from neutralis.config import MatchingConfig, PipelineConfig
from neutralis.core.matcher import MarketPair
from neutralis.fees import estimate_cross_platform_fee
from neutralis.logging import get_logger
from neutralis.models import CrossPlatformMatch, Signal, SignalType, TradeLeg

logger = get_logger(__name__)


def _hours_until(dt: datetime | None) -> float | None:
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = dt - now
    return delta.total_seconds() / 3600.0


def scan_cross_platform(
    pairs: list[MarketPair],
    config: MatchingConfig | None = None,
    pipeline_config: PipelineConfig | None = None,
    *,
    maker: bool = False,
) -> list[Signal]:
    """Scan matched market pairs for cross-venue arbitrage opportunities.

    The arb trade: buy YES on the cheaper venue, buy NO on the other venue.
    One side always wins → guaranteed $1.00 return.
    Edge = $1.00 - (favored_yes + other_no) - fees - slippage.
    """
    cfg = config or MatchingConfig()
    cfg_pipe = pipeline_config or PipelineConfig()
    signals: list[Signal] = []

    for pair in pairs:
        k = pair.kalshi_market
        p = pair.polymarket_market

        # Time-to-expiry filter — reject pairs outside the user's horizon
        skip = False
        for mkt in (k, p):
            exp = mkt.expected_expiration or mkt.close_time
            hours_left = _hours_until(exp)
            if hours_left is not None:
                if hours_left < cfg_pipe.min_time_to_expiry_hours:
                    skip = True
                    break
                if hours_left > cfg_pipe.max_time_to_expiry_hours:
                    skip = True
                    break
        if skip:
            continue

        kalshi_yes = k.yes_ask
        poly_yes = p.yes_ask

        if kalshi_yes <= 0 or poly_yes <= 0:
            continue

        # Determine which venue has cheaper YES
        if kalshi_yes < poly_yes:
            favored = "kalshi"
            favored_yes = kalshi_yes
            other_no = p.no_ask
            yes_ticker = k.ticker
            no_ticker = p.ticker
            yes_venue = "kalshi"
            no_venue = "polymarket"
        else:
            favored = "polymarket"
            favored_yes = poly_yes
            other_no = k.no_ask
            yes_ticker = p.ticker
            no_ticker = k.ticker
            yes_venue = "polymarket"
            no_venue = "kalshi"

        # Arb economics: buy YES on cheaper + buy NO on other = $1.00 return
        combined_cost = favored_yes + other_no
        gross_edge = 1.0 - combined_cost
        if gross_edge <= 0:
            continue  # No arb exists

        # Deduct per-venue fees from each leg
        # Determine Polymarket fee tiers for each leg
        yes_tier = (k if yes_venue == "kalshi" else p).poly_fee_tier
        no_tier = (k if no_venue == "kalshi" else p).poly_fee_tier
        estimated_fee = estimate_cross_platform_fee(
            yes_price=favored_yes,
            yes_venue=yes_venue,
            no_price=other_no,
            no_venue=no_venue,
            maker=maker,
            yes_fee_tier=yes_tier,
            no_fee_tier=no_tier,
        )
        slippage = cfg_pipe.slippage_per_leg * 2  # two legs
        net_edge = gross_edge - estimated_fee - slippage
        if net_edge <= 0:
            continue  # Not profitable after fees + slippage

        edge_pct = (net_edge / combined_cost) * 100.0

        # Price discrepancy for analytics (not used as gate)
        lower_price = min(kalshi_yes, poly_yes)
        discrepancy_pct = (abs(kalshi_yes - poly_yes) / lower_price) * 100.0

        xp_match = CrossPlatformMatch(
            kalshi_ticker=k.ticker,
            kalshi_title=k.title,
            kalshi_yes_ask=k.yes_ask,
            kalshi_no_ask=k.no_ask,
            polymarket_id=p.ticker,
            polymarket_question=p.title,
            polymarket_yes_price=p.yes_ask,
            polymarket_no_price=p.no_ask,
            match_confidence=pair.similarity,
            price_discrepancy_pct=round(discrepancy_pct, 4),
            favored_venue=favored,
        )

        legs = (
            TradeLeg(
                ticker=yes_ticker,
                side="yes",
                price_dollars=favored_yes,
                quantity_dollars=favored_yes,
                venue=yes_venue,
            ),
            TradeLeg(
                ticker=no_ticker,
                side="no",
                price_dollars=other_no,
                quantity_dollars=other_no,
                venue=no_venue,
            ),
        )

        signal = Signal(
            signal_type=SignalType.CROSS_PLATFORM_DISCREPANCY,
            ticker=k.ticker,
            event_ticker=k.event_ticker,
            yes_ask=kalshi_yes,
            no_ask=k.no_ask,
            combined_cost=round(combined_cost, 6),
            gross_edge=round(gross_edge, 6),
            net_edge=round(net_edge, 6),
            edge_pct=round(edge_pct, 4),
            legs=legs,
            market_snapshot=k,
            cross_platform=xp_match,
        )

        signals.append(signal)
        logger.info(
            "Signal: %s vs %s | K=%.4f P=%.4f | edge=%.2f%% (cost=%.4f) | buy YES on %s",
            k.title[:40],
            p.title[:40],
            kalshi_yes,
            poly_yes,
            edge_pct,
            combined_cost,
            favored,
        )

    signals.sort(key=lambda s: s.edge_pct, reverse=True)
    logger.info(
        "Cross-platform scan: %d signals from %d pairs",
        len(signals), len(pairs),
    )
    return signals
