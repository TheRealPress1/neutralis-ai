"""OddsPipe API client for cross-platform pair discovery.

OddsPipe normalizes Kalshi and Polymarket data into a single schema,
providing 2,500+ pre-matched market pairs with spread detection.
We use it as a supplementary data source alongside the TF-IDF matcher
and Attena to maximize cross-platform pair coverage.

API: GET https://oddspipe.com/v1/spreads
Auth: X-API-Key header.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

from neutralis.logging import get_logger

logger = get_logger(__name__)

_BASE_URL = "https://oddspipe.com"
_SPREADS_PATH = "/v1/spreads"
_MIN_INTERVAL = 0.6  # Conservative: 100 req/min ≈ 1.67/sec, we stay under
_DEFAULT_TIMEOUT = 15.0


@dataclass(frozen=True)
class OddsPipeSpreadItem:
    """A single matched pair from the OddsPipe spreads endpoint."""
    match_id: int
    score: float           # Match quality 0-100
    kalshi_title: str
    kalshi_yes_price: float
    kalshi_no_price: float
    kalshi_volume: float
    poly_title: str
    poly_yes_price: float
    poly_no_price: float
    poly_volume: float
    yes_diff: float        # Absolute YES price difference
    direction: str         # "polymarket_higher" or "kalshi_higher"


def _parse_spread_item(raw: dict[str, Any]) -> OddsPipeSpreadItem | None:
    """Parse a single spread item from the OddsPipe API response."""
    try:
        k = raw.get("kalshi", {})
        p = raw.get("polymarket", {})
        s = raw.get("spread", {})
        return OddsPipeSpreadItem(
            match_id=int(raw.get("match_id", 0)),
            score=float(raw.get("score", 0)),
            kalshi_title=k.get("title", ""),
            kalshi_yes_price=float(k.get("yes_price", 0)),
            kalshi_no_price=float(k.get("no_price", 0)),
            kalshi_volume=float(k.get("volume_usd", 0)),
            poly_title=p.get("title", ""),
            poly_yes_price=float(p.get("yes_price", 0)),
            poly_no_price=float(p.get("no_price", 0)),
            poly_volume=float(p.get("volume_usd", 0)),
            yes_diff=float(s.get("yes_diff", 0)),
            direction=s.get("direction", ""),
        )
    except (ValueError, TypeError):
        return None


class OddsPipeClient:
    """Synchronous client for the OddsPipe prediction market API.

    Used to discover cross-platform market matches via their
    pre-computed pair matching (2,500+ pairs, fuzzy title match
    with sport-specific validation).
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = _BASE_URL,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self._api_key = api_key
        self._http = httpx.Client(
            base_url=base_url,
            timeout=httpx.Timeout(connect=5.0, read=timeout, write=5.0, pool=5.0),
            headers={
                "Accept": "application/json",
                "X-API-Key": api_key,
            },
        )
        self._last_request_ts: float = 0.0

    def __enter__(self) -> OddsPipeClient:
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

    def get_spreads(
        self,
        limit: int = 200,
        min_spread: float = 0.0,
        min_score: float = 50.0,
        top_n: int = 500,
    ) -> list[OddsPipeSpreadItem]:
        """Fetch pre-matched cross-platform pairs sorted by spread size.

        Args:
            limit: Max pairs to return (1-200).
            min_spread: Minimum YES price difference to include.
            min_score: Minimum match quality score (0-100).
            top_n: Consider top N pairs by min(volume) (1-500).

        Returns:
            List of parsed spread items.
        """
        self._throttle()
        params: dict[str, Any] = {"limit": min(limit, 200), "top_n": min(top_n, 500)}
        if min_spread > 0:
            params["min_spread"] = min_spread
        if min_score > 0:
            params["min_score"] = min_score

        try:
            resp = self._http.get(_SPREADS_PATH, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            logger.warning("OddsPipe spreads request timed out")
            return []
        except httpx.HTTPStatusError as e:
            logger.warning("OddsPipe spreads HTTP %d", e.response.status_code)
            return []
        except Exception:
            logger.warning("OddsPipe spreads request failed", exc_info=True)
            return []

        items: list[OddsPipeSpreadItem] = []
        for raw in data.get("items", []):
            parsed = _parse_spread_item(raw)
            if parsed is not None:
                items.append(parsed)

        logger.info(
            "OddsPipe: fetched %d spread pairs (total=%d)",
            len(items), data.get("total", 0),
        )
        return items
