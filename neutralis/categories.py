"""Market category classifier and per-category risk adjustment."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from neutralis.config import PipelineConfig


# ---------------------------------------------------------------------------
# Category metadata
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CategoryMeta:
    slug: str
    label: str
    color: str
    description: str
    keywords: tuple[str, ...]


ALL_CATEGORIES: tuple[CategoryMeta, ...] = (
    CategoryMeta(
        slug="politics",
        label="Politics",
        color="#3b82f6",
        description="Elections, legislation, and government policy",
        keywords=(
            "election", "president", "congress", "senate", "governor",
            "ballot", "impeach", "democrat", "republican", "parliament",
            "vote", "primary", "caucus", "political", "legislation",
            "house of representatives", "speaker", "veto", "inaugur",
            "campaign", "nominee", "gop", "dnc", "rnc",
        ),
    ),
    CategoryMeta(
        slug="economics",
        label="Economics",
        color="#f59e0b",
        description="GDP, inflation, interest rates, and macro indicators",
        keywords=(
            "gdp", "inflation", "fed ", "federal reserve", "interest rate",
            "unemployment", "jobs report", "recession", "treasury",
            "cpi", "ppi", "fomc", "rate cut", "rate hike", "tariff",
            "trade deficit", "nonfarm", "payroll", "housing start",
            "consumer confidence", "retail sales", "economic",
        ),
    ),
    CategoryMeta(
        slug="crypto",
        label="Crypto",
        color="#a855f7",
        description="Cryptocurrencies, blockchain, and digital assets",
        keywords=(
            "bitcoin", "ethereum", "crypto", "token", "defi",
            "blockchain", "btc", "eth", "solana", "sol ",
            "dogecoin", "doge", "ripple", "xrp", "nft",
            "stablecoin", "binance", "coinbase", "altcoin", "mining",
            "halving", "web3",
        ),
    ),
    CategoryMeta(
        slug="sports",
        label="Sports",
        color="#22c55e",
        description="Professional and collegiate sporting events",
        keywords=(
            "nfl", "nba", "mlb", "nhl", "soccer", "tennis",
            "championship", "playoff", "super bowl", "world cup",
            "world series", "stanley cup", "finals", "mvp",
            "grand slam", "premier league", "champions league",
            "ufc", "mma", "boxing", "pga", "golf", "f1",
            "formula 1", "olympics", "ncaa", "march madness",
        ),
    ),
    CategoryMeta(
        slug="entertainment",
        label="Entertainment",
        color="#ec4899",
        description="Awards, box office, music, and pop culture",
        keywords=(
            "oscar", "grammy", "emmy", "tony", "golden globe",
            "box office", "movie", "tv show", "album", "netflix",
            "spotify", "billboard", "streaming", "celebrity",
            "reality tv", "bachelor", "disney", "marvel",
            "star wars", "ticket sales", "concert",
        ),
    ),
    CategoryMeta(
        slug="science_tech",
        label="Science & Tech",
        color="#06b6d4",
        description="Space, AI, biotech, and technology milestones",
        keywords=(
            "spacex", "nasa", "artificial intelligence", " ai ",
            "fda", "drug approval", "patent", "launch", "ipo",
            "apple", "google", "microsoft", "tesla", "openai",
            "robot", "quantum", "gene", "vaccine", "clinical trial",
            "satellite", "rocket", "mars", "moon", "starship",
        ),
    ),
    CategoryMeta(
        slug="weather",
        label="Weather",
        color="#f97316",
        description="Hurricanes, temperature records, and natural events",
        keywords=(
            "hurricane", "tornado", "temperature", "rainfall",
            "wildfire", "earthquake", "storm", "drought", "flood",
            "blizzard", "heat wave", "cold snap", "el nino",
            "la nina", "climate", "weather", "tsunami",
        ),
    ),
    CategoryMeta(
        slug="other",
        label="Other",
        color="#6b7280",
        description="Markets that don't fit a specific category",
        keywords=(),
    ),
)

# Slug -> CategoryMeta lookup
CATEGORY_MAP: dict[str, CategoryMeta] = {c.slug: c for c in ALL_CATEGORIES}


# ---------------------------------------------------------------------------
# Pre-compiled regex patterns (one per category, skip 'other')
# ---------------------------------------------------------------------------

_CATEGORY_PATTERNS: list[tuple[str, re.Pattern[str]]] = []

for _cat in ALL_CATEGORIES:
    if _cat.slug == "other" or not _cat.keywords:
        continue
    escaped = [re.escape(kw) for kw in _cat.keywords]
    pattern = re.compile("|".join(escaped), re.IGNORECASE)
    _CATEGORY_PATTERNS.append((_cat.slug, pattern))


def classify_market(title: str, event_ticker: str = "") -> str:
    """Classify a market into a category based on its title and event ticker.

    Returns the category slug. First match wins; falls back to 'other'.
    """
    text = f"{title} {event_ticker}"
    for slug, pattern in _CATEGORY_PATTERNS:
        if pattern.search(text):
            return slug
    return "other"


# ---------------------------------------------------------------------------
# Sports sub-category classifier (for directional strategy)
# ---------------------------------------------------------------------------

_SPORT_SERIES_PREFIXES: dict[str, str] = {
    # Tennis
    "KXATPMATCH": "tennis",
    "KXWTAMATCH": "tennis",
    # Soccer
    "KXEPLGAME": "soccer",
    "KXBUNDESLIGAGAME": "soccer",
    "KXLIGUE1GAME": "soccer",
    "KXSERIEAGAME": "soccer",
    "KXBRASILEIROGAME": "soccer",
    "KXSCOTTISHPREMGAME": "soccer",
    "KXUEFAGAME": "soccer",
    # Basketball
    "KXNBA": "basketball",
}

_SPORT_KEYWORDS: dict[str, re.Pattern[str]] = {
    "tennis": re.compile(
        r"tennis|atp|wta|grand slam|australian open|french open|wimbledon|us open",
        re.IGNORECASE,
    ),
    "soccer": re.compile(
        r"soccer|premier league|champions league|bundesliga|serie a|la liga"
        r"|ligue 1|europa league|mls |uefa|fa cup|epl",
        re.IGNORECASE,
    ),
    "basketball": re.compile(
        r"\bnba\b|basketball|nba ",
        re.IGNORECASE,
    ),
}


def classify_sport(title: str, event_ticker: str = "") -> str | None:
    """Classify a market into a sport sub-category.

    Returns "tennis", "soccer", "basketball", or None.
    Uses Kalshi series prefixes first (fast, exact), then keyword fallback.
    """
    # Fast path: match Kalshi series prefix
    upper_ticker = event_ticker.upper()
    for prefix, sport in _SPORT_SERIES_PREFIXES.items():
        if upper_ticker.startswith(prefix):
            return sport

    # Keyword fallback
    text = f"{title} {event_ticker}"
    for sport, pattern in _SPORT_KEYWORDS.items():
        if pattern.search(text):
            return sport

    return None


def classify_directional_category(title: str, event_ticker: str = "") -> str | None:
    """Classify a market for the directional scanner.

    Returns "sports", "crypto", "politics", or None.
    Used to select per-category probability thresholds.
    """
    # Sports first (most common directional)
    if classify_sport(title, event_ticker) is not None:
        return "sports"

    text = f"{title} {event_ticker}"
    category = classify_market(text)
    if category in ("crypto", "politics"):
        return category

    return None


# ---------------------------------------------------------------------------
# Player/team name extraction for live score matching
# ---------------------------------------------------------------------------

_VS_PATTERN = re.compile(
    r"^(.+?)\s+vs\.?\s+(.+?)(?:\s*[-–—]|\s*$)",
    re.IGNORECASE,
)


def extract_match_names(title: str) -> tuple[str, str] | None:
    """Extract two competitor names from a market title.

    Examples:
        "Djokovic vs Sinner - ATP French Open" → ("Djokovic", "Sinner")
        "Arsenal vs Chelsea" → ("Arsenal", "Chelsea")
        "Lakers vs Celtics - NBA" → ("Lakers", "Celtics")

    Returns (name1, name2) or None if parsing fails.
    """
    m = _VS_PATTERN.match(title)
    if not m:
        return None
    return m.group(1).strip(), m.group(2).strip()


def _normalize_name(name: str) -> str:
    """Lowercase, strip common suffixes/prefixes for fuzzy matching."""
    n = name.lower().strip()
    # Remove common sport suffixes
    for suffix in (" fc", " sc", " cf", " afc"):
        if n.endswith(suffix):
            n = n[: -len(suffix)].strip()
    return n


def match_score_to_market_names(
    score_home: str,
    score_away: str,
    market_name1: str,
    market_name2: str,
) -> str | None:
    """Match ESPN score names to market title names.

    Returns "home" if market_name1 maps to score_home,
    "away" if market_name1 maps to score_away,
    or None if no match.

    Uses token-level substring matching — "Djokovic" matches "N. Djokovic"
    and "C. Tabur" matches "Clement Tabur".
    """
    sh = _normalize_name(score_home)
    sa = _normalize_name(score_away)
    m1 = _normalize_name(market_name1)
    m2 = _normalize_name(market_name2)

    # Extract last tokens (surnames) for matching
    sh_tokens = sh.split()
    sa_tokens = sa.split()
    m1_tokens = m1.split()
    m2_tokens = m2.split()

    def _matches(score_tokens: list[str], market_tokens: list[str]) -> bool:
        """Check if the last name in score matches any token in market name, or vice versa."""
        if not score_tokens or not market_tokens:
            return False
        # Last name match (most reliable for athletes)
        s_last = score_tokens[-1]
        m_last = market_tokens[-1]
        if s_last == m_last:
            return True
        # Substring: "djokovic" in "n. djokovic" or "djokovic" in "novak djokovic"
        s_full = " ".join(score_tokens)
        m_full = " ".join(market_tokens)
        if s_last in m_full or m_last in s_full:
            return True
        return False

    # Try: market_name1 = home, market_name2 = away
    if _matches(sh_tokens, m1_tokens) and _matches(sa_tokens, m2_tokens):
        return "home"
    # Try: market_name1 = away, market_name2 = home
    if _matches(sa_tokens, m1_tokens) and _matches(sh_tokens, m2_tokens):
        return "away"

    return None


# ---------------------------------------------------------------------------
# Risk multipliers per risk level
# ---------------------------------------------------------------------------

RISK_MULTIPLIERS: dict[str, dict[str, float]] = {
    "conservative": {"position_mult": 0.5, "min_edge_mult": 1.5},
    "moderate":     {"position_mult": 1.0, "min_edge_mult": 1.0},
    "aggressive":   {"position_mult": 1.5, "min_edge_mult": 0.5},
}


def is_category_enabled(category: str, overrides: dict[str, Any]) -> bool:
    """Check if a category is enabled in the overrides dict.

    If the category is not in overrides, it's enabled by default.
    """
    override = overrides.get(category)
    if override is None:
        return True
    return override.get("enabled", True)


def resolve_pipeline_config(
    base_config: PipelineConfig,
    category: str,
    overrides: dict[str, Any],
) -> PipelineConfig:
    """Apply risk-level multipliers for a category to the base config.

    Returns a new PipelineConfig with adjusted min_edge_pct and max_position_dollars.
    If category has no override, returns base_config unchanged.
    """
    override = overrides.get(category)
    if override is None:
        return base_config

    risk_level = override.get("risk_level", "moderate")
    mults = RISK_MULTIPLIERS.get(risk_level, RISK_MULTIPLIERS["moderate"])

    return PipelineConfig(
        min_edge_pct=base_config.min_edge_pct * mults["min_edge_mult"],
        min_liquidity_dollars=base_config.min_liquidity_dollars,
        max_time_to_expiry_hours=base_config.max_time_to_expiry_hours,
        min_time_to_expiry_hours=base_config.min_time_to_expiry_hours,
        fee_rate=base_config.fee_rate,
        max_position_dollars=base_config.max_position_dollars * mults["position_mult"],
    )
