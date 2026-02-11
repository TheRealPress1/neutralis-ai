"""Cross-platform market matcher with TF-IDF, entity extraction, and temporal matching."""

from __future__ import annotations

import math
import re
import string
from dataclasses import dataclass
from datetime import datetime
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

# Words to exclude from entity extraction (common title words that happen
# to be capitalised at sentence boundaries or in questions).
_ENTITY_STOP = frozenset({
    "will", "the", "a", "an", "be", "in", "on", "at", "to", "of",
    "by", "for", "is", "it", "or", "and", "this", "that", "does",
    "do", "has", "have", "win", "lose", "reach", "hit", "get",
    "make", "take", "over", "under", "before", "after", "during",
    # Common market title words that capitalise but aren't entities
    "super", "bowl", "mvp", "player", "year", "finals", "game",
    "cup", "championship", "series", "round", "season", "award",
    "trophy", "offensive", "defensive", "all-star", "allstar",
    "price", "total", "first", "last", "next", "most", "best",
})

# Regex: sequences of 2+ capitalised words (possibly with hyphens/apostrophes).
_ENTITY_RE = re.compile(r"\b(?:[A-Z][A-Za-z'\-]+(?:\s+|$)){2,}")


@dataclass(frozen=True)
class MarketPair:
    """A matched pair of markets from two different venues."""
    kalshi_market: NormalizedMarket
    polymarket_market: NormalizedMarket
    similarity: float


# ---------------------------------------------------------------------------
# Text normalisation (unchanged from v1)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# TF-IDF
# ---------------------------------------------------------------------------

def _build_idf(titles: list[str]) -> dict[str, float]:
    """Build an IDF table from all market titles.

    IDF(t) = log(N / df(t))  where df(t) = number of titles containing token t.
    """
    n = len(titles)
    if n == 0:
        return {}

    doc_freq: dict[str, int] = {}
    for title in titles:
        seen: set[str] = set()
        for token in _normalize_text(title).split():
            if len(token) >= 3 and token not in seen:
                doc_freq[token] = doc_freq.get(token, 0) + 1
                seen.add(token)

    return {t: math.log(n / df) for t, df in doc_freq.items()}


def _tfidf_jaccard(
    tokens_a: frozenset[str],
    tokens_b: frozenset[str],
    idf: dict[str, float],
) -> float:
    """Weighted Jaccard similarity using IDF weights."""
    union = tokens_a | tokens_b
    if not union:
        return 0.0

    shared = tokens_a & tokens_b
    default_idf = 1.0  # fallback for unseen tokens

    shared_weight = sum(idf.get(t, default_idf) for t in shared)
    union_weight = sum(idf.get(t, default_idf) for t in union)

    return shared_weight / union_weight if union_weight > 0 else 0.0


# ---------------------------------------------------------------------------
# Entity extraction
# ---------------------------------------------------------------------------

def _extract_entities(title: str) -> set[str]:
    """Extract proper-noun sequences from the original (pre-lowercase) title.

    Heuristic: runs of 2+ consecutive capitalised words form an entity.
    Single capitalised words that aren't common verbs/prepositions also count.
    Returns lowercased entity strings for comparison.
    """
    entities: set[str] = set()

    # Multi-word entities (2+ consecutive capitalised words)
    for match in _ENTITY_RE.finditer(title):
        raw = match.group().strip()
        words = raw.split()
        # Drop leading/trailing stop words
        while words and words[0].lower() in _ENTITY_STOP:
            words = words[1:]
        while words and words[-1].lower() in _ENTITY_STOP:
            words = words[:-1]
        if len(words) >= 2:
            entities.add(" ".join(words).lower())

    # Single capitalised words (proper nouns) — skip the first word (sentence start)
    words = title.split()
    for w in words[1:]:
        clean = w.strip(string.punctuation)
        if (
            clean
            and clean[0].isupper()
            and clean.lower() not in _ENTITY_STOP
            and clean.lower() not in _STOP_WORDS
            and len(clean) >= 3
        ):
            entities.add(clean.lower())

    return entities


def _entity_overlap(entities_a: set[str], entities_b: set[str]) -> float:
    """Score 0-1 based on shared entities between two markets.

    Uses substring matching: entity from A counts as shared if it appears
    as a substring of any entity from B, or vice versa.
    """
    if not entities_a and not entities_b:
        return 0.0

    max_count = max(len(entities_a), len(entities_b), 1)
    shared = 0

    for ea in entities_a:
        for eb in entities_b:
            if ea in eb or eb in ea:
                shared += 1
                break  # count each entity at most once

    return min(shared / max_count, 1.0)


# ---------------------------------------------------------------------------
# Temporal proximity
# ---------------------------------------------------------------------------

def _temporal_score(market_a: NormalizedMarket, market_b: NormalizedMarket) -> float:
    """Score 0-1 based on how close the expiration dates are."""
    date_a = market_a.expected_expiration or market_a.close_time
    date_b = market_b.expected_expiration or market_b.close_time

    if date_a is None or date_b is None:
        return 0.5  # neutral when dates are missing

    delta_days = abs((date_a - date_b).total_seconds()) / 86400

    if delta_days <= 1:
        return 1.0
    if delta_days <= 7:
        return 0.7
    if delta_days <= 30:
        return 0.4
    return 0.0


