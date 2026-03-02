"""Attena search API client for cross-platform market discovery.

Attena normalizes market names across Kalshi and Polymarket with 1,700+ team
aliases, providing a unified search layer. We use it as a supplementary data
source to discover cross-platform matches our TF-IDF matcher might miss.

API: GET https://attena-api.fly.dev/api/search?q=<query>&limit=<n>
No auth required. Returns structured JSON with markets from both venues.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from neutralis.logging import get_logger

logger = get_logger(__name__)

_BASE_URL = "https://attena-api.fly.dev"
_SEARCH_PATH = "/api/search/"
_MIN_INTERVAL = 2.0  # Conservative rate limit (30 req/min anonymous tier)
_DEFAULT_TIMEOUT = 15.0


@dataclass(frozen=True)
class AttenaMarket:
    """A single market result from the Attena search API."""
    id: str
    title: str
    category: str
    subcategory: str
    league: str
    event_date: str
    source: str  # "kalshi" or "polymarket"
    market_id: str  # Kalshi ticker or Polymarket slug
    yes_price: float
    no_price: float
    volume: float
    volume_24h: float
    rank: float
    source_url: str
    close_time: str
    bracket_count: int  # Number of outcomes (1=binary, 3=three-way, etc.)
    outcome_label: str
    ticker: str

    @property
    def is_kalshi(self) -> bool:
        return self.source == "kalshi"

    @property
    def is_polymarket(self) -> bool:
        return self.source == "polymarket"


@dataclass
class AttenaSearchResult:
    """Parsed response from the Attena search API."""
    query: str
    results: list[AttenaMarket]
    total: int
    latency_ms: float

    @property
    def kalshi_results(self) -> list[AttenaMarket]:
        return [r for r in self.results if r.is_kalshi]

    @property
    def polymarket_results(self) -> list[AttenaMarket]:
        return [r for r in self.results if r.is_polymarket]


def _parse_market(raw: dict[str, Any]) -> AttenaMarket | None:
    """Parse a single market from the Attena API response."""
    try:
        return AttenaMarket(
            id=raw.get("id", ""),
            title=raw.get("title", ""),
            category=raw.get("category", ""),
            subcategory=raw.get("subcategory", ""),
            league=raw.get("league", ""),
            event_date=raw.get("event_date", ""),
            source=raw.get("source", ""),
            market_id=raw.get("market_id", ""),
            yes_price=float(raw.get("yes_price", 0)),
            no_price=float(raw.get("no_price", 0)),
            volume=float(raw.get("volume", 0)),
            volume_24h=float(raw.get("volume_24h", 0)),
            rank=float(raw.get("rank", 0)),
            source_url=raw.get("source_url", ""),
            close_time=raw.get("close_time", ""),
            bracket_count=int(raw.get("bracket_count", 1)),
            outcome_label=raw.get("outcome_label", ""),
            ticker=raw.get("ticker", ""),
        )
    except (ValueError, TypeError):
        return None


class AttenaClient:
    """Synchronous client for the Attena prediction market search API.

    Used to discover cross-platform market matches via their normalized
    search index (1,700+ team aliases, structured categories).
    """

    def __init__(
        self,
        base_url: str = _BASE_URL,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self._base_url = base_url
        self._http = httpx.Client(
            base_url=base_url,
            timeout=httpx.Timeout(connect=5.0, read=timeout, write=5.0, pool=5.0),
            headers={"Accept": "application/json"},
        )
        self._last_request_ts: float = 0.0

    def __enter__(self) -> AttenaClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        self._last_request_ts = time.monotonic()

    def search(self, query: str, limit: int = 50) -> AttenaSearchResult:
        """Search for markets across Kalshi and Polymarket.

        Args:
            query: Natural language search query (e.g., "NBA tonight", "Premier League")
            limit: Max results to return (default 50)

        Returns:
            AttenaSearchResult with parsed market data from both venues.
        """
        self._throttle()
        try:
            resp = self._http.get(
                _SEARCH_PATH,
                params={"q": query, "limit": limit, "mode": "lite"},
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            logger.warning("Attena search timed out for query=%r", query)
            return AttenaSearchResult(query=query, results=[], total=0, latency_ms=0)
        except httpx.HTTPStatusError as e:
            logger.warning("Attena search HTTP %d for query=%r", e.response.status_code, query)
            return AttenaSearchResult(query=query, results=[], total=0, latency_ms=0)
        except Exception:
            logger.warning("Attena search failed for query=%r", query, exc_info=True)
            return AttenaSearchResult(query=query, results=[], total=0, latency_ms=0)

        raw_results = data.get("results", [])
        meta = data.get("meta", {})

        markets = []
        for raw in raw_results:
            m = _parse_market(raw)
            if m is not None:
                markets.append(m)

        return AttenaSearchResult(
            query=query,
            results=markets,
            total=meta.get("total", len(markets)),
            latency_ms=meta.get("latency_ms", 0),
        )

    def search_category(self, category: str, limit: int = 50) -> AttenaSearchResult:
        """Search for all markets in a category."""
        return self.search(category, limit=limit)

    def discover_cross_platform_pairs(
        self,
        queries: list[str],
        limit_per_query: int = 50,
    ) -> list[tuple[AttenaMarket, AttenaMarket]]:
        """Discover potential cross-platform pairs by searching multiple queries.

        For each query, finds markets from both Kalshi and Polymarket that
        share the same subcategory/league/event_date — indicating they're
        likely the same underlying event.

        Returns list of (kalshi_market, polymarket_market) pairs.
        """
        all_kalshi: list[AttenaMarket] = []
        all_poly: list[AttenaMarket] = []

        for query in queries:
            result = self.search(query, limit=limit_per_query)
            all_kalshi.extend(result.kalshi_results)
            all_poly.extend(result.polymarket_results)
            logger.info(
                "Attena search %r: %d Kalshi, %d Polymarket (total=%d)",
                query, len(result.kalshi_results), len(result.polymarket_results),
                result.total,
            )

        # Group by (subcategory, league, event_date, outcome_label) to find pairs
        pairs: list[tuple[AttenaMarket, AttenaMarket]] = []
        poly_by_key: dict[str, list[AttenaMarket]] = {}

        for pm in all_poly:
            key = f"{pm.subcategory}|{pm.league}|{pm.event_date}|{pm.outcome_label}".lower()
            poly_by_key.setdefault(key, []).append(pm)

        matched_poly_ids: set[str] = set()
        for km in all_kalshi:
            key = f"{km.subcategory}|{km.league}|{km.event_date}|{km.outcome_label}".lower()
            candidates = poly_by_key.get(key, [])
            for pm in candidates:
                if pm.id not in matched_poly_ids:
                    pairs.append((km, pm))
                    matched_poly_ids.add(pm.id)
                    break

        logger.info(
            "Attena discovery: %d Kalshi, %d Polymarket -> %d cross-platform pairs",
            len(all_kalshi), len(all_poly), len(pairs),
        )
        return pairs


# ---------------------------------------------------------------------------
# Convenience: discovery queries for categories we trade
# ---------------------------------------------------------------------------

DISCOVERY_QUERIES = [
    # Sports - tournament winners (confirmed cross-platform overlap)
    "Premier League winner",
    "Champions League winner",
    "NBA champion",
    "NHL Stanley Cup",
    "MLB World Series",
    # Soccer match markets (3-way)
    "Premier League match",
    # Politics / Economics (massive cross-platform volume)
    "Fed Chair",
    "Bitcoin price",
]
