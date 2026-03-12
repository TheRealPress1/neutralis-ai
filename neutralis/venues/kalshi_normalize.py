"""Kalshi raw response -> NormalizedMarket conversion."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from neutralis.logging import get_logger
from neutralis.models import (
    MarketStatus,
    MarketType,
    NormalizedMarket,
    OrderbookLevel,
)

logger = get_logger(__name__)

# Kalshi match series that produce 3-way markets (Team A / Team B / Draw)
_MATCH_SERIES = frozenset({
    "KXEPLGAME", "KXBUNDESLIGAGAME", "KXLIGUE1GAME", "KXSERIEAGAME",
    "KXBRASILEIROGAME", "KXSCOTTISHPREMGAME", "KXUEFAGAME",
})
_DRAW_SUFFIXES = ("-TIE", "-DRAW", "-DRW")


def _parse_dollar_str(val: Any, default: float = 0.0) -> float:
    """Convert Kalshi dollar string (e.g. '0.5500') to float."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _parse_iso_dt(val: Any) -> Optional[datetime]:
    """Parse ISO 8601 string to datetime, or None."""
    if not val:
        return None
    try:
        s = str(val).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _parse_orderbook_levels(
    raw_levels: list[list[str]] | None,
) -> tuple[OrderbookLevel, ...]:
    """Convert orderbook_fp level arrays to OrderbookLevel tuples.

    Input: [["0.1500", "100.00"], ["0.2000", "50.00"], ...]
    """
    if not raw_levels:
        return ()
    levels = []
    for pair in raw_levels:
        if len(pair) >= 2:
            levels.append(
                OrderbookLevel(
                    price_dollars=_parse_dollar_str(pair[0]),
                    quantity_dollars=_parse_dollar_str(pair[1]),
                )
            )
    return tuple(levels)


def normalize_market(
    raw: dict[str, Any],
    orderbook_raw: dict[str, Any] | None = None,
) -> Optional[NormalizedMarket]:
    """Convert a raw Kalshi market dict into a NormalizedMarket.

    Args:
        raw: Single market dict from GET /markets response.
        orderbook_raw: Optional response from GET /markets/{ticker}/orderbook.
    """
    ticker = raw.get("ticker")
    if not ticker:
        logger.warning("Skipping market with no ticker: %s", raw.get("title", "?"))
        return None

    # Skip multi-leg parlays — they have mve_selected_legs or titles starting with "yes "/"no "
    if raw.get("mve_selected_legs"):
        return None
    title_raw = raw.get("title", "")
    if title_raw.startswith("yes ") or title_raw.startswith("no "):
        return None

    try:
        market_type = MarketType(raw.get("market_type", "binary"))
    except ValueError:
        logger.warning("Unknown market_type for %s: %s", ticker, raw.get("market_type"))
        return None

    try:
        status = MarketStatus(raw.get("status", "active"))
    except ValueError:
        logger.warning("Unknown status for %s: %s", ticker, raw.get("status"))
        status = MarketStatus.ACTIVE

    # Reject non-active markets (determined, finalized, closed, etc.)
    if status not in (MarketStatus.ACTIVE, MarketStatus.INITIALIZED):
        return None

    yes_bids: tuple[OrderbookLevel, ...] = ()
    no_bids: tuple[OrderbookLevel, ...] = ()
    if orderbook_raw:
        ob_fp = orderbook_raw.get("orderbook_fp", {})
        yes_bids = _parse_orderbook_levels(ob_fp.get("yes_dollars"))
        no_bids = _parse_orderbook_levels(ob_fp.get("no_dollars"))

    # Detect 3-way match outcome from ticker suffix
    event_ticker = raw.get("event_ticker", "")
    outcome_label = ""
    series_prefix = event_ticker.split("-")[0] if event_ticker else ""
    if series_prefix in _MATCH_SERIES and ticker.startswith(event_ticker + "-"):
        suffix = ticker[len(event_ticker) + 1:]
        if any(ticker.endswith(s) for s in _DRAW_SUFFIXES):
            outcome_label = "draw"
        else:
            outcome_label = f"team:{suffix.lower()}"

    return NormalizedMarket(
        ticker=ticker,
        event_ticker=event_ticker,
        market_type=market_type,
        title=raw.get("title", ""),
        subtitle=raw.get("subtitle", ""),
        status=status,
        yes_bid=_parse_dollar_str(raw.get("yes_bid_dollars")),
        yes_ask=_parse_dollar_str(raw.get("yes_ask_dollars")),
        no_bid=_parse_dollar_str(raw.get("no_bid_dollars")),
        no_ask=_parse_dollar_str(raw.get("no_ask_dollars")),
        volume=_parse_dollar_str(raw.get("volume_fp")),
        volume_24h=_parse_dollar_str(raw.get("volume_24h_fp")),
        liquidity=_parse_dollar_str(raw.get("liquidity_dollars")),
        open_interest=_parse_dollar_str(raw.get("open_interest_fp")),
        close_time=_parse_iso_dt(raw.get("close_time")),
        expected_expiration=_parse_iso_dt(raw.get("expected_expiration_time")),
        notional_value=_parse_dollar_str(raw.get("notional_value_dollars"), default=1.0),
        yes_bids=yes_bids,
        no_bids=no_bids,
        outcome_label=outcome_label,
    )
