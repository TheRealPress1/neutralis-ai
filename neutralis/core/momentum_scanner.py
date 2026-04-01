"""Live event momentum scanner — detects high-confidence directional moves in sports markets.

Combines four signals that must ALL agree before firing:
  1. Price velocity  — YES mid-price moved ≥ threshold in 5 min window
  2. Volume surge    — current 5m volume ≥ Nx rolling average
  3. Flow imbalance  — ≥ 75% buy/sell pressure, matching velocity direction
  4. Implied probability — market prices favored side at 75-95%

Example: Tennis player winning 5-3 in deciding set causes YES to spike
from 0.65→0.85 with heavy buying. All four factors align → fire signal.

Research basis (Becker 2026): Sports markets have 2.23pp maker-taker gap.
Momentum trades during live events capture this gap + price dislocation.
"""

from __future__ import annotations

import time
from collections import deque
from typing import Any

from neutralis.config import MomentumConfig
from neutralis.logging import get_logger
from neutralis.models import NormalizedMarket, Signal, SignalType, TradeLeg

logger = get_logger(__name__)

# Default thresholds (overridden by MomentumConfig)
_MIN_PRICE_VELOCITY = 0.10
_VOLUME_SURGE_MULT = 3.0
_FLOW_IMBALANCE = 0.75
_MIN_IMPLIED_PROB = 0.75
_MAX_ENTRY_PRICE = 0.95
_MIN_ENTRY_PRICE = 0.30
_MIN_VOLUME_5M = 30
_MIN_PRICE_OBS = 3

# Per-sport defaults
_SPORT_PARAMS: dict[str, tuple[float, float]] = {
    # (min_velocity, surge_multiplier)
    "tennis": (0.08, 2.5),
    "soccer": (0.12, 3.0),
    "basketball": (0.10, 3.0),
}

# Trade flow window (must match event_loop _TRADE_FLOW_WINDOW_SEC)
_WINDOW_SEC = 300.0


