"""Individual guard constraint checks."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from neutralis.categories import classify_market
from neutralis.config import DirectionalConfig, PipelineConfig, PortfolioConfig
from neutralis.models import GuardResult, NormalizedMarket, PortfolioSnapshot, Signal

if TYPE_CHECKING:
    from neutralis.storage.postgres import PostgresStorage


def check_min_edge(
    signal_edge_pct: float,
    config: PipelineConfig,
    *,
    cross_platform: bool = False,
) -> GuardResult:
    threshold = config.min_xp_edge_pct if cross_platform else config.min_edge_pct
    passed = signal_edge_pct >= threshold
    label = "xp_min" if cross_platform else "min"
    return GuardResult(
        guard_name="min_edge",
        passed=passed,
        reason=(
            f"edge {signal_edge_pct:.2f}% >= {label} {threshold:.2f}%"
            if passed
            else f"edge {signal_edge_pct:.2f}% < {label} {threshold:.2f}%"
        ),
        value=signal_edge_pct,
        threshold=threshold,
    )


def check_liquidity(market: NormalizedMarket, config: PipelineConfig) -> GuardResult:
    # Kalshi's market API doesn't report liquidity — treat 0 as unknown and pass
    if market.liquidity <= 0:
        return GuardResult(
            guard_name="liquidity",
            passed=True,
            reason="liquidity unknown (not reported by venue), deferring to orderbook depth",
        )
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


def check_orderbook_depth(
    market: NormalizedMarket,
    min_qty: float = 10.0,
    position_size: float | None = None,
) -> GuardResult:
    """Check top-of-book depth. Passes through if no orderbook data.

    When position_size is provided, requires depth >= max(min_qty, position_size).
    """
    if not market.yes_bids and not market.no_bids:
        return GuardResult(
            guard_name="orderbook_depth",
            passed=True,
            reason="no orderbook data, deferring to liquidity check",
        )

    required = max(min_qty, position_size or 0.0)
    yes_top_qty = market.yes_bids[0].quantity_dollars if market.yes_bids else 0.0
    no_top_qty = market.no_bids[0].quantity_dollars if market.no_bids else 0.0
    min_side = min(yes_top_qty, no_top_qty)

    passed = min_side >= required
    return GuardResult(
        guard_name="orderbook_depth",
        passed=passed,
        reason=(
            f"min top-of-book qty ${min_side:.2f} >= ${required:.2f}"
            if passed
            else f"min top-of-book qty ${min_side:.2f} < ${required:.2f}"
        ),
        value=min_side,
        threshold=required,
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


def check_category_exposure(
    proposed_size: float,
    category: str,
    category_overrides: dict[str, Any],
    snapshot: PortfolioSnapshot,
) -> GuardResult:
    """Check per-category exposure limit from category overrides."""
    override = category_overrides.get(category, {})
    cat_max = override.get("max_exposure_dollars")
    if cat_max is None:
        return GuardResult(
            guard_name="category_exposure",
            passed=True,
            reason=f"no per-category limit for '{category}'",
        )

    current = sum(
        p.size_dollars
        for p in snapshot.positions
        if classify_market(p.ticker, p.event_ticker) == category
    )
    new_total = current + proposed_size
    passed = new_total <= cat_max
    return GuardResult(
        guard_name="category_exposure",
        passed=passed,
        reason=(
            f"category '{category}' exposure ${new_total:.2f} <= cap ${cat_max:.2f}"
            if passed
            else f"category '{category}' exposure ${new_total:.2f} > cap ${cat_max:.2f}"
        ),
        value=new_total,
        threshold=cat_max,
    )


# -- Correlation guard --

# Maximum total exposure to correlated positions (same event series or related events)
_MAX_CORRELATED_EXPOSURE = 150.0  # $150 — 30% of default $500 max total


def _event_series(event_ticker: str) -> str:
    """Extract the series prefix from an event ticker.

    KXEPLGAME-26FEB21AVLLEE -> KXEPLGAME
    KXPREMIERLEAGUE-MCI -> KXPREMIERLEAGUE
    """
    # Split on first dash after the series name
    parts = event_ticker.split("-", 1)
    return parts[0] if parts else event_ticker


def check_position_correlation(
    signal: Signal,
    proposed_size: float,
    snapshot: PortfolioSnapshot,
    max_correlated_exposure: float = _MAX_CORRELATED_EXPOSURE,
) -> GuardResult:
    """Check if adding this position creates excessive correlated exposure.

    Correlation is detected by:
    1. Same event series prefix (e.g., multiple KXPREMIERLEAGUE positions)
    2. Same event_ticker (multiple positions in same match/event)

    Directional positions (not arbs) are higher correlation risk since
    arbs are naturally hedged.
    """
    signal_series = _event_series(signal.event_ticker)

    # Find existing positions in the same event series
    correlated_exposure = 0.0
    correlated_tickers: list[str] = []

    for pos in snapshot.positions:
        pos_series = _event_series(pos.event_ticker)
        if pos_series == signal_series:
            correlated_exposure += pos.size_dollars
            correlated_tickers.append(pos.ticker)

    new_correlated = correlated_exposure + proposed_size

    if new_correlated <= max_correlated_exposure:
        return GuardResult(
            guard_name="position_correlation",
            passed=True,
            reason=(
                f"series '{signal_series}' correlated exposure "
                f"${new_correlated:.2f} <= ${max_correlated_exposure:.2f}"
            ),
            value=new_correlated,
            threshold=max_correlated_exposure,
        )

    return GuardResult(
        guard_name="position_correlation",
        passed=False,
        reason=(
            f"series '{signal_series}' correlated exposure "
            f"${new_correlated:.2f} > ${max_correlated_exposure:.2f} "
            f"({len(correlated_tickers)} existing positions)"
        ),
        value=new_correlated,
        threshold=max_correlated_exposure,
    )


# -- Directional strategy guards --


def check_min_implied_probability(
    signal: Signal,
    min_probability: float = 0.80,
) -> GuardResult:
    """Validate a directional signal's implied probability meets the threshold."""
    prob = signal.implied_probability
    passed = prob >= min_probability
    return GuardResult(
        guard_name="min_implied_probability",
        passed=passed,
        reason=(
            f"implied probability {prob:.2f} >= min {min_probability:.2f}"
            if passed
            else f"implied probability {prob:.2f} < min {min_probability:.2f}"
        ),
        value=prob,
        threshold=min_probability,
    )


