"""Settlement service -- checks resolved markets and closes positions with P&L."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from neutralis.config import Settings
from neutralis.logging import get_logger
from neutralis.models import Position, TradeSide
from neutralis.portfolio.manager import PortfolioManager
from neutralis.storage.postgres import PostgresStorage
from neutralis.venues.kalshi_client import KalshiClient
from neutralis.venues.polymarket_client import PolymarketClient

if TYPE_CHECKING:
    from neutralis.alerts.discord import DiscordNotifier

logger = get_logger(__name__)

# Kalshi statuses that indicate a resolved market
_KALSHI_SETTLED = {"determined", "finalized"}


@dataclass(frozen=True)
class SettlementStats:
    checked: int = 0
    settled: int = 0
    pnl: float = 0.0


def _settlement_price(side: TradeSide, result: str) -> float | None:
    """Map market result + position side to settlement price.

    Returns 1.0 (won), 0.0 (lost), or None (unrecognized result).
    """
    result_lower = result.strip().lower()
    if result_lower == "yes":
        return 1.0 if side == TradeSide.BUY_YES else 0.0
    if result_lower == "no":
        return 1.0 if side == TradeSide.BUY_NO else 0.0
    return None


def _settle_kalshi(
    positions: list[Position],
    portfolio: PortfolioManager,
    settings: Settings,
    notifier: DiscordNotifier | None = None,
) -> tuple[int, float]:
    """Check Kalshi positions for resolved markets. Returns (settled, pnl)."""
    if not positions:
        return 0, 0.0

    settled = 0
    total_pnl = 0.0

    with KalshiClient(settings.kalshi) as client:
        for pos in positions:
            try:
                raw = client.get_market(pos.ticker)
            except Exception:
                logger.warning("Error fetching market %s, skipping", pos.ticker)
                continue

            if raw is None:
                continue

            status = raw.get("status", "")
            if status not in _KALSHI_SETTLED:
                continue

            result = raw.get("result", "")
            if not result:
                logger.debug("Market %s resolved but no result field", pos.ticker)
                continue

            price = _settlement_price(pos.side, result)
            if price is None:
                logger.warning(
                    "Unrecognized result '%s' for market %s", result, pos.ticker,
                )
                continue

            closed = portfolio.close_position(pos.id, price)
            settled += 1
            total_pnl += closed.realized_pnl

            logger.info(
                "Settled: %s %s | result=%s | side=%s | P&L=$%.2f",
                pos.ticker,
                status,
                result,
                pos.side.value,
                closed.realized_pnl,
            )
            if notifier is not None:
                notifier.notify_settlement(
                    ticker=pos.ticker,
                    side=pos.side.value,
                    result=result,
                    pnl=closed.realized_pnl,
                )

    return settled, total_pnl


def _settle_polymarket(
    positions: list[Position],
    portfolio: PortfolioManager,
    settings: Settings,
    notifier: DiscordNotifier | None = None,
) -> tuple[int, float]:
    """Check Polymarket positions for resolved markets. Returns (settled, pnl)."""
    if not positions:
        return 0, 0.0

    settled = 0
    total_pnl = 0.0

    with PolymarketClient(settings.polymarket) as client:
        for pos in positions:
            try:
                raw = client.get_market(pos.ticker)
            except Exception:
                logger.warning(
                    "Error fetching Polymarket market %s, skipping", pos.ticker,
                )
                continue

            if raw is None:
                continue

            # Polymarket uses closed=true + resolved=true for settled markets
            if not raw.get("closed", False):
                continue

            # Check for resolution outcome
            result = raw.get("resolutionSource", "") or raw.get("resolution", "")
            outcomes = raw.get("outcomes", [])
            outcome_prices = raw.get("outcomePrices", [])

            # If outcome prices are available and market is resolved,
            # the winning outcome has price ~1.0
            if outcome_prices and len(outcome_prices) >= 2:
                try:
                    yes_price = float(outcome_prices[0])
                except (ValueError, TypeError):
                    yes_price = -1.0

                # Resolved market: winning side has price ~1.0
                if yes_price >= 0.99:
                    result = "yes"
                elif yes_price <= 0.01:
                    result = "no"
                else:
                    continue  # Not clearly resolved

            if not result or result not in ("yes", "no"):
                continue

            price = _settlement_price(pos.side, result)
            if price is None:
                continue

            closed = portfolio.close_position(pos.id, price)
            settled += 1
            total_pnl += closed.realized_pnl

            logger.info(
                "Settled: %s (polymarket) | result=%s | side=%s | P&L=$%.2f",
                pos.ticker,
                result,
                pos.side.value,
                closed.realized_pnl,
            )
            if notifier is not None:
                notifier.notify_settlement(
                    ticker=pos.ticker,
                    side=pos.side.value,
                    result=result,
                    pnl=closed.realized_pnl,
                )

    return settled, total_pnl


def run_settlement(
    settings: Settings,
    notifier: DiscordNotifier | None = None,
) -> SettlementStats:
    """Check all open positions for resolved markets and settle them."""
    with PostgresStorage(settings.db) as storage:
        portfolio = PortfolioManager(storage, settings.portfolio)
        positions = storage.get_open_positions()

        if not positions:
            logger.info("No open positions to settle")
            return SettlementStats()

        logger.info("Checking %d open positions for settlement", len(positions))

        # Group by venue
        kalshi_pos = [p for p in positions if p.venue == "kalshi"]
        poly_pos = [p for p in positions if p.venue == "polymarket"]

        k_settled, k_pnl = _settle_kalshi(kalshi_pos, portfolio, settings, notifier)
        p_settled, p_pnl = _settle_polymarket(poly_pos, portfolio, settings, notifier)

        total_settled = k_settled + p_settled
        total_pnl = k_pnl + p_pnl

        if total_settled > 0:
            logger.info(
                "Settlement complete: %d/%d positions settled, P&L=$%.2f",
                total_settled,
                len(positions),
                total_pnl,
            )
        else:
            logger.info(
                "Settlement check: %d positions checked, none resolved",
                len(positions),
            )

        return SettlementStats(
            checked=len(positions),
            settled=total_settled,
            pnl=round(total_pnl, 4),
        )
