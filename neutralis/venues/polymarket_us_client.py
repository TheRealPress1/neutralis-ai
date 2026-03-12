"""Read-only Polymarket US API client using httpx.

Polymarket US (CFTC-regulated) market data endpoints.
No authentication needed for read-only market data.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from neutralis.config import PolymarketUSConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)

_MIN_INTERVAL = 1.0 / 10  # ~100ms, conservative for new API


class PolymarketUSClient:
    """Synchronous, read-only client for Polymarket US market data.

    Uses raw httpx (not the polymarket-us SDK) for market data since
    read endpoints don't require authentication.
    """

    def __init__(self, config: PolymarketUSConfig | None = None) -> None:
        self._cfg = config or PolymarketUSConfig()
        self._http = httpx.Client(
            base_url=self._cfg.base_url,
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
            headers={"Accept": "application/json"},
        )
        self._last_request_ts: float = 0.0

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        self._last_request_ts = time.monotonic()

    def _get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        _retries: int = 0,
    ) -> Any:
        self._throttle()
        resp = self._http.get(path, params=params)

        if resp.status_code == 429:
            retry_after = float(resp.headers.get("Retry-After", "2"))
            logger.warning("Polymarket US rate limited, sleeping %.1fs", retry_after)
            time.sleep(retry_after)
            return self._get(path, params, _retries=_retries)

        if resp.status_code >= 500 and _retries < 3:
            wait = 2.0 * (2**_retries)
            logger.warning(
                "Polymarket US server error %d on %s, retry %d/3 in %.1fs",
                resp.status_code, path, _retries + 1, wait,
            )
            time.sleep(wait)
            return self._get(path, params, _retries=_retries + 1)

        resp.raise_for_status()
        return resp.json()

    def get_markets(
        self,
        *,
        limit: int | None = None,
        offset: int = 0,
        active: bool = True,
    ) -> list[dict[str, Any]]:
        """Fetch a page of markets from Polymarket US."""
        params: dict[str, Any] = {
            "limit": limit or self._cfg.default_market_limit,
            "offset": offset,
            "active": str(active).lower(),
        }
        data = self._get("/v1/markets", params)
        # Response may be a list or wrapped in an object
        if isinstance(data, list):
            markets = data
        elif isinstance(data, dict):
            markets = data.get("markets", data.get("data", []))
            if isinstance(markets, dict):
                markets = [markets]
        else:
            markets = []
        logger.info(
            "Fetched %d Polymarket US markets (offset=%d)", len(markets), offset,
        )
        return markets if isinstance(markets, list) else []

    def get_all_active_markets(
        self, *, max_pages: int | None = None
    ) -> list[dict[str, Any]]:
        """Page through active markets up to *max_pages* pages."""
        cap = max_pages or self._cfg.max_pages
        limit = self._cfg.default_market_limit
        all_markets: list[dict[str, Any]] = []
        page = 0
        for page in range(cap):
            batch = self.get_markets(limit=limit, offset=page * limit, active=True)
            all_markets.extend(batch)
            if len(batch) < limit:
                break
            if page + 1 >= cap:
                logger.info(
                    "Polymarket US reached page cap (%d pages), stopping early", cap,
                )
        logger.info(
            "Total Polymarket US markets fetched: %d (%d pages)",
            len(all_markets), page + 1,
        )
        return all_markets

    def get_market_by_slug(self, slug: str) -> dict[str, Any] | None:
        """Fetch a single market by its slug."""
        try:
            return self._get(f"/v1/markets/{slug}")
        except httpx.HTTPStatusError:
            logger.warning("Failed to fetch Polymarket US market %s", slug)
            return None

    def get_orderbook(self, slug: str) -> dict[str, Any]:
        """Fetch orderbook for a market slug."""
        return self._get(f"/v1/markets/{slug}/book")

    def get_bbo(self, slug: str) -> dict[str, Any]:
        """Fetch best bid/offer for a market slug."""
        return self._get(f"/v1/markets/{slug}/bbo")

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> PolymarketUSClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
