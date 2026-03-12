"""Dynamic portfolio config based on live exchange balances.

Instead of hardcoded exposure limits, fetches real balances from Kalshi and
Polymarket US and scales all guard limits proportionally.  This means the bot
auto-sizes to whatever capital is actually in the accounts.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from neutralis.config import Settings
from neutralis.logging import get_logger

logger = get_logger(__name__)

# ── Proportional scaling constants ──────────────────────────────────────────
# These define what fraction of total bankroll each limit represents.
_TOTAL_EXPOSURE_PCT = 0.80     # Use up to 80% of bankroll
_MAX_POSITION_PCT = 0.15       # 15% per position
_MAX_EVENT_EXPOSURE_PCT = 0.30 # 30% per event
_MAX_TICKER_EXPOSURE_PCT = 0.15
_MAX_DAILY_LOSS_PCT = 0.20     # 20% daily loss breaker
_MIN_BANKROLL = 5.0            # Below this, don't trade (dust)


def extract_poly_us_balance(balance_data: dict[str, Any]) -> float:
    """Extract USD cash balance from PolymarketUSExecutor.get_balance() response."""
    if not balance_data:
        return 0.0
    # SDK returns {"balances": [{"currentBalance": ..., "buyingPower": ...}]}
    balances = balance_data.get("balances", [])
    if balances and len(balances) > 0:
        return float(balances[0].get("currentBalance", 0) or 0)
    # Fallback: maybe the response IS the balance object directly
    if "currentBalance" in balance_data:
        return float(balance_data.get("currentBalance", 0) or 0)
    return 0.0


def _kalshi_total_value(executor: Any) -> float:
    """Get Kalshi total account value (cash + portfolio) in dollars."""
    # The executor's get_balance() only returns cash. We need the full
    # /portfolio/balance response which also includes portfolio_value.
    try:
        data = executor._request("GET", "/portfolio/balance")
        cash = data.get("balance", 0) / 100.0
        portfolio = data.get("portfolio_value", 0) / 100.0
        return cash + portfolio
    except Exception:
        # Fallback to just cash balance
        return executor.get_balance()


def fetch_bankroll_from_executors(
    kalshi_executor: Any | None = None,
    poly_us_executor: Any | None = None,
) -> float:
    """Fetch live balances from already-initialized executors.

    Uses total account value (cash + positions) for bankroll sizing,
    since positions can be closed to free capital.
    """
    total = 0.0

    if kalshi_executor is not None:
        try:
            balance = _kalshi_total_value(kalshi_executor)
            total += balance
            logger.info("Live bankroll: Kalshi $%.2f (total value)", balance)
        except Exception:
            logger.warning("Failed to fetch Kalshi balance for bankroll", exc_info=True)

    if poly_us_executor is not None:
        try:
            raw = poly_us_executor.get_balance()
            balance = extract_poly_us_balance(raw)
            total += balance
            logger.info("Live bankroll: Polymarket US $%.2f", balance)
        except Exception:
            logger.warning("Failed to fetch Polymarket US balance for bankroll", exc_info=True)

    logger.info("Total live bankroll: $%.2f", total)
    return total


def fetch_bankroll_from_env(settings: Settings) -> float:
    """Fetch live balances using env-var credentials (for event engine).

    Creates temporary executor instances, fetches balances, then closes them.
    """
    total = 0.0

    if settings.execution.kalshi_api_key_id and settings.execution.kalshi_private_key_path:
        try:
            from neutralis.execution.kalshi import KalshiExecutor
            with KalshiExecutor(settings.kalshi, settings.execution) as executor:
                balance = _kalshi_total_value(executor)
                total += balance
                logger.info("Live bankroll: Kalshi $%.2f (total value)", balance)
        except Exception:
            logger.warning("Failed to fetch Kalshi balance for bankroll", exc_info=True)

    if settings.execution.polymarket_us_key_id:
        try:
            from neutralis.execution.polymarket_us import PolymarketUSExecutor
            with PolymarketUSExecutor(settings.execution) as executor:
                raw = executor.get_balance()
                balance = extract_poly_us_balance(raw)
                total += balance
                logger.info("Live bankroll: Polymarket US $%.2f", balance)
        except Exception:
            logger.warning("Failed to fetch Polymarket US balance for bankroll", exc_info=True)

    logger.info("Total live bankroll: $%.2f", total)
    return total


def build_dynamic_config(
    bankroll: float,
    base_settings: Settings,
) -> Settings:
    """Build a new Settings with portfolio/pipeline limits scaled to *bankroll*.

    If bankroll is below _MIN_BANKROLL, returns base_settings unchanged
    (the guard will naturally reject trades due to zero headroom).
    """
    if bankroll < _MIN_BANKROLL:
        logger.warning(
            "Bankroll $%.2f below minimum $%.2f — using static config",
            bankroll, _MIN_BANKROLL,
        )
        return base_settings

    new_portfolio = replace(
        base_settings.portfolio,
        max_total_exposure_dollars=round(bankroll * _TOTAL_EXPOSURE_PCT, 2),
        max_event_exposure_dollars=round(bankroll * _MAX_EVENT_EXPOSURE_PCT, 2),
        max_ticker_exposure_dollars=round(bankroll * _MAX_TICKER_EXPOSURE_PCT, 2),
        max_daily_loss_dollars=round(bankroll * _MAX_DAILY_LOSS_PCT, 2),
    )

    new_pipeline = replace(
        base_settings.pipeline,
        max_position_dollars=round(bankroll * _MAX_POSITION_PCT, 2),
    )

    new_settings = replace(
        base_settings,
        portfolio=new_portfolio,
        pipeline=new_pipeline,
    )

    logger.info(
        "Dynamic config: bankroll=$%.2f → exposure_cap=$%.2f, max_position=$%.2f, "
        "event_cap=$%.2f, daily_loss=$%.2f",
        bankroll,
        new_portfolio.max_total_exposure_dollars,
        new_pipeline.max_position_dollars,
        new_portfolio.max_event_exposure_dollars,
        new_portfolio.max_daily_loss_dollars,
    )

    return new_settings
