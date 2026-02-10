"""Cross-platform market matcher using fuzzy text similarity."""

from __future__ import annotations

import string
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Optional

from neutralis.config import MatchingConfig
from neutralis.logging import get_logger
from neutralis.models import NormalizedMarket

logger = get_logger(__name__)

_STOP_WORDS = frozenset({
    "will", "the", "a", "an", "be", "in", "on", "at", "to", "of",
    "by", "for", "is", "it", "or", "and", "this", "that", "does",
    "do", "has", "have", "been", "was", "were", "are", "not", "no",
    "yes", "what", "which", "who", "how", "than", "more", "before",
})


@dataclass(frozen=True)
class MarketPair:
    """A matched pair of markets from two different venues."""
    kalshi_market: NormalizedMarket
    polymarket_market: NormalizedMarket
    similarity: float


def _normalize_text(text: str) -> str:
    """Lowercase, strip punctuation, remove stop words, collapse whitespace."""
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    tokens = text.split()
    tokens = [t for t in tokens if t not in _STOP_WORDS and len(t) > 1]
    return " ".join(tokens)


def _significant_tokens(text: str) -> frozenset[str]:
    """Extract tokens of 3+ characters for pre-filtering."""
    normalized = _normalize_text(text)
    return frozenset(t for t in normalized.split() if len(t) >= 3)


def match_markets(
    kalshi_markets: list[NormalizedMarket],
    poly_markets: list[NormalizedMarket],
    config: MatchingConfig | None = None,
) -> list[MarketPair]:
    """Find overlapping markets between Kalshi and Polymarket.

    Two-pass approach:
    1. Pre-filter: skip pairs with zero significant token overlap
    2. Fuzzy match: SequenceMatcher.ratio() on normalized titles

    Each Kalshi market matches at most one Polymarket market (best score).
    """
    cfg = config or MatchingConfig()
    pairs: list[MarketPair] = []

    # Pre-compute normalized text and tokens
    # Filter out Kalshi multi-leg parlays (commas in title = combo bet)
    kalshi_prepared = [
        (m, _normalize_text(m.title), _significant_tokens(m.title))
        for m in kalshi_markets
        if m.title and "," not in m.title
    ]
    poly_prepared = [
        (m, _normalize_text(m.title), _significant_tokens(m.title))
        for m in poly_markets
        if m.title
    ]

    logger.info(
        "Matching %d Kalshi x %d Polymarket markets",
        len(kalshi_prepared), len(poly_prepared),
    )

    for k_market, k_text, k_tokens in kalshi_prepared:
        if not k_tokens:
            continue

        best_match: Optional[MarketPair] = None
        best_score = 0.0

        for p_market, p_text, p_tokens in poly_prepared:
            # Pre-filter: require at least min_token_overlap shared tokens
            if len(k_tokens & p_tokens) < cfg.min_token_overlap:
                continue

            score = SequenceMatcher(None, k_text, p_text).ratio()

            if score >= cfg.min_similarity and score > best_score:
                best_score = score
                best_match = MarketPair(
                    kalshi_market=k_market,
                    polymarket_market=p_market,
                    similarity=round(score, 4),
                )

        if best_match is not None:
            pairs.append(best_match)

    logger.info(
        "Matching complete: %d pairs found",
        len(pairs),
    )
    for pair in pairs[:10]:  # Log first 10 matches
        logger.info(
            "Matched: '%s' <-> '%s' (%.2f)",
            pair.kalshi_market.title[:60],
            pair.polymarket_market.title[:60],
            pair.similarity,
        )
    if len(pairs) > 10:
        logger.info("... and %d more matches", len(pairs) - 10)

    return pairs
