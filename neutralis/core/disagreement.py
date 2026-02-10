"""Cross-venue disagreement index — measures overall market pricing consensus."""

from __future__ import annotations

from neutralis.categories import classify_market
from neutralis.core.matcher import MarketPair
from neutralis.logging import get_logger

logger = get_logger(__name__)


def compute_disagreement(
    pairs: list[MarketPair],
) -> tuple[float, dict[str, dict], int]:
    """Compute the Neutralis Disagreement Index from matched market pairs.

    For each pair: abs(kalshi_yes_ask - polymarket_yes_ask)
    Aggregates into overall average and per-category breakdown.

    Returns:
        (overall_avg, by_category, sample_size)

        by_category: {category: {"avg": float, "max": float, "count": int}}
    """
    if not pairs:
        return 0.0, {}, 0

    diffs: list[float] = []
    category_diffs: dict[str, list[float]] = {}

    for pair in pairs:
        k = pair.kalshi_market
        p = pair.polymarket_market

        if k.yes_ask <= 0 or p.yes_ask <= 0:
            continue

        diff = abs(k.yes_ask - p.yes_ask)
        diffs.append(diff)

        cat = classify_market(k.title, k.event_ticker)
        if cat not in category_diffs:
            category_diffs[cat] = []
        category_diffs[cat].append(diff)

    if not diffs:
        return 0.0, {}, 0

    overall = sum(diffs) / len(diffs)

    by_category: dict[str, dict] = {}
    for cat, cat_diffs in category_diffs.items():
        by_category[cat] = {
            "avg": round(sum(cat_diffs) / len(cat_diffs), 6),
            "max": round(max(cat_diffs), 6),
            "count": len(cat_diffs),
        }

    logger.info(
        "Disagreement index: overall=%.4f across %d pairs, %d categories",
        overall, len(diffs), len(by_category),
    )

    return round(overall, 6), by_category, len(diffs)