# -- Daily loss circuit breaker --


def check_daily_loss_limit(
    storage: PostgresStorage,
    config: PortfolioConfig,
) -> GuardResult:
    """Check if today's cumulative P&L has breached the daily loss limit.

    Computes total daily P&L as:
        realized P&L from positions closed today (UTC) + unrealized P&L from open positions

    Trips the circuit breaker if EITHER:
        1. daily_pnl <= -max_daily_loss_dollars   (absolute dollar cap)
        2. daily_pnl <= -(max_total_exposure * max_daily_loss_pct / 100)  (percentage cap)

    Returns a GuardResult with passed=False when the limit is breached.
    """
    realized_today = storage.get_today_realized_pnl()
    unrealized = storage.get_today_unrealized_pnl()
    daily_pnl = realized_today + unrealized

    # Compute both thresholds
    abs_limit = config.max_daily_loss_dollars
    pct_limit_dollars = config.max_total_exposure_dollars * config.max_daily_loss_pct / 100.0

    # Use whichever is MORE restrictive (smaller negative threshold)
    effective_limit = min(abs_limit, pct_limit_dollars)

    breached = daily_pnl <= -effective_limit

    if breached:
        # Determine which trigger fired
        if daily_pnl <= -abs_limit and daily_pnl <= -pct_limit_dollars:
            trigger = f"both (${abs_limit:.2f} abs + {config.max_daily_loss_pct:.1f}% = ${pct_limit_dollars:.2f})"
        elif daily_pnl <= -abs_limit:
            trigger = f"absolute ${abs_limit:.2f}"
        else:
            trigger = f"percentage {config.max_daily_loss_pct:.1f}% = ${pct_limit_dollars:.2f}"

        return GuardResult(
            guard_name="daily_loss_limit",
            passed=False,
            reason=(
                f"CIRCUIT BREAKER: daily P&L ${daily_pnl:.2f} breached {trigger} limit "
                f"(realized=${realized_today:.2f} + unrealized=${unrealized:.2f})"
            ),
            value=daily_pnl,
            threshold=-effective_limit,
        )

    return GuardResult(
        guard_name="daily_loss_limit",
        passed=True,
        reason=(
            f"daily P&L ${daily_pnl:.2f} within limit "
            f"(realized=${realized_today:.2f} + unrealized=${unrealized:.2f}, "
            f"limit=-${effective_limit:.2f})"
        ),
        value=daily_pnl,
        threshold=-effective_limit,
    )