def check_live_momentum(
    ticker: str,
    market: NormalizedMarket,
    sport: str,
    buy_volume_5m: int,
    sell_volume_5m: int,
    total_volume_5m: int,
    price_history: deque[tuple[float, float]],
    rolling_avg_volume: float,
    config: MomentumConfig | None = None,
    score_context: Any | None = None,
    score_config: Any | None = None,
) -> Signal | None:
    """Check if a sports market has a live momentum signal.

    All four factors must align: price velocity, volume surge, flow imbalance,
    and implied probability within the entry band. Returns Signal or None.

    When ``score_context`` (a LiveScore) is provided:
      - Confirms signals (score agrees with momentum) → boost edge
      - Rejects false signals (score contradicts) → return None
      - Enables pre-emptive entries (score moved but price hasn't) → lower thresholds

    Args:
        ticker: Market ticker.
        market: Current NormalizedMarket snapshot.
        sport: Sport classification ("tennis", "soccer", "basketball").
        buy_volume_5m: Buy-side contracts in 5-min window.
        sell_volume_5m: Sell-side contracts in 5-min window.
        total_volume_5m: Total contracts in 5-min window.
        price_history: Ring buffer of (monotonic_ts, yes_mid_price).
        rolling_avg_volume: EMA of historical 5-min volume for this ticker.
        config: Optional MomentumConfig overrides.
    """
    cfg = config or MomentumConfig()

    if not cfg.enabled:
        return None

    # ── Gate: volume minimum ──
    min_vol = cfg.min_volume_5m
    if total_volume_5m < min_vol:
        return None

    if market.yes_ask <= 0 or market.no_ask <= 0:
        return None

    # ── 1. Price velocity ──
    if len(price_history) < _MIN_PRICE_OBS:
        return None

    now_mono = time.monotonic()
    newest_ts, newest_price = price_history[-1]
    # Find oldest entry within window
    oldest_ts, oldest_price = price_history[0]
    for ts, price in price_history:
        if now_mono - ts <= _WINDOW_SEC:
            oldest_ts, oldest_price = ts, price
            break

    elapsed_sec = newest_ts - oldest_ts
    if elapsed_sec < 30.0:  # Need at least 30s of history
        return None

    velocity = newest_price - oldest_price  # Positive = YES rising

    # Per-sport velocity threshold
    sport_params = _SPORT_PARAMS.get(sport, (_MIN_PRICE_VELOCITY, _VOLUME_SURGE_MULT))
    min_vel = sport_params[0]
    surge_mult = sport_params[1]
    # Override from config if set
    if sport == "tennis":
        min_vel = cfg.tennis_min_velocity
        surge_mult = cfg.tennis_surge_mult
    elif sport == "soccer":
        min_vel = cfg.soccer_min_velocity
        surge_mult = cfg.soccer_surge_mult
    elif sport == "basketball":
        min_vel = cfg.basketball_min_velocity
        surge_mult = cfg.basketball_surge_mult

    # ── Score-aware threshold adjustment ──
    # If live score confirms the direction, relax the velocity requirement
    # (score moved first, price is catching up → pre-emptive entry)
    score_confirms = False
    score_contradicts = False
    if score_context and hasattr(score_context, "status") and score_context.status == "in_progress":
        # Determine which side the score favors
        score_prob = score_context.home_win_probability
        if velocity > 0 and score_prob >= 0.65:
            score_confirms = True
        elif velocity < 0 and score_prob <= 0.35:
            score_confirms = True
        elif abs(score_prob - 0.50) < 0.10:
            # Score says match is close — contradicts strong momentum
            score_contradicts = True

    effective_min_vel = min_vel
    if score_confirms and score_config:
        discount = getattr(score_config, "score_velocity_discount", 0.50)
        effective_min_vel = min_vel * discount

    if abs(velocity) < effective_min_vel:
        return None

    # ── 2. Volume surge ──
    if rolling_avg_volume > 0:
        surge_ratio = total_volume_5m / rolling_avg_volume
        if surge_ratio < surge_mult:
            return None
    else:
        # No historical baseline yet — require higher absolute volume
        surge_ratio = 1.0
        if total_volume_5m < min_vol * 3:
            return None

    # ── 3. Flow imbalance (must agree with velocity direction) ──
    buy_ratio = buy_volume_5m / total_volume_5m
    sell_ratio = sell_volume_5m / total_volume_5m

    if velocity > 0 and buy_ratio >= cfg.flow_imbalance_threshold:
        side = "yes"
        imbalance = buy_ratio
    elif velocity < 0 and sell_ratio >= cfg.flow_imbalance_threshold:
        side = "no"
        imbalance = sell_ratio
    else:
        return None  # Velocity and flow disagree — noise

    # ── 4. Implied probability band ──
    entry_price = market.yes_ask if side == "yes" else market.no_ask
    implied_prob = entry_price  # Binary market: ask ≈ implied probability

    if implied_prob < cfg.min_implied_probability or implied_prob > cfg.max_entry_price:
        return None
    if implied_prob < cfg.min_entry_price:
        return None

    # ── Edge estimation (multi-factor composite) ──
    # Base: sports maker-taker gap from research
    base_edge = 0.0223
    # Velocity bonus: faster moves = larger dislocation
    momentum_edge = min(abs(velocity) * 0.50, 0.03)
    # Surge bonus: larger spike = more conviction
    surge_edge = min((surge_ratio - surge_mult) * 0.005, 0.02) if surge_ratio > surge_mult else 0.0
    # Flow bonus: stronger imbalance = more informed flow
    flow_edge = (imbalance - cfg.flow_imbalance_threshold) * 0.10

    total_edge = base_edge + momentum_edge + surge_edge + flow_edge

    # ── Score-based edge adjustment ──
    if score_contradicts:
        # Score says match is close but price is moving fast — likely noise
        logger.debug("Momentum rejected: score contradicts for %s", ticker)
        return None

    if score_confirms and score_config:
        boost = getattr(score_config, "score_confirm_boost", 1.5)
        total_edge *= boost
        logger.info("Score confirms momentum for %s — edge boosted %.0f%%", ticker, (boost - 1) * 100)

    edge_pct = max(0.5, min(total_edge * 100.0, 8.0))

    # ── Position sizing ──
    size = min(cfg.max_position_dollars, market.liquidity * 0.10)
    if size < 1.0:
        return None

    # ── Build signal ──
    leg = TradeLeg(
        ticker=ticker,
        side=side,
        price_dollars=entry_price,
        quantity_dollars=size,
        venue=market.venue,
    )

    # Normalize scores for scoring.py
    velocity_score = min(1.0, abs(velocity) / 0.20)
    surge_score = min(1.0, (surge_ratio - 1.0) / 5.0)

    signal = Signal(
        signal_type=SignalType.LIVE_MOMENTUM,
        ticker=ticker,
        event_ticker=market.event_ticker,
        yes_ask=market.yes_ask,
        no_ask=market.no_ask,
        combined_cost=entry_price,
        gross_edge=total_edge,
        net_edge=total_edge,
        edge_pct=round(edge_pct, 4),
        legs=(leg,),
        market_snapshot=market,
        implied_probability=implied_prob,
        entry_side=side,
        probability_floor=cfg.probability_floor,
        features_json={
            "velocity_score": round(velocity_score, 4),
            "surge_score": round(surge_score, 4),
            "sport": sport,
            "velocity": round(velocity, 4),
            "velocity_per_min": round(velocity / (elapsed_sec / 60.0), 4),
            "surge_ratio": round(surge_ratio, 2),
            "flow_imbalance": round(imbalance, 4),
            "total_volume_5m": total_volume_5m,
            "score_confirms": score_confirms,
            "score_available": score_context is not None,
            "score_home_prob": getattr(score_context, "home_win_probability", None),
        },
    )

    logger.info(
        "Live momentum: %s %s (%s) vel=%.3f surge=%.1fx flow=%.0f%% "
        "implied=%.0f%% edge=%.2f%% vol=%d",
        ticker, side, sport, velocity, surge_ratio, imbalance * 100,
        implied_prob * 100, edge_pct, total_volume_5m,
    )

    return signal


def update_rolling_volume(
    current_avg: float,
    new_volume: int,
    alpha: float = 0.05,
) -> float:
    """Update exponential moving average of 5-minute volume.

    Called once per 5-minute window rotation to maintain a volume baseline
    for surge detection. Alpha=0.05 gives ~20-sample half-life (~100 min).
    """
    if current_avg <= 0:
        return float(new_volume)
    return alpha * new_volume + (1.0 - alpha) * current_avg