# ---------------------------------------------------------------------------
# Main matching function
# ---------------------------------------------------------------------------

def _spread(market: NormalizedMarket) -> float:
    """Bid-ask spread on the YES side. Returns 0 if no two-sided quote."""
    if market.yes_ask > 0 and market.yes_bid > 0:
        return market.yes_ask - market.yes_bid
    return 0.0


def _liquidity_ratio(a: NormalizedMarket, b: NormalizedMarket) -> float:
    """Ratio of the larger liquidity to the smaller.  Returns inf if either is zero."""
    la, lb = a.liquidity, b.liquidity
    if la <= 0 or lb <= 0:
        return float("inf")
    return max(la, lb) / min(la, lb)


def match_markets(
    kalshi_markets: list[NormalizedMarket],
    poly_markets: list[NormalizedMarket],
    config: MatchingConfig | None = None,
) -> list[MarketPair]:
    """Find overlapping markets between Kalshi and Polymarket.

    Three-signal composite scoring:
    1. TF-IDF weighted Jaccard similarity on normalised titles
    2. Entity overlap — shared proper nouns (person, team, event names)
    3. Temporal proximity — how close the expiration dates are

    Post-filters:
    - Liquidity parity: reject if venue liquidity differs by >max_liquidity_ratio
    - Spread check: reject if either side has a bid-ask spread >max_spread
    - Uniqueness: each Polymarket market matches at most one Kalshi market
    """
    cfg = config or MatchingConfig()

    # Pre-compute normalised text and tokens
    # Parlays are now filtered during normalization (mve_selected_legs / "yes "/"no " prefix)
    kalshi_prepared = [
        (m, _normalize_text(m.title), _significant_tokens(m.title))
        for m in kalshi_markets
        if m.title
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

    # Build IDF table from all titles
    all_titles = [m.title for m, _, _ in kalshi_prepared] + [
        m.title for m, _, _ in poly_prepared
    ]
    idf = _build_idf(all_titles)

    # Pre-compute entities
    kalshi_entities = [_extract_entities(m.title) for m, _, _ in kalshi_prepared]
    poly_entities = [_extract_entities(m.title) for m, _, _ in poly_prepared]

    # Collect (score, kalshi_idx, poly_idx, pair) candidates — we'll deduplicate after
    candidates: list[tuple[float, int, int, MarketPair]] = []

    for ki, (k_market, k_text, k_tokens) in enumerate(kalshi_prepared):
        if not k_tokens:
            continue

        k_ents = kalshi_entities[ki]

        for pi, (p_market, p_text, p_tokens) in enumerate(poly_prepared):
            # Pre-filter: require at least min_token_overlap shared tokens
            if len(k_tokens & p_tokens) < cfg.min_token_overlap:
                continue

            # Signal 1: TF-IDF weighted Jaccard
            text_score = _tfidf_jaccard(k_tokens, p_tokens, idf)

            # Signal 2: Entity overlap
            entity_score = _entity_overlap(k_ents, poly_entities[pi])

            # Signal 3: Temporal proximity
            temporal = _temporal_score(k_market, p_market)

            # Composite confidence
            composite = (
                cfg.weight_text * text_score
                + cfg.weight_entity * entity_score
                + cfg.weight_temporal * temporal
            )

            if composite < cfg.min_similarity:
                continue

            # Post-filter: liquidity parity
            liq_ratio = _liquidity_ratio(k_market, p_market)
            if liq_ratio > cfg.max_liquidity_ratio:
                logger.debug(
                    "Rejected (liquidity): '%s' <-> '%s' ratio=%.1f",
                    k_market.title[:40], p_market.title[:40], liq_ratio,
                )
                continue

            # Post-filter: bid-ask spread
            k_spread = _spread(k_market)
            p_spread = _spread(p_market)
            if k_spread > cfg.max_spread or p_spread > cfg.max_spread:
                logger.debug(
                    "Rejected (spread): '%s' (%.2f) <-> '%s' (%.2f)",
                    k_market.title[:40], k_spread,
                    p_market.title[:40], p_spread,
                )
                continue

            pair = MarketPair(
                kalshi_market=k_market,
                polymarket_market=p_market,
                similarity=round(composite, 4),
            )
            candidates.append((composite, ki, pi, pair))

    # Deduplicate: each Kalshi and each Polymarket market matches at most once.
    # Sort by score descending so higher-confidence matches win ties.
    candidates.sort(key=lambda c: c[0], reverse=True)
    used_kalshi: set[int] = set()
    used_poly: set[int] = set()
    pairs: list[MarketPair] = []

    for score, ki, pi, pair in candidates:
        if ki in used_kalshi or pi in used_poly:
            continue
        used_kalshi.add(ki)
        used_poly.add(pi)
        pairs.append(pair)

    logger.info("Matching complete: %d pairs found", len(pairs))
    for pair in pairs[:10]:
        logger.info(
            "Matched: '%s' <-> '%s' (%.2f)",
            pair.kalshi_market.title[:60],
            pair.polymarket_market.title[:60],
            pair.similarity,
        )
    if len(pairs) > 10:
        logger.info("... and %d more matches", len(pairs) - 10)

    return pairs
