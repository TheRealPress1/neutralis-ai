"""Backtest engine — replays historical market snapshots through the pipeline."""

from __future__ import annotations

import time
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Any

from neutralis.backtest.portfolio import SimulatedPortfolio
from neutralis.config import (
    ExitConfig,
    MatchingConfig,
    PipelineConfig,
    PortfolioConfig,
    load_settings,
)
from neutralis.core.cross_scanner import scan_cross_platform
from neutralis.core.disagreement import compute_disagreement
from neutralis.core.features import compute_market_features, estimate_costs
from neutralis.core.matcher import match_markets
from neutralis.core.scanners import scan_complement_arb
from neutralis.core.scoring import score_signal
from neutralis.guard.decision import evaluate_signal, select_portfolio
from neutralis.guard.regime import apply_regime_to_pipeline, compute_regime
from neutralis.logging import get_logger
from neutralis.models import (
    DecisionVerdict,
    MarketType,
    NormalizedMarket,
    Signal,
    TradeSide,
)
from neutralis.storage.postgres import PostgresStorage

logger = get_logger(__name__)


@dataclass
class EquityPoint:
    """Single point on the equity curve."""
    ts: str
    realized_pnl: float
    open_positions: int
    total_exposure: float


@dataclass
class BacktestResult:
    """Complete backtest output."""
    start_date: str
    end_date: str
    time_steps: int
    duration_ms: float

    total_pnl: float = 0.0
    total_trades: int = 0
    total_signals: int = 0
    total_passed: int = 0
    total_rejected: int = 0
    positions_opened: int = 0
    positions_closed: int = 0
    win_count: int = 0
    loss_count: int = 0
    best_trade: float = 0.0
    worst_trade: float = 0.0
    max_drawdown: float = 0.0
    avg_trade_pnl: float = 0.0
    win_rate: float = 0.0

    equity_curve: list[dict] = field(default_factory=list)
    trades: list[dict] = field(default_factory=list)
    closed_positions: list[dict] = field(default_factory=list)
    by_category: dict[str, dict] = field(default_factory=dict)
    by_venue: dict[str, dict] = field(default_factory=dict)
    by_signal_type: dict[str, dict] = field(default_factory=dict)
    config_snapshot: dict = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON response."""
        return {
            "start_date": self.start_date,
            "end_date": self.end_date,
            "time_steps": self.time_steps,
            "duration_ms": round(self.duration_ms, 1),
            "total_pnl": round(self.total_pnl, 4),
            "total_trades": self.total_trades,
            "total_signals": self.total_signals,
            "total_passed": self.total_passed,
            "total_rejected": self.total_rejected,
            "positions_opened": self.positions_opened,
            "positions_closed": self.positions_closed,
            "win_count": self.win_count,
            "loss_count": self.loss_count,
            "best_trade": round(self.best_trade, 4),
            "worst_trade": round(self.worst_trade, 4),
            "max_drawdown": round(self.max_drawdown, 4),
            "avg_trade_pnl": round(self.avg_trade_pnl, 4),
            "win_rate": round(self.win_rate, 4),
            "equity_curve": self.equity_curve,
            "trades": self.trades,
            "closed_positions": self.closed_positions,
            "by_category": self.by_category,
            "by_venue": self.by_venue,
            "by_signal_type": self.by_signal_type,
            "config_snapshot": self.config_snapshot,
        }


def _apply_overrides(base: object, overrides: dict[str, Any] | None) -> Any:
    """Create a new frozen dataclass instance with overrides applied."""
    if not overrides:
        return base
    from dataclasses import fields, asdict
    current = asdict(base)
    valid_keys = {f.name for f in fields(base)}
    for k, v in overrides.items():
        if k in valid_keys:
            current[k] = v
    return type(base)(**current)


def _try_settle(
    portfolio: SimulatedPortfolio,
    markets: list[NormalizedMarket],
    settled_tickers: set[str],
    ts: object,
) -> float:
    """Check if any open positions' markets have resolved. Returns P&L from settlements."""
    total_pnl = 0.0
    # Build a lookup of resolved markets
    resolved: dict[str, str] = {}  # ticker -> "yes" or "no"
    for m in markets:
        if m.status.value in ("determined", "finalized", "closed"):
            if m.ticker in settled_tickers:
                continue
            # Infer outcome from terminal price
            if m.yes_ask >= 0.90:
                resolved[m.ticker] = "yes"
            elif m.yes_ask <= 0.10:
                resolved[m.ticker] = "no"

    for ticker, outcome in resolved.items():
        pnl = portfolio.settle_position(ticker, outcome, ts)
        if pnl != 0:
            total_pnl += pnl
            settled_tickers.add(ticker)

    return total_pnl


