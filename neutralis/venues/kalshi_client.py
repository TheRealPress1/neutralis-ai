"""Read-only Kalshi API client using httpx."""

from __future__ import annotations

import time
from typing import Any, Optional

import httpx

from neutralis.config import KalshiConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)

_MIN_INTERVAL = 1.0 / 10  # ~100ms, conservative headroom under 20 req/sec


class KalshiClient:
    """Synchronous, read-only client for Kalshi public market data.

    No authentication needed -- markets and orderbook endpoints are public.
    """

    def __init__(self, config: KalshiConfig | None = None) -> None:
        self._cfg = config or KalshiConfig()
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
        self, path: str, params: dict[str, Any] | None = None, *, _retries: int = 0
    ) -> dict[str, Any]:
        self._throttle()
        resp = self._http.get(path, params=params)

        if resp.status_code == 429:
            retry_after = float(resp.headers.get("Retry-After", "2"))
            logger.warning("Rate limited, sleeping %.1fs", retry_after)
            time.sleep(retry_after)
            return self._get(path, params, _retries=_retries)

        if resp.status_code >= 500 and _retries < 3:
            wait = 2.0 * (2**_retries)
            logger.warning(
                "Server error %d on %s, retry %d/3 in %.1fs",
                resp.status_code, path, _retries + 1, wait,
            )
            time.sleep(wait)
            return self._get(path, params, _retries=_retries + 1)

        resp.raise_for_status()
        return resp.json()

    def get_markets(
        self,
        *,
        statuses: str = "active",
        limit: int | None = None,
        cursor: str | None = None,
        event_ticker: str | None = None,
        series_ticker: str | None = None,
        tickers: list[str] | None = None,
    ) -> tuple[list[dict[str, Any]], Optional[str]]:
        """Fetch a page of markets. Returns (markets, next_cursor)."""
        params: dict[str, Any] = {"statuses": statuses}
        params["limit"] = limit or self._cfg.default_market_limit
        if cursor:
            params["cursor"] = cursor
        if event_ticker:
            params["event_ticker"] = event_ticker
        if series_ticker:
            params["series_ticker"] = series_ticker
        if tickers:
            params["tickers"] = ",".join(tickers)

        data = self._get(self._cfg.markets_path, params)
        markets = data.get("markets", [])
        next_cursor = data.get("cursor", None)
        if next_cursor == "":
            next_cursor = None

        logger.info(
            "Fetched %d markets (cursor=%s)",
            len(markets),
            "yes" if next_cursor else "end",
        )
        return markets, next_cursor

    def get_all_active_markets(self, *, max_pages: int = 50) -> list[dict[str, Any]]:
        """Page through active markets up to *max_pages* pages."""
        all_markets: list[dict[str, Any]] = []
        cursor: Optional[str] = None
        page = 0
        while True:
            batch, cursor = self.get_markets(statuses="active", cursor=cursor)
            all_markets.extend(batch)
            page += 1
            if cursor is None:
                break
            if page >= max_pages:
                logger.info("Reached page cap (%d pages), stopping early", max_pages)
                break
        logger.info("Total active markets fetched: %d (%d pages)", len(all_markets), page)
        return all_markets

    def get_orderbook(
        self, ticker: str, *, depth: int | None = None
    ) -> dict[str, Any]:
        """Fetch orderbook for a single market."""
        path = self._cfg.orderbook_path.format(ticker=ticker)
        params: dict[str, Any] = {}
        if depth is not None:
            params["depth"] = depth
        else:
            params["depth"] = self._cfg.orderbook_depth
        return self._get(path, params)

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> KalshiClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
