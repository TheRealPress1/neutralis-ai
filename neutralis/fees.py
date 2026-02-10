"""Venue-specific fee calculations.

Kalshi: taker fee = 0.07 * P * (1 - P) per contract, capped at $0.0175
        maker fee = 0.0175 * P * (1 - P) per contract, capped at ~$0.0044
Polymarket: zero fees on most markets (political, sports, etc.)
            15-min crypto markets have taker fees, but we skip those.
"""

from __future__ import annotations


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


def polymarket_fee(
    price: float,
    contracts: int = 1,
) -> float:
    """Polymarket fee. Zero for standard markets (political, sports, etc.).

    15-minute crypto markets have taker fees but we don't trade those.
    Polymarket US (CFTC-regulated) charges 0.01% — negligible.
    """
    # No meaningful fee for the markets we trade
    return 0.0


def estimate_total_fee(
    yes_price: float,
    no_price: float,
    venue: str = "kalshi",
    contracts: int = 1,
    *,
    maker: bool = False,
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
            polymarket_fee(yes_price, contracts)
            + polymarket_fee(no_price, contracts)
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
) -> float:
    """Total estimated fee for a cross-platform arb (YES on one venue, NO on another)."""
    if yes_venue == "kalshi":
        yes_fee = kalshi_fee(yes_price, contracts)
    else:
        yes_fee = polymarket_fee(yes_price, contracts)

    if no_venue == "kalshi":
        no_fee = kalshi_fee(no_price, contracts)
    else:
        no_fee = polymarket_fee(no_price, contracts)

    return yes_fee + no_fee
