"""Individual guard constraint checks."""

from __future__ import annotations

from datetime import datetime, timezone

from neutralis.config import PipelineConfig, PortfolioConfig
from neutralis.models import GuardResult, NormalizedMarket, PortfolioSnapshot, Signal


def check_min_edge(signal_edge_pct: float, config: PipelineConfig) -> GuardResult:
    passed = signal_edge_pct >= config.min_edge_pct
    return GuardResult(
        guard_name="min_edge",
        passed=passed,
        reason=(
            f"edge {signal_edge_pct:.2f}% >= min {config.min_edge_pct:.2f}%"
            if passed
            else f"edge {signal_edge_pct:.2f}% < min {config.min_edge_pct:.2f}%"
        ),
        value=signal_edge_pct,
        threshold=config.min_edge_pct,
    )


def check_liquidity(market: NormalizedMarket, config: PipelineConfig) -> GuardResult:
    passed = market.liquidity >= config.min_liquidity_dollars
    return GuardResult(
        guard_name="liquidity",
        passed=passed,
        reason=(
            f"liquidity ${market.liquidity:.2f} >= min ${config.min_liquidity_dollars:.2f}"
            if passed
            else f"liquidity ${market.liquidity:.2f} < min ${config.min_liquidity_dollars:.2f}"
        ),
        value=market.liquidity,
        threshold=config.min_liquidity_dollars,
    )


def check_time_to_expiry(market: NormalizedMarket, config: PipelineConfig) -> GuardResult:
    dt = market.expected_expiration or market.close_time
    if dt is None:
        return GuardResult(
            guard_name="time_to_expiry",
            passed=False,
            reason="no expiration time available",
        )

    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    hours_left = (dt - now).total_seconds() / 3600.0

    if hours_left < config.min_time_to_expiry_hours:
        return GuardResult(
            guard_name="time_to_expiry",
            passed=False,
            reason=f"{hours_left:.1f}h left < min {config.min_time_to_expiry_hours:.1f}h",
            value=hours_left,
            threshold=config.min_time_to_expiry_hours,
        )

    if hours_left > config.max_time_to_expiry_hours:
        return GuardResult(
            guard_name="time_to_expiry",
            passed=False,
            reason=f"{hours_left:.1f}h left > max {config.max_time_to_expiry_hours:.1f}h",
            value=hours_left,
            threshold=config.max_time_to_expiry_hours,
        )

    return GuardResult(
        guard_name="time_to_expiry",
        passed=True,
        reason=f"{hours_left:.1f}h until expiry (within bounds)",
        value=hours_left,
    )


def check_orderbook_depth(market: NormalizedMarket, min_qty: float = 10.0) -> GuardResult:
    """Check top-of-book depth. Passes through if no orderbook data."""
    if not market.yes_bids and not market.no_bids:
        return GuardResult(
            guard_name="orderbook_depth",
            passed=True,
            reason="no orderbook data, deferring to liquidity check",
        )

    yes_top_qty = market.yes_bids[0].quantity_dollars if market.yes_bids else 0.0
    no_top_qty = market.no_bids[0].quantity_dollars if market.no_bids else 0.0
    min_side = min(yes_top_qty, no_top_qty)

    passed = min_side >= min_qty
    return GuardResult(
        guard_name="orderbook_depth",
        passed=passed,
        reason=(
            f"min top-of-book qty ${min_side:.2f} >= ${min_qty:.2f}"
            if passed
            else f"min top-of-book qty ${min_side:.2f} < ${min_qty:.2f}"
        ),
        value=min_side,
        threshold=min_qty,
    )


# -- Portfolio-aware checks (Guard v2) --


def check_total_exposure(
    proposed_size: float,
    snapshot: PortfolioSnapshot,
    config: PortfolioConfig,
) -> GuardResult:
    new_total = snapshot.total_exposure_dollars + proposed_size
    limit = config.max_total_exposure_dollars
    passed = new_total <= limit
    return GuardResult(
        guard_name="total_exposure",
        passed=passed,
        reason=(
            f"projected exposure ${new_total:.2f} <= cap ${limit:.2f}"
            if passed
            else f"projected exposure ${new_total:.2f} > cap ${limit:.2f}"
        ),
        value=new_total,
        threshold=limit,
    )


