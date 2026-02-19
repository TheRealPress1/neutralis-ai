"""Authenticated Kalshi executor for live order placement."""

from __future__ import annotations

import time
from typing import Any, Optional
from uuid import uuid4

import httpx

from neutralis.config import ExecutionConfig, KalshiConfig
from neutralis.execution.auth import load_private_key, sign_request
from neutralis.logging import get_logger

logger = get_logger(__name__)

_MIN_INTERVAL = 1.0 / 10  # ~100ms between requests


class KalshiExecutor:
    """Authenticated Kalshi client for order placement and portfolio queries.

    Uses RSA-PSS signing per Kalshi API docs:
    - Message: timestamp_ms + HTTP_METHOD + path (no query params)
    - Signature: RSA-PSS with SHA256, base64-encoded
    - Headers: KALSHI-ACCESS-KEY, KALSHI-ACCESS-TIMESTAMP, KALSHI-ACCESS-SIGNATURE
    """

    def __init__(
        self,
        kalshi_config: KalshiConfig | None = None,
        execution_config: ExecutionConfig | None = None,
    ) -> None:
        self._cfg = kalshi_config or KalshiConfig()
        self._exec = execution_config or ExecutionConfig()

        if not self._exec.kalshi_api_key_id:
            raise ValueError("KALSHI_API_KEY_ID not set")
        if not self._exec.kalshi_private_key_path:
            raise ValueError("KALSHI_PRIVATE_KEY_PATH not set")

        self._api_key = self._exec.kalshi_api_key_id
        self._private_key = load_private_key(self._exec.kalshi_private_key_path)

        self._http = httpx.Client(
            base_url=self._cfg.base_url,
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        self._last_request_ts: float = 0.0

    def _sign_request(self, method: str, path: str) -> dict[str, str]:
        full_path = "/trade-api/v2" + path
        return sign_request(self._private_key, self._api_key, method, full_path)

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        self._last_request_ts = time.monotonic()

    def _request(
        self,
        method: str,
        path: str,
        json_body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        *,
        _retries: int = 0,
    ) -> dict[str, Any]:
        self._throttle()
        auth_headers = self._sign_request(method, path)
        resp = self._http.request(
            method, path, json=json_body, params=params, headers=auth_headers
        )

        if resp.status_code == 429:
            if _retries >= 5:
                logger.error("Rate limited 5 times on %s %s, giving up", method, path)
                resp.raise_for_status()
            retry_after = float(resp.headers.get("Retry-After", "2"))
            backoff = retry_after * (2 ** _retries)
            logger.warning("Rate limited, retry %d/5 sleeping %.1fs", _retries + 1, backoff)
            time.sleep(backoff)
            return self._request(method, path, json_body, params, _retries=_retries + 1)

        if resp.status_code >= 500 and _retries < 3:
            wait = 2.0 * (2**_retries)
            logger.warning(
                "Server error %d on %s, retry %d/3 in %.1fs",
                resp.status_code, path, _retries + 1, wait,
            )
            time.sleep(wait)
            return self._request(method, path, json_body, params, _retries=_retries + 1)

        resp.raise_for_status()
        if resp.status_code == 204:
            return {}
        return resp.json()

    # -- Portfolio queries --

    def get_balance(self) -> float:
        """Get account balance in dollars."""
        data = self._request("GET", "/portfolio/balance")
        # API returns cents; convert to dollars
        balance_cents = data.get("balance", 0)
        return balance_cents / 100.0

    def get_positions(self) -> list[dict[str, Any]]:
        """Get all Kalshi positions for reconciliation."""
        data = self._request("GET", "/portfolio/positions")
        return data.get("market_positions", [])

    # -- Order management --

    def place_order(
        self,
        ticker: str,
        side: str,
        price_cents: int,
        count: int,
        client_order_id: str | None = None,
        time_in_force: str = "fill_or_kill",
    ) -> dict[str, Any]:
        """Place a limit order.

        Args:
            ticker: Market ticker (e.g. "KXBTC-25FEB14-T96750")
            side: "yes" or "no"
            price_cents: Price in cents (1-99)
            count: Number of contracts (integer)
            client_order_id: Idempotency key (auto-generated if None)
            time_in_force: "fill_or_kill" (taker, immediate) or "gtc" (maker, resting)
        """
        if client_order_id is None:
            client_order_id = uuid4().hex[:16]

        price_cents = max(1, min(99, price_cents))
        count = max(1, count)

        body: dict[str, Any] = {
            "ticker": ticker,
            "side": side,
            "action": "buy",
            "type": "limit",
            "count": count,
            "time_in_force": time_in_force,
            "client_order_id": client_order_id,
        }

        if side == "yes":
            body["yes_price"] = price_cents
        else:
            body["no_price"] = price_cents

        logger.info(
            "Placing order: %s %s %s %d contracts @ %dc (client_id=%s)",
            ticker, side, "buy", count, price_cents, client_order_id,
        )

        data = self._request("POST", "/portfolio/orders", json_body=body)

        order = data.get("order", {})
        status = order.get("status", "unknown")
        fill_count = order.get("fill_count", 0)
        logger.info(
            "Order result: %s | status=%s fill=%d/%d | order_id=%s",
            ticker, status, fill_count, count, order.get("order_id", "?"),
        )
        return data

    def get_order(self, order_id: str) -> dict[str, Any]:
        """Get order status by ID."""
        return self._request("GET", f"/portfolio/orders/{order_id}")

    def cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancel a resting order."""
        return self._request("DELETE", f"/portfolio/orders/{order_id}")

    # -- Context manager --

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> KalshiExecutor:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
