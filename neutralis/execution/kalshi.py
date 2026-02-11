"""Authenticated Kalshi executor for live order placement."""

from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from neutralis.config import ExecutionConfig, KalshiConfig
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
        self._private_key = self._load_private_key(self._exec.kalshi_private_key_path)

        self._http = httpx.Client(
            base_url=self._cfg.base_url,
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        self._last_request_ts: float = 0.0

    @staticmethod
    def _load_private_key(path_str: str) -> rsa.RSAPrivateKey:
        pem_path = Path(path_str)
        if not pem_path.is_absolute():
            pem_path = Path(__file__).resolve().parent.parent.parent / pem_path
        if not pem_path.exists():
            raise FileNotFoundError(f"Private key not found: {pem_path}")
        pem_data = pem_path.read_bytes()
        key = serialization.load_pem_private_key(pem_data, password=None)
        if not isinstance(key, rsa.RSAPrivateKey):
            raise TypeError("Expected RSA private key")
        return key

    def _sign_request(self, method: str, path: str) -> dict[str, str]:
        timestamp_ms = str(int(time.time() * 1000))
        message = timestamp_ms + method.upper() + path
        signature = self._private_key.sign(
            message.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            hashes.SHA256(),
        )
        return {
            "KALSHI-ACCESS-KEY": self._api_key,
            "KALSHI-ACCESS-TIMESTAMP": timestamp_ms,
            "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode(),
        }

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
            retry_after = float(resp.headers.get("Retry-After", "2"))
            logger.warning("Rate limited, sleeping %.1fs", retry_after)
            time.sleep(retry_after)
            return self._request(method, path, json_body, params, _retries=_retries)

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
    ) -> dict[str, Any]:
        """Place a limit order with fill_or_kill.

        Args:
            ticker: Market ticker (e.g. "KXBTC-25FEB14-T96750")
            side: "yes" or "no"
            price_cents: Price in cents (1-99)
            count: Number of contracts (integer)
            client_order_id: Idempotency key (auto-generated if None)
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
            "time_in_force": "fill_or_kill",
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
