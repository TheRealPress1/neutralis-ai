"""Authenticated Polymarket executor for live order placement via CLOB API."""

from __future__ import annotations

import time
from typing import Any

from py_clob_client.client import ClobClient
from py_clob_client.clob_types import ApiCreds, MarketOrderArgs, OrderArgs, OrderType

from neutralis.config import ExecutionConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)

_MIN_INTERVAL = 1.0 / 10  # ~100ms between requests


class PolymarketExecutor:
    """Authenticated Polymarket CLOB client for order placement.

    Uses the official py-clob-client SDK which handles:
    - EIP-712 order signing
    - API credential derivation from wallet key
    - Order creation, posting, and cancellation
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

    @classmethod
    def from_credentials(
        cls,
        api_key: str,
        api_secret: str,
        passphrase: str,
        funder_address: str,
        private_key: str = "",
        signature_type: int = 0,
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

        logger.info("Polymarket executor initialized from credentials (address=%s)", funder_address[:10])
        return instance

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        self._last_request_ts = time.monotonic()

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
    ) -> dict[str, Any]:
        """Place a fill-or-kill market order.

        Args:
            token_id: CLOB token ID (YES token from NormalizedMarket.clob_token_ids)
            side: "BUY" or "SELL"
            amount: Dollar amount to spend (for BUY) or shares to sell (for SELL)

        Returns:
            {"success": bool, "errorMsg": str, "orderID": str}
        """
        self._throttle()

        order_args = MarketOrderArgs(
            token_id=token_id,
            amount=amount,
            side=side,
        )

        logger.info(
            "Placing Polymarket market order: %s %s $%.2f (token=%s...)",
            side, "FOK", amount, token_id[:12],
        )

        try:
            resp = self._client.create_market_order(order_args)
            result = self._client.post_order(resp, OrderType.FOK)
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
    ) -> dict[str, Any]:
        """Place a GTC limit order.

        Args:
            token_id: CLOB token ID
            side: "BUY" or "SELL"
            price: Limit price (0.00 - 1.00)
            size: Number of shares

        Returns:
            {"success": bool, "errorMsg": str, "orderID": str}
        """
        self._throttle()

        order_args = OrderArgs(
            token_id=token_id,
            price=price,
            size=size,
            side=side,
        )

        logger.info(
            "Placing Polymarket limit order: %s %s %.0f @ $%.4f (token=%s...)",
            side, "GTC", size, price, token_id[:12],
        )

        try:
            signed = self._client.create_order(order_args)
            result = self._client.post_order(signed, OrderType.GTC)
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
        """Cancel a resting order."""
        self._throttle()
        try:
            return self._client.cancel(order_id)
        except Exception:
            logger.exception("Failed to cancel order %s", order_id)
            return {}

    def cancel_all(self) -> dict[str, Any]:
        """Cancel all open orders."""
        self._throttle()
        try:
            return self._client.cancel_all()
        except Exception:
            logger.exception("Failed to cancel all orders")
            return {}

    # -- Context manager --

    def close(self) -> None:
        pass  # SDK doesn't require explicit cleanup

    def __enter__(self) -> PolymarketExecutor:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