def check_event_exposure(
    proposed_size: float,
    event_ticker: str,
    snapshot: PortfolioSnapshot,
    config: PortfolioConfig,
) -> GuardResult:
    current = dict(snapshot.event_exposure).get(event_ticker, 0.0)
    new_exposure = current + proposed_size
    limit = config.max_event_exposure_dollars
    passed = new_exposure <= limit
    return GuardResult(
        guard_name="event_exposure",
        passed=passed,
        reason=(
            f"event '{event_ticker}' exposure ${new_exposure:.2f} <= cap ${limit:.2f}"
            if passed
            else f"event '{event_ticker}' exposure ${new_exposure:.2f} > cap ${limit:.2f}"
        ),
        value=new_exposure,
        threshold=limit,
    )


def check_ticker_exposure(
    proposed_size: float,
    ticker: str,
    snapshot: PortfolioSnapshot,
    config: PortfolioConfig,
) -> GuardResult:
    current = sum(p.size_dollars for p in snapshot.positions if p.ticker == ticker)
    new_exposure = current + proposed_size
    limit = config.max_ticker_exposure_dollars
    passed = new_exposure <= limit
    return GuardResult(
        guard_name="ticker_exposure",
        passed=passed,
        reason=(
            f"ticker '{ticker}' exposure ${new_exposure:.2f} <= cap ${limit:.2f}"
            if passed
            else f"ticker '{ticker}' exposure ${new_exposure:.2f} > cap ${limit:.2f}"
        ),
        value=new_exposure,
        threshold=limit,
    )


def check_venue_concentration(
    proposed_size: float,
    venue: str,
    snapshot: PortfolioSnapshot,
    config: PortfolioConfig,
) -> GuardResult:
    current_venue = dict(snapshot.venue_exposure).get(venue, 0.0)
    new_venue = current_venue + proposed_size
    new_total = snapshot.total_exposure_dollars + proposed_size

    # Venue % not meaningful for very small portfolios
    if new_total < 50.0:
        return GuardResult(
            guard_name="venue_concentration",
            passed=True,
            reason=f"portfolio too small (${new_total:.2f}) for venue % check",
            value=0.0,
            threshold=config.max_venue_exposure_pct,
        )

    concentration = new_venue / new_total
    limit = config.max_venue_exposure_pct
    passed = concentration <= limit
    return GuardResult(
        guard_name="venue_concentration",
        passed=passed,
        reason=(
            f"venue '{venue}' concentration {concentration:.1%} <= limit {limit:.0%}"
            if passed
            else f"venue '{venue}' concentration {concentration:.1%} > limit {limit:.0%}"
        ),
        value=concentration,
        threshold=limit,
    )


def check_open_position_count(
    snapshot: PortfolioSnapshot,
    config: PortfolioConfig,
) -> GuardResult:
    count = snapshot.open_position_count
    limit = config.max_open_positions
    passed = count < limit
    return GuardResult(
        guard_name="open_position_count",
        passed=passed,
        reason=(
            f"{count} open positions < limit {limit}"
            if passed
            else f"{count} open positions >= limit {limit}"
        ),
        value=float(count),
        threshold=float(limit),
    )


def check_duplicate_position(
    signal: Signal,
    snapshot: PortfolioSnapshot,
) -> GuardResult:
    for leg in signal.legs:
        side_val = "buy_yes" if leg.side == "yes" else "buy_no"
        for p in snapshot.positions:
            if p.ticker == leg.ticker and p.side.value == side_val:
                return GuardResult(
                    guard_name="duplicate_position",
                    passed=False,
                    reason=(
                        f"already have open {p.side.value} position on "
                        f"'{p.ticker}' (${p.size_dollars:.2f})"
                    ),
                    value=p.size_dollars,
                )
    return GuardResult(
        guard_name="duplicate_position",
        passed=True,
        reason="no duplicate positions found",
    )
