"""Venue-specific fee calculations.

Kalshi: taker fee = 0.07 * P * (1 - P) per contract, capped at $0.0175
        maker fee = 0.0175 * P * (1 - P) per contract, capped at ~$0.0044
Polymarket: category-specific fees (most markets zero, crypto/some sports have fees).
  Source: https://docs.polymarket.com/trading/fees (Mar 2026)
"""

from __future__ import annotations

import re


# -- Kalshi fee schedule --
# Source: https://kalshi.com/fee-schedule (Feb 2026)
# Fee = ceil_cent(coeff * contracts * P * (1 - P))
# Some markets (S&P 500, Nasdaq-100) use halved coefficients.

_KALSHI_TAKER_COEFF = 0.07
_KALSHI_MAKER_COEFF = 0.0175


def kalshi_fee_per_contract(
    price: float,
    *,
    maker: bool = False,
) -> float:
    """Fee for a single Kalshi contract at the given price.

    Formula: coeff * P * (1 - P)
    Max fee at P=0.50: taker=$0.0175, maker=$0.0044.

    Args:
        price: Contract price in dollars (0.0 to 1.0).
        maker: Use maker fee rate (resting order) vs taker (immediate fill).

    Returns:
        Fee in dollars per contract.
    """
    if price <= 0 or price >= 1.0:
        return 0.0
    coeff = _KALSHI_MAKER_COEFF if maker else _KALSHI_TAKER_COEFF
    return round(coeff * price * (1 - price), 4)


def kalshi_fee(
    price: float,
    contracts: int = 1,
    *,
    maker: bool = False,
) -> float:
    """Total Kalshi fee for N contracts at the given price."""
    return kalshi_fee_per_contract(price, maker=maker) * contracts


# -- Polymarket fee schedule --
# Source: https://docs.polymarket.com/trading/fees (Mar 2026)
#
# Fee tiers:
#   "standard" — zero fees (political, entertainment, most sports)
#   "crypto"   — fee = C * 0.25 * (P*(1-P))^2, max ~1.56% at P=0.50
#   "sports_fee" — fee = C * 0.0175 * P*(1-P), max ~0.44% at P=0.50 (NCAAB, Serie A)
#
# Maker rebates (20-25%) exist but we don't count on them for edge estimation.

_POLY_CRYPTO_FEE_RATE = 0.25
_POLY_CRYPTO_EXPONENT = 2
_POLY_SPORTS_FEE_RATE = 0.0175
_POLY_SPORTS_EXPONENT = 1

# Keywords for classifying Polymarket fee tiers from market title/event ticker
_CRYPTO_KEYWORDS_RE = re.compile(
    r"\b(bitcoin|btc|ethereum|eth|solana|sol|xrp|crypto|defi|"
    r"altcoin|dogecoin|doge|cardano|ada|polkadot|dot|avalanche|avax|"
    r"chainlink|link|litecoin|ltc|bnb|binance)\b",
    re.IGNORECASE,
)
_CRYPTO_PRICE_RE = re.compile(r"\$\d+k?\b", re.IGNORECASE)  # "$150k", "$100000"

_SPORTS_FEE_KEYWORDS_RE = re.compile(
    r"\b(ncaab|ncaa basketball|college basketball|march madness|"
    r"serie a|seriea|serie_a)\b",
    re.IGNORECASE,
)


def classify_poly_fee_tier(title: str, event_ticker: str = "") -> str:
    """Determine Polymarket fee tier from market title/event ticker.

    Returns:
        "crypto" — crypto markets (all timeframes)
        "sports_fee" — NCAAB, Serie A
        "standard" — everything else (zero fees)
    """
    combined = f"{title} {event_ticker}"

    if _CRYPTO_KEYWORDS_RE.search(combined):
        return "crypto"
    # Catch crypto price milestone markets like "Will BTC hit $150k?"
    if _CRYPTO_PRICE_RE.search(combined) and "bitcoin" in combined.lower():
        return "crypto"

    if _SPORTS_FEE_KEYWORDS_RE.search(combined):
        return "sports_fee"

    return "standard"


def polymarket_fee_per_contract(
    price: float,
    *,
    fee_tier: str = "standard",
) -> float:
    """Per-contract Polymarket fee based on market fee tier.

    Fee tiers (from Polymarket docs):
    - "standard": Zero fees (political, entertainment, most sports)
    - "crypto": 0.25 * (P*(1-P))^2, max ~$0.0156 at P=0.50
    - "sports_fee": 0.0175 * P*(1-P), max ~$0.0044 at P=0.50 (NCAAB, Serie A)
    """
    if price <= 0 or price >= 1.0:
        return 0.0

    pq = price * (1.0 - price)

    if fee_tier == "crypto":
        return round(_POLY_CRYPTO_FEE_RATE * pq ** _POLY_CRYPTO_EXPONENT, 6)
    if fee_tier == "sports_fee":
        return round(_POLY_SPORTS_FEE_RATE * pq ** _POLY_SPORTS_EXPONENT, 6)
    if fee_tier == "us_flat":
        # Polymarket US flat taker fee — delegate to US-specific function
        return round(price * _POLY_US_TAKER_FEE_RATE, 6)
    # standard — zero fees
    return 0.0