def _try_exits(
    portfolio: SimulatedPortfolio,
    markets: list[NormalizedMarket],
    exit_cfg: ExitConfig,
    ts: object,
    hwm: dict[str, float] | None = None,
) -> tuple[int, float]:
    """Evaluate stop-loss, take-profit, trailing stop, and dynamic TP exits.

    Args:
        hwm: High-water mark dict (position key -> best pnl_pct seen). Mutated in place.

    Returns (exit_count, total_pnl).
    """
    if not exit_cfg.enabled:
        return 0, 0.0

    if hwm is None:
        hwm = {}

    # Build bid-price lookup and expiry lookup from current market snapshots
    bid_prices: dict[str, float] = {}
    market_expiry: dict[str, datetime | None] = {}
    for m in markets:
        bid_prices[m.ticker] = m.yes_bid if m.yes_bid > 0 else m.yes_ask
        market_expiry[m.ticker] = m.expected_expiration or m.close_time

    exit_count = 0
    total_pnl = 0.0

    # Iterate over a snapshot of positions (dict may change during iteration)
    positions = list(portfolio._positions.items())
    for key, pos in positions:
        current_bid = bid_prices.get(pos.ticker)
        if current_bid is None or current_bid <= 0.01:
            continue

        # Use the bid for the side we hold
        if pos.side == TradeSide.BUY_NO:
            current_bid = 1.0 - current_bid  # no_bid ≈ 1 - yes_bid

        exit_value = current_bid * pos.quantity
        pnl_dollars = exit_value - pos.size_dollars
        pnl_pct = (pnl_dollars / pos.size_dollars * 100) if pos.size_dollars > 0 else 0.0

        # Update high-water mark
        prev_hwm = hwm.get(key, 0.0)
        if pnl_pct > prev_hwm:
            hwm[key] = pnl_pct
            prev_hwm = pnl_pct

        # Dynamic take-profit: tighten TP near expiry
        effective_tp = exit_cfg.take_profit_pct
        expiry = market_expiry.get(pos.ticker)
        if expiry is not None:
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            now_ts = ts if isinstance(ts, datetime) else datetime.now(timezone.utc)
            if isinstance(now_ts, datetime) and now_ts.tzinfo is None:
                now_ts = now_ts.replace(tzinfo=timezone.utc)
            hours_left = (expiry - now_ts).total_seconds() / 3600.0
            if hours_left <= 0:
                effective_tp = exit_cfg.dynamic_tp_floor_pct
            elif hours_left < exit_cfg.dynamic_tp_hours:
                ratio = hours_left / exit_cfg.dynamic_tp_hours
                effective_tp = exit_cfg.dynamic_tp_floor_pct + (
                    exit_cfg.take_profit_pct - exit_cfg.dynamic_tp_floor_pct
                ) * ratio

        exit_reason = None
        if pnl_pct <= -exit_cfg.stop_loss_pct:
            exit_reason = "stop_loss"
        elif pnl_pct >= effective_tp:
            exit_reason = "take_profit"
        # Trailing stop: only activates after position hit +activation_pct
        elif (
            prev_hwm >= exit_cfg.trailing_stop_activation_pct
            and (prev_hwm - pnl_pct) >= exit_cfg.trailing_stop_pct
        ):
            exit_reason = "trailing_stop"

        if exit_reason is not None:
            pnl = portfolio.exit_position(pos.ticker, current_bid, ts)
            total_pnl += pnl
            exit_count += 1
            # Clean up HWM for closed position
            hwm.pop(key, None)

    return exit_count, total_pnl


