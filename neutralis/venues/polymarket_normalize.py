"""Polymarket Gamma API response -> NormalizedMarket conversion."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from neutralis.logging import get_logger
from neutralis.models import MarketStatus, MarketType, NormalizedMarket

logger = get_logger(__name__)


def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _parse_iso_dt(val: Any) -> Optional[datetime]:
    if not val:
        return None
    try:
        s = str(val).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def normalize_market(raw: dict[str, Any]) -> Optional[NormalizedMarket]:
    """Convert a raw Polymarket Gamma market dict into a NormalizedMarket.

    Only emits binary markets (exactly 2 outcomes).
    """
    # Polymarket uses conditionId as primary identifier, fall back to id
    ticker = raw.get("conditionId") or raw.get("id") or ""
    if not ticker:
        return None

    # Only binary markets (2 outcomes)
    outcomes = raw.get("outcomes")
    if isinstance(outcomes, str):
        try:
            outcomes = json.loads(outcomes)
        except (json.JSONDecodeError, TypeError):
            outcomes = None
    if not outcomes or len(outcomes) != 2:
        return None

    question = raw.get("question", "")
    if not question:
        return None

    # Parse outcome prices -- array of strings mapping 1:1 with outcomes
    outcome_prices = raw.get("outcomePrices")
    if isinstance(outcome_prices, str):
        try:
            outcome_prices = json.loads(outcome_prices)
        except (json.JSONDecodeError, TypeError):
            outcome_prices = None

    yes_price = 0.0
    no_price = 0.0
    if outcome_prices and len(outcome_prices) >= 2:
        yes_price = _safe_float(outcome_prices[0])
        no_price = _safe_float(outcome_prices[1])

    # Use bestBid/bestAsk when they indicate real two-sided markets
    best_bid = _safe_float(raw.get("bestBid"))
    best_ask = _safe_float(raw.get("bestAsk"))
    # bestAsk=1.0 with bestBid=0 indicates a dead/expired market — ignore
    if best_bid > 0 and best_ask > 0 and best_ask < 1.0:
        yes_bid = best_bid
        yes_ask = best_ask
    else:
        yes_bid = yes_price
        yes_ask = yes_price

    # Status
    closed = raw.get("closed", False)
    active = raw.get("active", True)
    if closed:
        status = MarketStatus.CLOSED
    elif active:
        status = MarketStatus.ACTIVE
    else:
        status = MarketStatus.INACTIVE

    return NormalizedMarket(
        ticker=str(ticker),
        event_ticker=raw.get("slug", ""),
        market_type=MarketType.BINARY,
        title=question,
        subtitle="",
        status=status,
        yes_bid=yes_bid,
        yes_ask=yes_ask,
        no_bid=no_price,
        no_ask=no_price,
        volume=_safe_float(raw.get("volume")),
        volume_24h=_safe_float(raw.get("volume24hr")),
        liquidity=_safe_float(raw.get("liquidity")),
        open_interest=0.0,
        close_time=_parse_iso_dt(raw.get("endDate")),
        expected_expiration=_parse_iso_dt(raw.get("endDate")),
        venue="polymarket",
    )
