"""Individual guard constraint checks."""

from __future__ import annotations

from datetime import datetime, timezone

from neutralis.config import PipelineConfig
from neutralis.models import GuardResult, NormalizedMarket


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
