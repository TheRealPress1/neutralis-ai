"""Attena-powered supplementary match discovery.

Uses the Attena search API to find cross-platform pairs that our TF-IDF
matcher might miss due to naming divergence (e.g., "Cleveland" vs "Cavaliers").

Runs as an optional supplementary pass after the primary matcher, controlled
by ATTENA_DISCOVERY_ENABLED env var.
"""

from __future__ import annotations

import os
from typing import Any

from neutralis.core.matcher import MarketPair
from neutralis.logging import get_logger
from neutralis.models import NormalizedMarket
from neutralis.venues.attena_client import AttenaClient, AttenaMarket, DISCOVERY_QUERIES

logger = get_logger(__name__)


def is_attena_enabled() -> bool:
    """Check if Attena discovery is enabled via env var."""
    return os.environ.get("ATTENA_DISCOVERY_ENABLED", "").lower() in ("true", "1", "yes")


def discover_supplementary_pairs(
    kalshi_markets: dict[str, NormalizedMarket],
    poly_markets: dict[str, NormalizedMarket],
    existing_pairs: list[MarketPair],
) -> list[MarketPair]:
    """Use Attena to find cross-platform pairs our matcher missed.

    Strategy:
    1. Search Attena with category-level queries (not per-market)
    2. For each Attena result pair (same event, different venues), check if
       we have both markets in our data
    3. If we do, and they're not already matched, add as a supplementary pair

    Returns only NEW pairs not already in existing_pairs.
    """
    if not is_attena_enabled():
        return []

    # Build sets of already-matched tickers for fast dedup
    matched_kalshi = {p.kalshi_market.ticker for p in existing_pairs}
    matched_poly = {p.polymarket_market.ticker for p in existing_pairs}

    new_pairs: list[MarketPair] = []
    seen_keys: set[str] = set()

    try:
        with AttenaClient() as client:
            attena_pairs = client.discover_cross_platform_pairs(
                DISCOVERY_QUERIES,
                limit_per_query=50,
            )
    except Exception:
        logger.warning("Attena discovery failed, skipping supplementary pairs", exc_info=True)
        return []

    for kalshi_hit, poly_hit in attena_pairs:
        # Skip if either side is already matched
        if kalshi_hit.ticker in matched_kalshi:
            continue

        # Try to find the corresponding markets in our data
        k_market = kalshi_markets.get(kalshi_hit.ticker)
        if k_market is None:
            # Try matching by market_id (sometimes ticker format differs)
            k_market = kalshi_markets.get(kalshi_hit.market_id)
        if k_market is None:
            continue

        # Find matching Polymarket market by searching our data
        p_market = _find_poly_match(poly_hit, poly_markets, matched_poly)
        if p_market is None:
            continue

        # Dedup key
        key = f"{k_market.ticker}:{p_market.ticker}"
        if key in seen_keys:
            continue
        seen_keys.add(key)

        pair = MarketPair(
            kalshi_market=k_market,
            polymarket_market=p_market,
            similarity=0.50,  # Lower confidence since Attena-discovered
        )
        new_pairs.append(pair)
        matched_kalshi.add(k_market.ticker)
        matched_poly.add(p_market.ticker)

        logger.info(
            "Attena supplementary pair: '%s' <-> '%s'",
            k_market.title[:60], p_market.title[:60],
        )

    if new_pairs:
        logger.info(
            "Attena discovery: %d supplementary cross-platform pairs found",
            len(new_pairs),
        )

    return new_pairs


def _find_poly_match(
    attena_hit: AttenaMarket,
    poly_markets: dict[str, NormalizedMarket],
    already_matched: set[str],
) -> NormalizedMarket | None:
    """Find the corresponding Polymarket market in our data for an Attena hit.

    Tries multiple matching strategies:
    1. Exact ticker match (Attena ticker == our ticker)
    2. Attena market_id match (numeric Polymarket ID)
    3. Title substring match (fallback)
    """
    # Strategy 1: Direct ticker match
    if attena_hit.ticker in poly_markets and attena_hit.ticker not in already_matched:
        return poly_markets[attena_hit.ticker]

    # Strategy 2: Search by Attena's market_id
    for ticker, nm in poly_markets.items():
        if ticker in already_matched:
            continue
        # Polymarket tickers often include the event slug
        if attena_hit.market_id and attena_hit.market_id in ticker:
            return nm

    # Strategy 3: Title-based fallback — find a Polymarket market whose title
    # contains the same outcome label and event category
    if attena_hit.outcome_label and attena_hit.league:
        label_lower = attena_hit.outcome_label.lower()
        for ticker, nm in poly_markets.items():
            if ticker in already_matched:
                continue
            if nm.title and label_lower in nm.title.lower():
                return nm

    return None
