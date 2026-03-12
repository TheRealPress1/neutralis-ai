"""Polymarket US API response -> NormalizedMarket conversion."""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Optional

from neutralis.logging import get_logger
from neutralis.models import MarketStatus, MarketType, NormalizedMarket

_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")

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


def normalize_us_market(raw: dict[str, Any]) -> Optional[NormalizedMarket]:
    """Convert a raw Polymarket US market dict into a NormalizedMarket.

    US markets use ``slug`` as the primary identifier (no conditionId/tokenId).
    Only binary markets (2 outcomes) are supported.
    """
    slug = raw.get("slug") or raw.get("marketSlug") or ""
    if not slug:
        return None

    question = raw.get("question") or raw.get("title") or ""
    if not question:
        return None

    # Enrich title with team full names from marketSides for better cross-platform matching
    sides = raw.get("marketSides", [])
    team_names = []
    for side in sides:
        team = side.get("team", {})
        name = team.get("name", "")
        if name and name not in team_names:
            team_names.append(name)
    subtitle = " vs ".join(team_names) if team_names else ""

    # Accept binary-like market types (moneyline = 2 sides, futures = multi-side)
    outcomes = raw.get("outcomes")
    if isinstance(outcomes, str):
        try:
            outcomes = json.loads(outcomes)
        except (json.JSONDecodeError, TypeError):
            outcomes = None

    # Polymarket US sports markets have marketSides instead of outcomes
    market_sides = raw.get("marketSides", [])

    # Only binary (2-outcome) markets — moneyline, spread, total, etc.
    n_outcomes = len(outcomes) if outcomes else len(market_sides)
    if n_outcomes != 2:
        return None

    # Parse outcome prices
    outcome_prices = raw.get("outcomePrices")
    if isinstance(outcome_prices, str):
        try:
            outcome_prices = json.loads(outcome_prices)
        except (json.JSONDecodeError, TypeError):
            outcome_prices = None

    yes_price = 0.0
    no_price = 0.0
    if outcome_prices and len(outcome_prices) >= 2:
        # For sports markets: index 0 = first team (long), index 1 = second team (short)
        # Map long side → "yes", short side → "no"
        if market_sides and len(market_sides) >= 2:
            for i, side in enumerate(market_sides):
                if i < len(outcome_prices):
                    if side.get("long", i == 0):
                        yes_price = _safe_float(outcome_prices[i])
                    else:
                        no_price = _safe_float(outcome_prices[i])
        elif outcomes:
            # Standard yes/no or named outcomes
            for i, label in enumerate(outcomes):
                label_lower = str(label).strip().lower()
                if label_lower == "yes":
                    yes_price = _safe_float(outcome_prices[i])
                elif label_lower == "no":
                    no_price = _safe_float(outcome_prices[i])
            if yes_price == 0.0 and no_price == 0.0:
                yes_price = _safe_float(outcome_prices[0])
                no_price = _safe_float(outcome_prices[1])
        else:
            yes_price = _safe_float(outcome_prices[0])
            no_price = _safe_float(outcome_prices[1])

    # Use bestBid/bestAsk for current market pricing
    best_bid = _safe_float(raw.get("bestBid"))
    best_ask = _safe_float(raw.get("bestAsk"))
    if best_bid > 0 and best_ask > 0 and best_ask < 1.0:
        yes_bid = best_bid
        yes_ask = best_ask
    elif yes_price > 0:
        yes_bid = yes_price
        yes_ask = yes_price
    else:
        # Last trade price as fallback
        ltp = _safe_float(raw.get("lastTradePrice"))
        yes_bid = ltp
        yes_ask = ltp

    if yes_bid <= 0 and yes_ask <= 0:
        return None  # No usable price data

    # Derive NO prices from YES prices
    no_bid = round(1.0 - yes_ask, 4) if yes_ask > 0 else 0.0
    no_ask = round(1.0 - yes_bid, 4) if yes_bid > 0 else 0.0

    # Status
    closed = raw.get("closed", False)
    active = raw.get("active", True)
    accepting_orders = raw.get("acceptingOrders", True)
    if closed:
        status = MarketStatus.CLOSED
    elif active and accepting_orders:
        status = MarketStatus.ACTIVE
    else:
        status = MarketStatus.INACTIVE

    # Detect 3-way match outcome from question text and slug
    outcome_label = ""
    q_lower = question.lower()
    if "draw" in q_lower or " tie" in q_lower or "tie " in q_lower:
        outcome_label = "draw"
    elif market_sides and len(market_sides) == 2:
        # Moneyline market — extract team outcome from slug suffix after date
        date_match = _DATE_RE.search(slug)
        if date_match:
            after_date = slug[date_match.end():]
            if after_date.startswith("-") and len(after_date) > 1:
                outcome_label = f"team:{after_date[1:]}"

    return NormalizedMarket(
        ticker=slug,
        event_ticker=slug,
        market_type=MarketType.BINARY,
        title=question,
        subtitle=subtitle,
        status=status,
        yes_bid=yes_bid,
        yes_ask=yes_ask,
        no_bid=no_bid,
        no_ask=no_ask,
        volume=_safe_float(raw.get("volumeNum")),
        volume_24h=_safe_float(raw.get("volume24hr")),
        liquidity=_safe_float(raw.get("liquidityNum")),
        open_interest=0.0,
        close_time=_parse_iso_dt(raw.get("endDate")),
        expected_expiration=_parse_iso_dt(raw.get("endDate")),
        venue="polymarket_us",
        market_slug=slug,
        poly_fee_tier="us_flat",
        outcome_label=outcome_label,
    )