def polymarket_fee(
    price: float,
    contracts: int = 1,
    *,
    fee_tier: str = "standard",
) -> float:
    """Total Polymarket fee for N contracts."""
    return polymarket_fee_per_contract(price, fee_tier=fee_tier) * contracts


# -- Polymarket US fee schedule --
# Source: https://docs.polymarket.us (Mar 2026)
# Flat 0.10% taker fee on total contract premium, 0.10% maker rebate (net zero).

_POLY_US_TAKER_FEE_RATE = 0.001  # 0.10%


def polymarket_us_fee_per_contract(
    price: float,
    *,
    maker: bool = False,
) -> float:
    """Per-contract Polymarket US fee.

    Flat 0.10% taker on contract premium, maker rebate offsets fee (net zero).
    """
    if price <= 0 or price >= 1.0:
        return 0.0
    if maker:
        return 0.0  # Rebate offsets fee
    return round(price * _POLY_US_TAKER_FEE_RATE, 6)


def polymarket_us_fee(
    price: float,
    contracts: int = 1,
    *,
    maker: bool = False,
) -> float:
    """Total Polymarket US fee for N contracts."""
    return polymarket_us_fee_per_contract(price, maker=maker) * contracts


def estimate_total_fee(
    yes_price: float,
    no_price: float,
    venue: str = "kalshi",
    contracts: int = 1,
    *,
    maker: bool = False,
    fee_tier: str = "standard",
) -> float:
    """Total estimated fee for a complement arb (buying both YES and NO).

    For single-venue complement arb, both legs are on the same venue.
    """
    if venue == "kalshi":
        return (
            kalshi_fee(yes_price, contracts, maker=maker)
            + kalshi_fee(no_price, contracts, maker=maker)
        )
    if venue == "polymarket":
        return (
            polymarket_fee(yes_price, contracts, fee_tier=fee_tier)
            + polymarket_fee(no_price, contracts, fee_tier=fee_tier)
        )
    if venue == "polymarket_us":
        return (
            polymarket_us_fee(yes_price, contracts, maker=maker)
            + polymarket_us_fee(no_price, contracts, maker=maker)
        )
    # Unknown venue — conservative estimate using Kalshi taker rates
    return (
        kalshi_fee(yes_price, contracts, maker=False)
        + kalshi_fee(no_price, contracts, maker=False)
    )


def estimate_cross_platform_fee(
    yes_price: float,
    yes_venue: str,
    no_price: float,
    no_venue: str,
    contracts: int = 1,
    *,
    maker: bool = False,
    yes_fee_tier: str = "standard",
    no_fee_tier: str = "standard",
) -> float:
    """Total estimated fee for a cross-platform arb (YES on one venue, NO on another).

    When maker=True, Kalshi legs use the maker fee rate (4x cheaper) assuming
    we'll post GTC limit orders that rest on the book.
    """
    if yes_venue == "kalshi":
        yes_fee = kalshi_fee(yes_price, contracts, maker=maker)
    elif yes_venue == "polymarket_us":
        yes_fee = polymarket_us_fee(yes_price, contracts, maker=maker)
    else:
        yes_fee = polymarket_fee(yes_price, contracts, fee_tier=yes_fee_tier)

    if no_venue == "kalshi":
        no_fee = kalshi_fee(no_price, contracts, maker=maker)
    elif no_venue == "polymarket_us":
        no_fee = polymarket_us_fee(no_price, contracts, maker=maker)
    else:
        no_fee = polymarket_fee(no_price, contracts, fee_tier=no_fee_tier)

    return yes_fee + no_fee


def estimate_three_way_fee(
    prices: tuple[float, float, float],
    venues: tuple[str, str, str] = ("kalshi", "kalshi", "kalshi"),
    contracts: int = 1,
    *,
    maker: bool = False,
    fee_tiers: tuple[str, str, str] = ("standard", "standard", "standard"),
) -> float:
    """Total fee for a 3-leg Dutch book arb (buy all 3 outcomes).

    Each leg's fee depends on the venue and fee tier.
    """
    total = 0.0
    for price, venue, tier in zip(prices, venues, fee_tiers):
        if venue == "kalshi":
            total += kalshi_fee(price, contracts, maker=maker)
        elif venue == "polymarket_us":
            total += polymarket_us_fee(price, contracts, maker=maker)
        else:
            total += polymarket_fee(price, contracts, fee_tier=tier)
    return total
