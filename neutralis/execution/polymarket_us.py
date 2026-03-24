"""Authenticated Polymarket US executor for live order placement.

Uses the polymarket-us SDK (Ed25519 auth, not EIP-712).
CFTC-regulated US platform — sports markets only (as of March 2026).
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any

from neutralis.config import ExecutionConfig
from neutralis.logging import get_logger

logger = get_logger(__name__)

_MIN_INTERVAL = 1.0 / 10  # ~100ms between requests
_CANCEL_TIMEOUT_SEC = 5.0
_TIMEOUT_ERROR_RESULT: dict[str, Any] = {
    "success": False,
    "errorMsg": "Order placement timed out",
    "orderID": "",
}

# Side mapping: pipeline uses "yes"/"no", US SDK uses ORDER_INTENT_* enums
_SIDE_TO_INTENT: dict[str, str] = {
    "yes": "ORDER_INTENT_BUY_LONG",
    "buy": "ORDER_INTENT_BUY_LONG",
    "buy_long": "ORDER_INTENT_BUY_LONG",
    "no": "ORDER_INTENT_BUY_SHORT",
    "buy_short": "ORDER_INTENT_BUY_SHORT",
    "sell_long": "ORDER_INTENT_SELL_LONG",
    "sell_short": "ORDER_INTENT_SELL_SHORT",
}


class PolymarketUSExecutor:
    """Authenticated Polymarket US client for order placement.

    Uses the polymarket-us SDK which handles:
    - Ed25519 request signing (key_id UUID + secret_key base64)
    - Order creation and submission
    - Portfolio queries

    Same return interface as PolymarketExecutor for caller compatibility:
    {"success": bool, "errorMsg": str, "orderID": str}
    """

    def __init__(self, execution_config: ExecutionConfig) -> None:
        self._exec = execution_config

        if not self._exec.polymarket_us_key_id:
            raise ValueError("POLYMARKET_US_KEY_ID not set")
        if not self._exec.polymarket_us_secret_key:
            raise ValueError("POLYMARKET_US_SECRET_KEY not set")

        from polymarket_us import PolymarketUS

        self._client = PolymarketUS(
            key_id=self._exec.polymarket_us_key_id,
            secret_key=self._exec.polymarket_us_secret_key,
        )
        logger.info(
            "Polymarket US executor initialized (key_id=%s...)",
            self._exec.polymarket_us_key_id[:8],
        )

        self._last_request_ts: float = 0.0
        self._order_timeout = self._exec.order_timeout_sec
        self._timeout_pool = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="poly-us-timeout",
        )

    @classmethod
    def from_credentials(
        cls,
        key_id: str,
        secret_key: str,
        order_timeout_sec: float = 15.0,
    ) -> PolymarketUSExecutor:
        """Create executor from pre-derived credentials (multi-tenant)."""
        instance = cls.__new__(cls)
        instance._exec = None

        from polymarket_us import PolymarketUS

        instance._client = PolymarketUS(
            key_id=key_id,
            secret_key=secret_key,
        )
        instance._last_request_ts = 0.0
        instance._order_timeout = order_timeout_sec
        instance._timeout_pool = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="poly-us-timeout",
        )
        logger.info(
            "Polymarket US executor initialized from credentials (key_id=%s...)",
            key_id[:8],
        )
        return instance

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)
        self._last_request_ts = time.monotonic()

    def _normalize_result(self, result: Any) -> dict[str, Any]:
        """Normalize SDK response to standard interface.

        CreateOrderResponse has: id (str), executions (list[Execution]).
        Execution has: type (FILL/REJECTED/CANCELED/...), orderRejectReason.
        """
        if not isinstance(result, dict) and hasattr(result, "__dict__"):
            result = vars(result)
        if not isinstance(result, dict):
            return {"success": False, "errorMsg": str(result), "orderID": ""}

        order_id = str(
            result.get("id")
            or result.get("orderId")
            or result.get("order_id")
            or ""
        )

        # Check executions for reject/fill status
        executions = result.get("executions", [])
        rejected = False
        reject_reason = ""
        filled = False
        for ex in executions if isinstance(executions, list) else []:
            ex_dict = vars(ex) if hasattr(ex, "__dict__") else ex
            if not isinstance(ex_dict, dict):
                continue
            ex_type = str(ex_dict.get("type", ""))
            if "REJECTED" in ex_type:
                rejected = True
                reject_reason = str(ex_dict.get("orderRejectReason", ""))
            elif "FILL" in ex_type:
                filled = True

        # A FILL takes priority over a stale reject reason.
        # Polymarket US returns ORD_REJECT_REASON_EXCHANGE_OPTION on
        # moneyline fills and close_position — treat as success if filled.
        if filled:
            return {"success": True, "errorMsg": "", "orderID": order_id}

        if rejected:
            return {
                "success": False,
                "errorMsg": reject_reason or "Order rejected",
                "orderID": order_id,
            }

        # If we got an order_id back, consider it successful
        # (order is accepted/pending/filled)
        success = bool(order_id)
        return {
            "success": success,
            "errorMsg": "" if success else "No order ID returned",
            "orderID": order_id,
        }

    # -- Portfolio queries --

    def get_balance(self) -> dict[str, Any]:
        """Get USD balance."""
        self._throttle()
        try:
            return self._client.account.balances()
        except Exception:
            logger.exception("Failed to fetch Polymarket US balance")
            return {}

    # -- Order management --

    def place_market_order(
        self,
        market_slug: str,
        side: str,
        amount: float,
    ) -> dict[str, Any]:
        """Place a fill-or-kill market order.

        Args:
            market_slug: Market slug (e.g., "epl-winner-2025-2026")
            side: "yes" or "no" — mapped to US SDK intents
            amount: Dollar amount to spend

        Returns:
            {"success": bool, "errorMsg": str, "orderID": str}
        """
        self._throttle()

        intent = _SIDE_TO_INTENT.get(side.lower())
        if not intent:
            return {"success": False, "errorMsg": f"Unknown side: {side}", "orderID": ""}

        logger.info(
            "Placing Polymarket US market order: %s FOK $%.2f (slug=%s)",
            intent, amount, market_slug,
        )

        def _do_order() -> Any:
            return self._client.orders.create({
                "marketSlug": market_slug,
                "intent": intent,
                "type": "ORDER_TYPE_MARKET",
                "cashOrderQty": {"value": f"{amount:.2f}", "currency": "USD"},
                "tif": "TIME_IN_FORCE_FILL_OR_KILL",
                "manualOrderIndicator": "MANUAL_ORDER_INDICATOR_AUTOMATIC",
                "synchronousExecution": True,
                "maxBlockTime": 15,
            })

        try:
            future = self._timeout_pool.submit(_do_order)
            result = future.result(timeout=self._order_timeout)
        except FuturesTimeoutError:
            logger.error(
                "Polymarket US market order TIMED OUT after %.1fs: %s %s $%.2f",
                self._order_timeout, intent, market_slug, amount,
            )
            return dict(_TIMEOUT_ERROR_RESULT)
        except Exception:
            logger.exception(
                "Polymarket US order failed: %s %s $%.2f", intent, market_slug, amount,
            )
            return {"success": False, "errorMsg": "SDK exception", "orderID": ""}

        normalized = self._normalize_result(result)
        if normalized["success"]:
            logger.info(
                "Polymarket US order filled: %s %s $%.2f order_id=%s",
                intent, market_slug, amount, normalized["orderID"],
            )
        else:
            logger.warning(
                "Polymarket US order rejected: %s %s $%.2f error=%s",
                intent, market_slug, amount, normalized["errorMsg"],
            )
        return normalized

    def place_limit_order(
        self,
        market_slug: str,
        side: str,
        price: float,
        size: int,
        *,
        maker_only: bool = False,
    ) -> dict[str, Any]:
        """Place a GTC limit order.

        Args:
            market_slug: Market slug
            side: "yes" or "no"
            price: Limit price (0.00 - 1.00)
            size: Number of contracts
            maker_only: If True, reject if would immediately fill (post-only)

        Returns:
            {"success": bool, "errorMsg": str, "orderID": str}
        """
        self._throttle()

        intent = _SIDE_TO_INTENT.get(side.lower())
        if not intent:
            return {"success": False, "errorMsg": f"Unknown side: {side}", "orderID": ""}

        logger.info(
            "Placing Polymarket US limit order: %s GTC %d @ $%.4f (slug=%s)",
            intent, size, price, market_slug,
        )

        def _do_order() -> Any:
            params: dict[str, Any] = {
                "marketSlug": market_slug,
                "intent": intent,
                "type": "ORDER_TYPE_LIMIT",
                "price": {"value": f"{price:.4f}", "currency": "USD"},
                "quantity": size,
                "tif": "TIME_IN_FORCE_GOOD_TILL_CANCEL",
                "manualOrderIndicator": "MANUAL_ORDER_INDICATOR_AUTOMATIC",
            }
            if maker_only:
                params["participateDontInitiate"] = True
            return self._client.orders.create(params)

        try:
            future = self._timeout_pool.submit(_do_order)
            result = future.result(timeout=self._order_timeout)
        except FuturesTimeoutError:
            logger.error(
                "Polymarket US limit order TIMED OUT: %s %d @ $%.4f",
                intent, size, price,
            )
            return dict(_TIMEOUT_ERROR_RESULT)
        except Exception:
            logger.exception(
                "Polymarket US limit order failed: %s %d @ $%.4f",
                intent, size, price,
            )
            return {"success": False, "errorMsg": "SDK exception", "orderID": ""}

        normalized = self._normalize_result(result)
        if normalized["success"]:
            logger.info(
                "Polymarket US limit order placed: %s %d @ $%.4f order_id=%s",
                intent, size, price, normalized["orderID"],
            )
        else:
            logger.warning(
                "Polymarket US limit order rejected: %s %d @ $%.4f error=%s",
                intent, size, price, normalized["errorMsg"],
            )
        return normalized

    def cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancel a resting order (5s timeout)."""
        self._throttle()
        try:
            future = self._timeout_pool.submit(
                self._client.orders.cancel, order_id, {},
            )
            result = future.result(timeout=_CANCEL_TIMEOUT_SEC)
            return result if isinstance(result, dict) else {}
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
            future = self._timeout_pool.submit(self._client.orders.cancel_all)
            result = future.result(timeout=_CANCEL_TIMEOUT_SEC)
            return result if isinstance(result, dict) else {}
        except FuturesTimeoutError:
            logger.error("Cancel all orders TIMED OUT after %.1fs", _CANCEL_TIMEOUT_SEC)
            return {}
        except Exception:
            logger.exception("Failed to cancel all orders")
            return {}

    def close_position(self, market_slug: str) -> dict[str, Any]:
        """Close an entire position on a market.

        Uses the dedicated ``close-position`` endpoint which works even on
        moneyline markets where regular BUY_SHORT/SELL_SHORT intents are
        rejected with ORD_REJECT_REASON_EXCHANGE_OPTION.
        """
        self._throttle()

        logger.info("Closing Polymarket US position: slug=%s", market_slug)

        def _do_close() -> Any:
            return self._client.orders.close_position({
                "marketSlug": market_slug,
                "manualOrderIndicator": "MANUAL_ORDER_INDICATOR_AUTOMATIC",
                "synchronousExecution": True,
                "maxBlockTime": "15",
            })

        try:
            future = self._timeout_pool.submit(_do_close)
            result = future.result(timeout=self._order_timeout)
        except FuturesTimeoutError:
            logger.error(
                "Polymarket US close_position TIMED OUT after %.1fs: %s",
                self._order_timeout, market_slug,
            )
            return dict(_TIMEOUT_ERROR_RESULT)
        except Exception:
            logger.exception("Polymarket US close_position failed: %s", market_slug)
            return {"success": False, "errorMsg": "SDK exception", "orderID": ""}

        normalized = self._normalize_result(result)
        if normalized["success"]:
            logger.info("Polymarket US position closed: %s order_id=%s", market_slug, normalized["orderID"])
        else:
            logger.warning("Polymarket US close_position rejected: %s error=%s", market_slug, normalized["errorMsg"])
        return normalized

    # -- Context manager --

    def close(self) -> None:
        self._timeout_pool.shutdown(wait=False)

    def __enter__(self) -> PolymarketUSExecutor:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
