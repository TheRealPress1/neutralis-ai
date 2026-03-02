"""Authenticated Polymarket executor for live order placement via CLOB API."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any

import httpx
from py_clob_client.client import ClobClient
from py_clob_client.clob_types import ApiCreds, MarketOrderArgs, OrderArgs, OrderType, PartialCreateOrderOptions

from neutralis.config import ExecutionConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)

_MIN_INTERVAL = 1.0 / 10  # ~100ms between requests
_CANCEL_TIMEOUT_SEC = 5.0  # Shorter timeout for cancel operations
_TIMEOUT_ERROR_RESULT: dict[str, Any] = {
    "success": False,
    "errorMsg": "Order placement timed out",
    "orderID": "",
}


class PolymarketExecutor:
    """Authenticated Polymarket CLOB client for order placement.

    Uses the official py-clob-client SDK which handles:
    - EIP-712 order signing
    - API credential derivation from wallet key
    - Order creation, posting, and cancellation

    All SDK calls are wrapped with a timeout guard via ThreadPoolExecutor
    because the py-clob-client SDK does not expose built-in timeout support.
    If a call exceeds `order_timeout_sec`, a timeout error result is returned
    instead of hanging indefinitely.
    """

    def __init__(self, execution_config: ExecutionConfig) -> None:
        self._exec = execution_config

        if not self._exec.polymarket_private_key:
            raise ValueError("POLYMARKET_PRIVATE_KEY not set")
        if not self._exec.polymarket_funder_address:
            raise ValueError("POLYMARKET_FUNDER_ADDRESS not set")

        self._client = ClobClient(
            "https://clob.polymarket.com",
            key=self._exec.polymarket_private_key,
            chain_id=137,
            signature_type=self._exec.polymarket_signature_type,
            funder=self._exec.polymarket_funder_address,
        )

        # Derive or retrieve API credentials (key, secret, passphrase)
        creds = self._client.create_or_derive_api_creds()
        self._client.set_api_creds(creds)
        logger.info("Polymarket executor initialized (address=%s)", self._exec.polymarket_funder_address[:10])

        self._last_request_ts: float = 0.0
        self._order_timeout = self._exec.order_timeout_sec
        self._timeout_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="poly-timeout")
        self._http = httpx.Client(base_url="https://clob.polymarket.com", timeout=5.0)
        self._tick_size_cache: dict[str, str] = {}
        self._fee_rate_cache: dict[str, int] = {}

    @classmethod
    def from_credentials(
        cls,
        api_key: str,
        api_secret: str,
        passphrase: str,
        funder_address: str,
        private_key: str = "",
        signature_type: int = 0,
        order_timeout_sec: float = 15.0,
    ) -> PolymarketExecutor:
        """Create executor from pre-derived API credentials (not env vars).

        Used by the multi-tenant pipeline to initialize per-user executors
        from decrypted credentials stored in the database.
        """
        instance = cls.__new__(cls)
        instance._exec = None  # not needed when using direct credentials

        client = ClobClient(
            "https://clob.polymarket.com",
            key=private_key or "",
            chain_id=137,
            signature_type=signature_type,
            funder=funder_address,
        )
        client.set_api_creds(ApiCreds(
            api_key=api_key,
            api_secret=api_secret,
            api_passphrase=passphrase,
        ))
        instance._client = client
        instance._last_request_ts = 0.0
        instance._order_timeout = order_timeout_sec
        instance._timeout_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="poly-timeout")
        instance._http = httpx.Client(base_url="https://clob.polymarket.com", timeout=5.0)
        instance._tick_size_cache: dict[str, str] = {}
        instance._fee_rate_cache: dict[str, int] = {}

        logger.info("Polymarket executor initialized from credentials (address=%s)", funder_address[:10])
        return instance

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        self._last_request_ts = time.monotonic()

    def get_tick_size(self, token_id: str) -> str:
        """Query the CLOB API for the tick size of a token. Cached."""
        if token_id in self._tick_size_cache:
            return self._tick_size_cache[token_id]
        try:
            resp = self._http.get("/tick-size", params={"token_id": token_id})
            resp.raise_for_status()
            tick_size = resp.json().get("minimum_tick_size", "0.01")
            self._tick_size_cache[token_id] = tick_size
            return tick_size
        except Exception:
            logger.warning("Failed to fetch tick_size for %s..., defaulting to 0.01", token_id[:12])
            return "0.01"

    def get_fee_rate_bps(self, token_id: str) -> int:
        """Query the CLOB API for the fee rate (basis points) of a token. Cached."""
        if token_id in self._fee_rate_cache:
            return self._fee_rate_cache[token_id]
        try:
            resp = self._http.get("/fee-rate", params={"token_id": token_id})
            resp.raise_for_status()
            fee_bps = int(resp.json().get("base_fee", 0))
            self._fee_rate_cache[token_id] = fee_bps
            return fee_bps
        except Exception:
            logger.warning("Failed to fetch fee_rate_bps for %s..., defaulting to 0", token_id[:12])
            return 0

    # -- Portfolio queries --

    def get_balance(self) -> dict[str, Any]:
        """Get USDC balance and allowance."""
        self._throttle()
        return self._client.get_balance_allowance()

    # -- Order management --

    def place_market_order(
        self,
        token_id: str,
        side: str,
        amount: float,
        neg_risk: bool = False,
    ) -> dict[str, Any]:
        """Place a fill-or-kill market order.

        Args:
            token_id: CLOB token ID (YES token from NormalizedMarket.clob_token_ids)
            side: "BUY" or "SELL"
            amount: Dollar amount to spend (for BUY) or shares to sell (for SELL)
            neg_risk: Whether this is a neg-risk market

        Returns:
            {"success": bool, "errorMsg": str, "orderID": str}
        """
        self._throttle()

        tick_size = self.get_tick_size(token_id)
        fee_rate_bps = self.get_fee_rate_bps(token_id)

        order_kwargs: dict[str, Any] = dict(
            token_id=token_id,
            amount=amount,
            side=side,
        )
        if fee_rate_bps:
            order_kwargs["fee_rate_bps"] = fee_rate_bps
        order_args = MarketOrderArgs(**order_kwargs)

        options = PartialCreateOrderOptions(tick_size=tick_size, neg_risk=neg_risk)

        logger.info(
            "Placing Polymarket market order: %s %s $%.2f (token=%s...)",
            side, "FOK", amount, token_id[:12],
        )

        def _do_market_order() -> Any:
            resp = self._client.create_market_order(order_args, options=options)
            return self._client.post_order(resp, OrderType.FOK)

        try:
            future = self._timeout_pool.submit(_do_market_order)
            result = future.result(timeout=self._order_timeout)
        except FuturesTimeoutError:
            logger.error(
                "Polymarket market order TIMED OUT after %.1fs: %s %s $%.2f",
                self._order_timeout, side, token_id[:12], amount,
            )
            return dict(_TIMEOUT_ERROR_RESULT)
        except Exception:
            logger.exception("Polymarket order failed: %s %s $%.2f", side, token_id[:12], amount)
            return {"success": False, "errorMsg": "SDK exception", "orderID": ""}

        success = result.get("success", False) if isinstance(result, dict) else False
        order_id = result.get("orderID", "") if isinstance(result, dict) else ""
        error = result.get("errorMsg", "") if isinstance(result, dict) else str(result)

        if success:
            logger.info("Polymarket order filled: %s %s $%.2f order_id=%s", side, token_id[:12], amount, order_id)
        else:
            logger.warning("Polymarket order rejected: %s %s $%.2f error=%s", side, token_id[:12], amount, error)

        return result if isinstance(result, dict) else {"success": False, "errorMsg": str(result), "orderID": ""}

    def place_limit_order(
        self,
        token_id: str,
        side: str,
        price: float,
        size: float,
        neg_risk: bool = False,
    ) -> dict[str, Any]:
        """Place a GTC limit order.

        Args:
            token_id: CLOB token ID
            side: "BUY" or "SELL"
            price: Limit price (0.00 - 1.00)
            size: Number of shares
            neg_risk: Whether this is a neg-risk market

        Returns:
            {"success": bool, "errorMsg": str, "orderID": str}
        """
        self._throttle()

        tick_size = self.get_tick_size(token_id)
        fee_rate_bps = self.get_fee_rate_bps(token_id)

        order_kwargs: dict[str, Any] = dict(
            token_id=token_id,
            price=price,
            size=size,
            side=side,
        )
        if fee_rate_bps:
            order_kwargs["fee_rate_bps"] = fee_rate_bps
        order_args = OrderArgs(**order_kwargs)

        options = PartialCreateOrderOptions(tick_size=tick_size, neg_risk=neg_risk)

        logger.info(
            "Placing Polymarket limit order: %s %s %.0f @ $%.4f (token=%s...)",
            side, "GTC", size, price, token_id[:12],
        )

        def _do_limit_order() -> Any:
            signed = self._client.create_order(order_args, options=options)
            return self._client.post_order(signed, OrderType.GTC)

        try:
            future = self._timeout_pool.submit(_do_limit_order)
            result = future.result(timeout=self._order_timeout)
        except FuturesTimeoutError:
            logger.error(
                "Polymarket limit order TIMED OUT after %.1fs: %s %.0f @ $%.4f",
                self._order_timeout, side, size, price,
            )
            return dict(_TIMEOUT_ERROR_RESULT)
        except Exception:
            logger.exception("Polymarket limit order failed: %s %s %.0f @ $%.4f", side, token_id[:12], size, price)
            return {"success": False, "errorMsg": "SDK exception", "orderID": ""}

        success = result.get("success", False) if isinstance(result, dict) else False
        order_id = result.get("orderID", "") if isinstance(result, dict) else ""
        error = result.get("errorMsg", "") if isinstance(result, dict) else str(result)

        if success:
            logger.info("Polymarket limit order placed: %s %.0f @ $%.4f order_id=%s", side, size, price, order_id)
        else:
            logger.warning("Polymarket limit order rejected: %s %.0f @ $%.4f error=%s", side, size, price, error)

        return result if isinstance(result, dict) else {"success": False, "errorMsg": str(result), "orderID": ""}

    def cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancel a resting order (5s timeout)."""
        self._throttle()
        try:
            future = self._timeout_pool.submit(self._client.cancel, order_id)
            return future.result(timeout=_CANCEL_TIMEOUT_SEC)
        except FuturesTimeoutError:
            logger.error("Cancel order TIMED OUT after %.1fs: %s", _CANCEL_TIMEOUT_SEC, order_id)
            return {}
        except Exception:
            logger.exception("Failed to cancel order %s", order_id)
            return {}

    def cancel_all(self) -> dict[str, Any]:
        """Cancel all open orders (5s timeout)."""
        self._throttle()
        try:
            future = self._timeout_pool.submit(self._client.cancel_all)
            return future.result(timeout=_CANCEL_TIMEOUT_SEC)
        except FuturesTimeoutError:
            logger.error("Cancel all orders TIMED OUT after %.1fs", _CANCEL_TIMEOUT_SEC)
            return {}
        except Exception:
            logger.exception("Failed to cancel all orders")
            return {}

    # -- Context manager --

    def close(self) -> None:
        self._http.close()
        self._timeout_pool.shutdown(wait=False)

    def __enter__(self) -> PolymarketExecutor:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