def run_backtest(
    start_date: str,
    end_date: str,
    pipeline_overrides: dict[str, Any] | None = None,
    portfolio_overrides: dict[str, Any] | None = None,
    matching_overrides: dict[str, Any] | None = None,
    exit_overrides: dict[str, Any] | None = None,
    scoring_weights: dict[str, float] | None = None,
) -> BacktestResult:
    """Run a backtest over historical data.

    Args:
        start_date: ISO date string (e.g. "2026-01-01")
        end_date: ISO date string (e.g. "2026-02-10")
        pipeline_overrides: Override PipelineConfig fields
        portfolio_overrides: Override PortfolioConfig fields
        matching_overrides: Override MatchingConfig fields
        exit_overrides: Override ExitConfig fields
        scoring_weights: Custom scoring weights for optimizer

    Returns:
        BacktestResult with metrics, equity curve, and trade log.
    """
    clock_start = time.monotonic()

    base = load_settings()
    pipeline_cfg = _apply_overrides(base.pipeline, pipeline_overrides)
    portfolio_cfg = _apply_overrides(base.portfolio, portfolio_overrides)
    matching_cfg = _apply_overrides(base.matching, matching_overrides)
    exit_cfg = _apply_overrides(base.exits, exit_overrides)

    logger.info(
        "Backtest: %s to %s | min_edge=%.1f%% max_pos=$%.0f",
        start_date, end_date,
        pipeline_cfg.min_edge_pct, pipeline_cfg.max_position_dollars,
    )

    portfolio = SimulatedPortfolio()
    settled_tickers: set[str] = set()
    hwm: dict[tuple, float] = {}  # trailing stop high-water marks
    equity_curve: list[dict] = []
    time_steps = 0
    total_signals = 0
    pass_count = 0
    reject_count = 0
    last_date = ""

    with PostgresStorage(base.db) as storage:
        timestamps = storage.get_snapshot_timestamps(start_date, end_date)
        logger.info("Found %d pipeline-run timestamps", len(timestamps))

        for ts_row in timestamps:
            ts = ts_row["ts"]
            time_steps += 1

            all_markets = storage.get_snapshots_at(ts)

            kalshi_markets = [
                m for m in all_markets
                if m.venue == "kalshi" and m.market_type == MarketType.BINARY
            ]
            poly_markets = [
                m for m in all_markets
                if m.venue == "polymarket" and m.market_type == MarketType.BINARY
            ]

            # Settlement check
            _try_settle(portfolio, all_markets, settled_tickers, ts)

            # Exit strategy check (trailing stop + dynamic TP)
            _try_exits(portfolio, all_markets, exit_cfg, ts, hwm=hwm)

            # Complement arb scan (Kalshi)
            complement_signals = scan_complement_arb(kalshi_markets, pipeline_cfg)

            # Cross-platform matching + scanning
            pairs = match_markets(kalshi_markets, poly_markets, matching_cfg)
            xp_signals = scan_cross_platform(pairs, matching_cfg, pipeline_config=pipeline_cfg)

            # Compute regime for this time step
            di_overall = 0.0
            if pairs:
                di_overall, _, _ = compute_disagreement(pairs)
            _, _, regime_params = compute_regime(all_markets, disagreement=di_overall)
            step_pipeline_cfg = apply_regime_to_pipeline(pipeline_cfg, regime_params)
            min_confidence = regime_params.get("min_confidence", 0)

            # Score all signals
            scored_pairs: list[tuple[Signal, NormalizedMarket]] = []
            for signal in complement_signals:
                market = signal.market_snapshot
                if market is None:
                    continue
                recent = storage.get_recent_snapshots_for_ticker(market.ticker, limit=10)
                features = compute_market_features(market, recent_snapshots=recent)
                costs = estimate_costs(signal, market)
                result = score_signal(signal, features, costs, weights=scoring_weights)
                scored = replace(
                    signal,
                    confidence_score=result["confidence_score"],
                    time_to_resolution_days=result["time_to_resolution_days"],
                    roi_per_day=result["roi_per_day"],
                    net_edge=result["net_edge"],
                    features_json=result,
                )
                scored_pairs.append((scored, market))

            for signal in xp_signals:
                market = signal.market_snapshot
                if market is None:
                    continue
                xp = signal.cross_platform
                match_conf = xp.match_confidence if xp else None
                recent = storage.get_recent_snapshots_for_ticker(market.ticker, limit=10)
                features = compute_market_features(market, recent_snapshots=recent)
                costs = estimate_costs(signal, market)
                result = score_signal(signal, features, costs, match_score=match_conf, weights=scoring_weights)
                scored = replace(
                    signal,
                    confidence_score=result["confidence_score"],
                    time_to_resolution_days=result["time_to_resolution_days"],
                    roi_per_day=result["roi_per_day"],
                    net_edge=result["net_edge"],
                    features_json=result,
                )
                scored_pairs.append((scored, market))

            total_signals += len(scored_pairs)

            # Guard evaluation (provisional)
            snapshot = portfolio.get_snapshot()
            provisional = []

            for scored_signal, market in scored_pairs:
                decision = evaluate_signal(
                    scored_signal, market, step_pipeline_cfg,
                    portfolio_snapshot=snapshot,
                    portfolio_config=portfolio_cfg,
                )
                provisional.append((scored_signal, decision))

            # Ranked selection
            ranked = select_portfolio(
                provisional, snapshot,
                portfolio_config=portfolio_cfg,
                min_confidence=min_confidence,
            )

            for signal, decision in ranked:
                if decision.verdict == DecisionVerdict.PASS and decision.selected:
                    pass_count += 1
                    portfolio.record_fill(signal, decision, ts)
                    snapshot = portfolio.get_snapshot()
                elif decision.verdict == DecisionVerdict.REJECT:
                    reject_count += 1

            # Record equity curve (one point per day)
            ts_str = str(ts)
            ts_date = ts_str[:10]
            if ts_date != last_date:
                snap = portfolio.get_snapshot()
                equity_curve.append({
                    "ts": ts_str,
                    "realized_pnl": round(snap.total_realized_pnl, 4),
                    "open_positions": snap.open_position_count,
                    "total_exposure": round(snap.total_exposure_dollars, 2),
                })
                last_date = ts_date

            if time_steps % 50 == 0:
                logger.info(
                    "Backtest step %d/%d | signals=%d trades=%d pnl=$%.2f",
                    time_steps, len(timestamps), total_signals,
                    len(portfolio.trades), portfolio.total_realized_pnl,
                )

    elapsed = (time.monotonic() - clock_start) * 1000

    # Build result
    return _build_result(
        start_date=start_date,
        end_date=end_date,
        time_steps=time_steps,
        duration_ms=elapsed,
        portfolio=portfolio,
        equity_curve=equity_curve,
        total_signals=total_signals,
        pass_count=pass_count,
        reject_count=reject_count,
        pipeline_cfg=pipeline_cfg,
        portfolio_cfg=portfolio_cfg,
        matching_cfg=matching_cfg,
        exit_cfg=exit_cfg,
        scoring_weights=scoring_weights,
    )


