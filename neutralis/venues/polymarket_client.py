"""Read-only Polymarket API client using httpx."""

from __future__ import annotations

import time
from typing import Any

import httpx

from neutralis.config import PolymarketConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)

_MIN_INTERVAL = 1.0 / 100  # ~10ms, conservative under 4000 req/10s


class PolymarketClient:
    """Synchronous, read-only client for Polymarket public market data.

    Uses the Gamma API for market metadata and the CLOB API for orderbooks.
    No authentication needed for read endpoints.
    """

    def __init__(self, config: PolymarketConfig | None = None) -> None:
        self._cfg = config or PolymarketConfig()
        self._http = httpx.Client(
            base_url=self._cfg.gamma_base_url,
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
            headers={"Accept": "application/json"},
        )
        self._clob_http = httpx.Client(
            base_url=self._cfg.clob_base_url,
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
            headers={"Accept": "application/json"},
        )
        self._last_request_ts: float = 0.0
        self._fee_rate_cache: dict[str, int] = {}

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        self._last_request_ts = time.monotonic()

    def _get(
        self,
        client: httpx.Client,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        _retries: int = 0,
    ) -> Any:
        self._throttle()
        resp = client.get(path, params=params)

        if resp.status_code == 429:
            retry_after = float(resp.headers.get("Retry-After", "2"))
            logger.warning("Rate limited, sleeping %.1fs", retry_after)
            time.sleep(retry_after)
            return self._get(client, path, params, _retries=_retries)

        if resp.status_code >= 500 and _retries < 3:
            wait = 2.0 * (2**_retries)
            logger.warning(
                "Server error %d on %s, retry %d/3 in %.1fs",
                resp.status_code, path, _retries + 1, wait,
            )
            time.sleep(wait)
            return self._get(client, path, params, _retries=_retries + 1)

        resp.raise_for_status()
        return resp.json()

    def get_markets(
        self,
        *,
        limit: int | None = None,
        offset: int = 0,
        active: bool = True,
    ) -> list[dict[str, Any]]:
        """Fetch a page of markets from the Gamma API, sorted by 24h volume."""
        params: dict[str, Any] = {
            "limit": limit or self._cfg.default_market_limit,
            "offset": offset,
            "active": str(active).lower(),
            "order": "volume24hr",
            "ascending": "false",
        }
        data = self._get(self._http, "/markets", params)
        # Gamma API returns a list directly
        markets = data if isinstance(data, list) else data.get("markets", data)
        logger.info(
            "Fetched %d Polymarket markets (offset=%d)",
            len(markets) if isinstance(markets, list) else 0,
            offset,
        )
        return markets if isinstance(markets, list) else []

    def get_all_active_markets(
        self, *, max_pages: int | None = None
    ) -> list[dict[str, Any]]:
        """Page through active markets up to *max_pages* pages."""
        cap = max_pages or self._cfg.max_pages
        limit = self._cfg.default_market_limit
        all_markets: list[dict[str, Any]] = []
        for page in range(cap):
            batch = self.get_markets(limit=limit, offset=page * limit, active=True)
            all_markets.extend(batch)
            if len(batch) < limit:
                break
            if page + 1 >= cap:
                logger.info("Reached page cap (%d pages), stopping early", cap)
        logger.info(
            "Total Polymarket markets fetched: %d (%d pages)",
            len(all_markets),
            page + 1,
        )
        return all_markets

    def get_market(self, condition_id: str) -> dict[str, Any] | None:
        """Fetch a single market by condition ID from the Gamma API."""
        try:
            return self._get(self._http, f"/markets/{condition_id}")
        except httpx.HTTPStatusError:
            logger.warning("Failed to fetch Polymarket market %s", condition_id)
            return None

    def get_orderbook(self, token_id: str) -> dict[str, Any]:
        """Fetch orderbook from the CLOB API."""
        return self._get(self._clob_http, "/book", {"token_id": token_id})

    def get_fee_rate_bps(self, token_id: str) -> int:
        """Return the CLOB fee rate in basis points for *token_id*.

        Queries ``GET /fee-rate?token_id=<token_id>`` on the CLOB API and
        returns the ``base_fee`` field (int, basis points).  Returns **0** on
        any error (404, timeout, network failure, unexpected payload, etc.)
        so callers can safely treat the result as a non-negative integer.

        Results are cached in ``_fee_rate_cache`` for the lifetime of the
        client instance.
        """
        if token_id in self._fee_rate_cache:
            return self._fee_rate_cache[token_id]

        try:
            data = self._get(self._clob_http, "/fee-rate", {"token_id": token_id})
            fee = int(data.get("base_fee", 0)) if isinstance(data, dict) else 0
        except Exception:  # noqa: BLE001 — intentionally broad
            logger.debug("Fee-rate lookup failed for token %s, defaulting to 0", token_id)
            fee = 0

        self._fee_rate_cache[token_id] = fee
        return fee

    def get_fee_rates_bulk(self, token_ids: list[str]) -> dict[str, int]:
        """Fetch fee rates for multiple tokens, returning ``{token_id: bps}``.

        Cached values are reused; only uncached tokens hit the network.
        Individual failures are silently treated as 0 bps (see
        :meth:`get_fee_rate_bps`).
        """
        result: dict[str, int] = {}
        for tid in token_ids:
            result[tid] = self.get_fee_rate_bps(tid)
        return result

    def close(self) -> None:
        self._http.close()
        self._clob_http.close()

    def __enter__(self) -> PolymarketClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
