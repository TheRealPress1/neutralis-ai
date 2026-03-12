"""OddsPipe-powered supplementary match discovery.

Uses the OddsPipe API to find cross-platform pairs that our TF-IDF
matcher and Attena might miss. OddsPipe maintains 2,500+ pre-matched
pairs using fuzzy title matching with sport-specific validation rules.

Runs as an optional supplementary pass after the primary matcher and
Attena, controlled by ODDSPIPE_API_KEY env var (present = enabled).
"""

from __future__ import annotations

import os
from typing import Any

from neutralis.core.matcher import MarketPair
from neutralis.logging import get_logger
from neutralis.models import NormalizedMarket
from neutralis.venues.oddspipe_client import OddsPipeClient

logger = get_logger(__name__)


def _get_api_key() -> str:
    return os.environ.get("ODDSPIPE_API_KEY", "")


def is_oddspipe_enabled() -> bool:
    """Enabled when an API key is set."""
    return bool(_get_api_key())


def _normalize_title(title: str) -> str:
    """Lowercase, strip, collapse whitespace for fuzzy comparison."""
    return " ".join(title.lower().split())


def _build_title_index(
    markets: dict[str, NormalizedMarket],
) -> dict[str, list[NormalizedMarket]]:
    """Build a normalized-title → market lookup for O(1) matching."""
    index: dict[str, list[NormalizedMarket]] = {}
    for m in markets.values():
        key = _normalize_title(m.title)
        index.setdefault(key, []).append(m)
    return index


def _find_market_by_title(
    oddspipe_title: str,
    title_index: dict[str, list[NormalizedMarket]],
    already_matched: set[str],
) -> NormalizedMarket | None:
    """Find a NormalizedMarket matching an OddsPipe title.

    Strategies (in order):
    1. Exact normalized title match
    2. OddsPipe title contained in our title (or vice versa)
    """
    norm = _normalize_title(oddspipe_title)
    if not norm:
        return None

    # Strategy 1: Exact title match
    candidates = title_index.get(norm, [])
    for m in candidates:
        if m.ticker not in already_matched:
            return m

    # Strategy 2: Substring containment (handles slight title variations)
    # OddsPipe: "Giannis Antetokounmpo: 25+ points"
    # Ours:     "Giannis Antetokounmpo: 25+ points?"  (trailing punctuation)
    for key, markets in title_index.items():
        if norm in key or key in norm:
            for m in markets:
                if m.ticker not in already_matched:
                    return m

    return None


def discover_supplementary_pairs(
    kalshi_markets: dict[str, NormalizedMarket],
    poly_markets: dict[str, NormalizedMarket],
    existing_pairs: list[MarketPair],
) -> list[MarketPair]:
    """Use OddsPipe to find cross-platform pairs our other matchers missed.

    Strategy:
    1. Fetch pre-matched pairs from OddsPipe /v1/spreads
    2. For each pair, find corresponding NormalizedMarket in our data by title
    3. If both sides found and not already matched, add as supplementary pair

    Returns only NEW pairs not already in existing_pairs.
    """
    api_key = _get_api_key()
    if not api_key:
        return []

    # Build sets of already-matched tickers for fast dedup
    matched_kalshi: set[str] = {p.kalshi_market.ticker for p in existing_pairs}
    matched_poly: set[str] = {p.polymarket_market.ticker for p in existing_pairs}

    # Build title indexes for O(1) lookup
    kalshi_title_idx = _build_title_index(kalshi_markets)
    poly_title_idx = _build_title_index(poly_markets)

    try:
        with OddsPipeClient(api_key) as client:
            spread_items = client.get_spreads(
                limit=200,
                min_score=50.0,
            )
    except Exception:
        logger.warning("OddsPipe discovery failed, skipping", exc_info=True)
        return []

    new_pairs: list[MarketPair] = []
    seen_keys: set[str] = set()

    for item in spread_items:
        # Find Kalshi side in our data
        k_market = _find_market_by_title(
            item.kalshi_title, kalshi_title_idx, matched_kalshi,
        )
        if k_market is None:
            continue

        # Find Polymarket side in our data
        p_market = _find_market_by_title(
            item.poly_title, poly_title_idx, matched_poly,
        )
        if p_market is None:
            continue

        # Dedup
        key = f"{k_market.ticker}:{p_market.ticker}"
        if key in seen_keys:
            continue
        seen_keys.add(key)

        # Use OddsPipe match score (0-100) mapped to 0-1 similarity
        similarity = min(item.score / 100.0, 1.0)

        pair = MarketPair(
            kalshi_market=k_market,
            polymarket_market=p_market,
            similarity=similarity,
        )
        new_pairs.append(pair)
        matched_kalshi.add(k_market.ticker)
        matched_poly.add(p_market.ticker)

        logger.info(
            "OddsPipe pair: '%s' <-> '%s' (score=%.0f, spread=%.2f)",
            k_market.title[:50], p_market.title[:50],
            item.score, item.yes_diff,
        )

    if new_pairs:
        logger.info(
            "OddsPipe discovery: %d supplementary pairs from %d candidates",
            len(new_pairs), len(spread_items),
        )

    return new_pairs
