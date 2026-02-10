"""Cross-platform price discrepancy scanner."""

from __future__ import annotations

from neutralis.config import MatchingConfig
from neutralis.core.matcher import MarketPair
from neutralis.logging import get_logger
from neutralis.models import CrossPlatformMatch, Signal, SignalType

logger = get_logger(__name__)


def scan_cross_platform(
    pairs: list[MarketPair],
    config: MatchingConfig | None = None,
) -> list[Signal]:
    """Scan matched market pairs for price discrepancies.

    For each pair, compare the Yes price on both venues.
    If the relative difference exceeds min_discrepancy_pct, emit a signal.
    """
    cfg = config or MatchingConfig()
    signals: list[Signal] = []

    for pair in pairs:
        k = pair.kalshi_market
        p = pair.polymarket_market

        kalshi_yes = k.yes_ask
        poly_yes = p.yes_ask

        if kalshi_yes <= 0 or poly_yes <= 0:
            continue

        abs_diff = abs(kalshi_yes - poly_yes)
        lower_price = min(kalshi_yes, poly_yes)
        if lower_price <= 0:
            continue

        discrepancy_pct = (abs_diff / lower_price) * 100.0

        if discrepancy_pct < cfg.min_discrepancy_pct:
            continue

        favored = "kalshi" if kalshi_yes < poly_yes else "polymarket"

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

        signal = Signal(
            signal_type=SignalType.CROSS_PLATFORM_DISCREPANCY,
            ticker=k.ticker,
            event_ticker=k.event_ticker,
            yes_ask=kalshi_yes,
            no_ask=k.no_ask,
            combined_cost=kalshi_yes + poly_yes,
            gross_edge=abs_diff,
            net_edge=abs_diff,
            edge_pct=round(discrepancy_pct, 4),
            cross_platform=xp_match,
        )

        signals.append(signal)
        logger.info(
            "Signal: %s vs %s | K=%.4f P=%.4f | disc=%.2f%% | buy on %s",
            k.title[:40],
            p.title[:40],
            kalshi_yes,
            poly_yes,
            discrepancy_pct,
            favored,
        )

    signals.sort(key=lambda s: s.edge_pct, reverse=True)
    logger.info(
        "Cross-platform scan: %d signals from %d pairs",
        len(signals), len(pairs),
    )
    return signals