def _build_result(
    start_date: str,
    end_date: str,
    time_steps: int,
    duration_ms: float,
    portfolio: SimulatedPortfolio,
    equity_curve: list[dict],
    total_signals: int,
    pass_count: int,
    reject_count: int,
    pipeline_cfg: PipelineConfig,
    portfolio_cfg: PortfolioConfig,
    matching_cfg: MatchingConfig,
    exit_cfg: ExitConfig | None = None,
    scoring_weights: dict[str, float] | None = None,
) -> BacktestResult:
    """Compute final metrics from simulated portfolio state."""
    from dataclasses import asdict

    closed = portfolio.closed_positions
    trades = portfolio.trades

    # Win/loss
    wins = [c for c in closed if c.realized_pnl > 0]
    losses = [c for c in closed if c.realized_pnl <= 0]

    total_pnl = portfolio.total_realized_pnl
    best_trade = max((c.realized_pnl for c in closed), default=0.0)
    worst_trade = min((c.realized_pnl for c in closed), default=0.0)
    avg_pnl = total_pnl / len(closed) if closed else 0.0
    win_rate = len(wins) / len(closed) if closed else 0.0

    # Max drawdown from equity curve
    max_dd = 0.0
    peak = 0.0
    for pt in equity_curve:
        pnl = pt["realized_pnl"]
        if pnl > peak:
            peak = pnl
        dd = peak - pnl
        if dd > max_dd:
            max_dd = dd

    # Category breakdown
    by_category: dict[str, dict] = {}
    for c in closed:
        cat = c.category
        if cat not in by_category:
            by_category[cat] = {"trades": 0, "pnl": 0.0, "wins": 0, "losses": 0}
        by_category[cat]["trades"] += 1
        by_category[cat]["pnl"] = round(by_category[cat]["pnl"] + c.realized_pnl, 4)
        if c.realized_pnl > 0:
            by_category[cat]["wins"] += 1
        else:
            by_category[cat]["losses"] += 1

    # Venue breakdown
    by_venue: dict[str, dict] = {}
    for c in closed:
        v = c.venue
        if v not in by_venue:
            by_venue[v] = {"trades": 0, "pnl": 0.0, "wins": 0, "losses": 0}
        by_venue[v]["trades"] += 1
        by_venue[v]["pnl"] = round(by_venue[v]["pnl"] + c.realized_pnl, 4)
        if c.realized_pnl > 0:
            by_venue[v]["wins"] += 1
        else:
            by_venue[v]["losses"] += 1

    # Signal type breakdown
    by_signal_type: dict[str, dict] = {}
    for t in trades:
        st = t.signal_type
        if st not in by_signal_type:
            by_signal_type[st] = {"trades": 0, "total_edge_pct": 0.0}
        by_signal_type[st]["trades"] += 1
        by_signal_type[st]["total_edge_pct"] += t.edge_pct

    # Serialize trades
    trade_dicts = [
        {
            "ts": str(t.ts),
            "ticker": t.ticker,
            "venue": t.venue,
            "side": t.side,
            "price": t.price,
            "size_dollars": t.size_dollars,
            "signal_type": t.signal_type,
            "edge_pct": round(t.edge_pct, 4),
        }
        for t in trades
    ]

    closed_dicts = [
        {
            "ticker": c.ticker,
            "venue": c.venue,
            "side": c.side,
            "entry_price": c.entry_price,
            "size_dollars": c.size_dollars,
            "realized_pnl": round(c.realized_pnl, 4),
            "opened_at": str(c.opened_at),
            "closed_at": str(c.closed_at),
            "category": c.category,
        }
        for c in closed
    ]

    config_snapshot = {
        "pipeline": asdict(pipeline_cfg),
        "portfolio": asdict(portfolio_cfg),
        "matching": asdict(matching_cfg),
        "exits": asdict(exit_cfg) if exit_cfg else {},
    }
    if scoring_weights:
        config_snapshot["scoring_weights"] = scoring_weights

    return BacktestResult(
        start_date=start_date,
        end_date=end_date,
        time_steps=time_steps,
        duration_ms=duration_ms,
        total_pnl=total_pnl,
        total_trades=len(trades),
        total_signals=total_signals,
        total_passed=pass_count,
        total_rejected=reject_count,
        positions_opened=len(trades),
        positions_closed=len(closed),
        win_count=len(wins),
        loss_count=len(losses),
        best_trade=best_trade,
        worst_trade=worst_trade,
        max_drawdown=max_dd,
        avg_trade_pnl=avg_pnl,
        win_rate=win_rate,
        equity_curve=equity_curve,
        trades=trade_dicts,
        closed_positions=closed_dicts,
        by_category=by_category,
        by_venue=by_venue,
        by_signal_type=by_signal_type,
        config_snapshot=config_snapshot,
    )
