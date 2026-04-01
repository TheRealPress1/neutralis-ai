"""Portfolio state manager -- records trades, tracks positions, builds snapshots."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from neutralis.categories import classify_market
from neutralis.config import DirectionalConfig, ExitConfig, PortfolioConfig, Settings
from neutralis.logging import get_logger
from neutralis.models import (
    Decision,
    DecisionVerdict,
    Position,
    PositionStatus,
    PortfolioSnapshot,
    Signal,
    SignalType,
    Trade,
    TradeSide,
)
from neutralis.storage.postgres import PostgresStorage

logger = get_logger(__name__)


class PortfolioManager:
    """Manages portfolio state through PostgresStorage.

    Core operations:
    - record_fill: Create trades + update positions from a PASS decision
    - get_snapshot: Build a PortfolioSnapshot for Guard queries
    - close_position: Mark a position as closed with realized P&L
    """

    def __init__(
        self,
        storage: PostgresStorage,
        config: PortfolioConfig | None = None,
        fee_accruer: object | None = None,
    ) -> None:
        self._storage = storage
        self._config = config or PortfolioConfig()
        self._fee_accruer = fee_accruer  # PerformanceFeeAccruer (optional)
        # Trailing stop high-water marks: position_id -> highest P&L %
        # Loaded from DB on init so trailing stops survive restarts
        self._hwm: dict[str, float] = {}
        self._load_hwm()

    def record_fill(
        self,
        signal: Signal,
        decision: Decision,
        decision_id: int,
        *,
        is_paper: bool = True,
        execution_results: list[dict] | None = None,
    ) -> list[Trade]:
        """Record trades from a PASS decision and update positions.

        For each leg in the signal, create a Trade and upsert the Position.
        When execution_results is provided, uses actual fill data from the exchange.
        Returns the list of created Trade objects.
        """
        if decision.verdict != DecisionVerdict.PASS:
            return []

        trades: list[Trade] = []
        venue = "kalshi"
        if signal.market_snapshot is not None:
            venue = signal.market_snapshot.venue

        for i, leg in enumerate(signal.legs):
            side = TradeSide.BUY_YES if leg.side == "yes" else TradeSide.BUY_NO
            leg_venue = leg.venue or venue  # per-leg venue if set, else signal-level

            # Distribute suggested size proportionally across legs
            if signal.combined_cost > 0:
                leg_fraction = leg.price_dollars / signal.combined_cost
            else:
                leg_fraction = 1.0 / max(len(signal.legs), 1)
            leg_size = round(decision.suggested_size_dollars * leg_fraction, 2)

            if leg_size <= 0:
                continue

            quantity = leg_size / leg.price_dollars if leg.price_dollars > 0 else 0.0

            # Use actual execution data if available.
            # Match by ticker (not position) to avoid venue-ordering mismatches
            # when xp_results is [poly_result, kalshi_result] but signal.legs
            # is [kalshi_leg, poly_leg].
            order_id = None
            fill_price = None
            ex = None
            if execution_results:
                ex = next(
                    (er for er in execution_results if er.get("ticker") == leg.ticker),
                    None,
                )
                if ex is None and i < len(execution_results):
                    ex = execution_results[i]  # fallback to positional
            if ex is not None:
                order_id = ex.get("order_id")
                # Kalshi returns prices in cents; convert to dollars
                if leg.side == "yes" and ex.get("yes_price"):
                    fill_price = ex["yes_price"] / 100.0
                elif leg.side == "no" and ex.get("no_price"):
                    fill_price = ex["no_price"] / 100.0
                # Use actual fill count if available
                actual_count = ex.get("fill_count")
                if actual_count and actual_count > 0:
                    quantity = float(actual_count)
                    if fill_price and fill_price > 0:
                        leg_size = round(quantity * fill_price, 2)

            trade = Trade(
                signal_id=signal.id,
                decision_id=decision_id,
                ticker=leg.ticker,
                event_ticker=signal.event_ticker,
                venue=leg_venue,
                side=side,
                price=fill_price or leg.price_dollars,
                size_dollars=leg_size,
                quantity=round(quantity, 4),
                is_paper=is_paper,
                order_id=order_id,
                fill_price=fill_price,
            )

            self._storage.save_trade(trade)
            self._upsert_position(trade)
            trades.append(trade)

            mode = "PAPER" if is_paper else "LIVE"
            logger.info(
                "%s Trade: %s %s %s $%.2f @ %.4f (%d contracts)%s",
                mode, trade.venue, trade.side.value, trade.ticker,
                trade.size_dollars, trade.price, trade.quantity,
                f" order_id={order_id}" if order_id else "",
            )

        return trades

    def _upsert_position(
        self, trade: Trade, signal_type: str = "",
    ) -> Position:
        """Create or update an open position for this trade's ticker/venue/side."""
        existing = self._storage.get_open_position(
            ticker=trade.ticker, venue=trade.venue, side=trade.side,
        )

        if existing is None:
            category = classify_market(trade.ticker, trade.event_ticker)
            position = Position(
                ticker=trade.ticker,
                event_ticker=trade.event_ticker,
                venue=trade.venue,
                side=trade.side,
                status=PositionStatus.OPEN,
                entry_price=trade.price,
                size_dollars=trade.size_dollars,
                quantity=trade.quantity,
                trade_count=1,
                category=category,
                signal_type=signal_type,
            )
            self._storage.save_position(position)
            return position

        # Add to existing -- compute new VWAP and totals
        new_quantity = existing.quantity + trade.quantity
        new_size = existing.size_dollars + trade.size_dollars
        if new_quantity > 0:
            new_vwap = (
                existing.entry_price * existing.quantity
                + trade.price * trade.quantity
            ) / new_quantity
        else:
            new_vwap = existing.entry_price

        self._storage.update_position(
            position_id=existing.id,
            entry_price=round(new_vwap, 6),
            size_dollars=round(new_size, 2),
            quantity=round(new_quantity, 4),
            trade_count=existing.trade_count + 1,
        )
        return Position(
            id=existing.id,
            ticker=existing.ticker,
            event_ticker=existing.event_ticker,
            venue=existing.venue,
            side=existing.side,
            status=PositionStatus.OPEN,
            entry_price=round(new_vwap, 6),
            size_dollars=round(new_size, 2),
            quantity=round(new_quantity, 4),
            trade_count=existing.trade_count + 1,
            opened_at=existing.opened_at,
        )

    def close_position(
        self,
        position_id: str,
        settlement_price: float,
        exit_reason: str = "settlement",
    ) -> Position:
        """Close a position at a settlement price and calculate realized P&L.

        settlement_price: 1.0 if the position's side won, 0.0 if it lost.
        For exit strategies, pass the current bid price as settlement_price.
        """
        position = self._storage.get_position(position_id)
        if position is None:
            raise ValueError(f"Position {position_id} not found")
        if position.status == PositionStatus.CLOSED:
            raise ValueError(f"Position {position_id} already closed")

        settlement_value = position.quantity * settlement_price
        realized_pnl = settlement_value - position.size_dollars

        now = datetime.now(timezone.utc)
        exit_price = settlement_price if exit_reason != "settlement" else None
        self._storage.close_position(
            position_id=position_id,
            realized_pnl=round(realized_pnl, 4),
            closed_at=now,
            exit_reason=exit_reason,
            exit_price=exit_price,
        )

        # Accrue performance fee (non-blocking — failure never prevents closure)
        if self._fee_accruer is not None:
            try:
                self._fee_accruer.accrue_on_close(
                    position_id=position_id,
                    realized_pnl=round(realized_pnl, 4),
                )
            except Exception:
                logger.warning(
                    "Failed to accrue performance fee for position %s",
                    position_id,
                    exc_info=True,
                )

        logger.info(
            "Position closed: %s %s %s | reason=%s P&L=$%.2f",
            position.ticker, position.side.value, position.venue,
            exit_reason, realized_pnl,
        )

        return Position(
            id=position.id,
            ticker=position.ticker,
            event_ticker=position.event_ticker,
            venue=position.venue,
            side=position.side,
            status=PositionStatus.CLOSED,
            entry_price=position.entry_price,
            size_dollars=position.size_dollars,
            quantity=position.quantity,
            realized_pnl=round(realized_pnl, 4),
            unrealized_pnl=0.0,
            trade_count=position.trade_count,
            opened_at=position.opened_at,
            closed_at=now,
            category=position.category,
            exit_reason=exit_reason,
            exit_price=exit_price,
        )

    def get_snapshot(self) -> PortfolioSnapshot:
        """Build an immutable snapshot of current portfolio state."""
        positions = self._storage.get_open_positions()

        total_exposure = 0.0
        total_realized = 0.0
        total_unrealized = 0.0
        venue_map: dict[str, float] = defaultdict(float)
        event_map: dict[str, float] = defaultdict(float)

        for p in positions:
            total_exposure += p.size_dollars
            total_realized += p.realized_pnl
            total_unrealized += p.unrealized_pnl
            venue_map[p.venue] += p.size_dollars
            event_map[p.event_ticker] += p.size_dollars

        return PortfolioSnapshot(
            positions=tuple(positions),
            total_exposure_dollars=round(total_exposure, 2),
            total_realized_pnl=round(total_realized, 4),
            total_unrealized_pnl=round(total_unrealized, 4),
            open_position_count=len(positions),
            venue_exposure=tuple(sorted(venue_map.items(), key=lambda x: -x[1])),
            event_exposure=tuple(sorted(event_map.items(), key=lambda x: -x[1])),
        )

    def get_snapshot_filtered(self, signal_type: str) -> PortfolioSnapshot:
        """Build a snapshot filtered to positions of a specific signal type.

        Used for portfolio isolation — directional positions are evaluated
        against directional-only exposure limits.
        """
        positions = self._storage.get_open_positions_by_signal_type(signal_type)

        total_exposure = 0.0
        total_realized = 0.0
        total_unrealized = 0.0
        venue_map: dict[str, float] = defaultdict(float)
        event_map: dict[str, float] = defaultdict(float)

        for p in positions:
            total_exposure += p.size_dollars
            total_realized += p.realized_pnl
            total_unrealized += p.unrealized_pnl
            venue_map[p.venue] += p.size_dollars
            event_map[p.event_ticker] += p.size_dollars

        return PortfolioSnapshot(
            positions=tuple(positions),
            total_exposure_dollars=round(total_exposure, 2),
            total_realized_pnl=round(total_realized, 4),
            total_unrealized_pnl=round(total_unrealized, 4),
            open_position_count=len(positions),
            venue_exposure=tuple(sorted(venue_map.items(), key=lambda x: -x[1])),
            event_exposure=tuple(sorted(event_map.items(), key=lambda x: -x[1])),
        )

    def mark_to_market(self, settings: Settings) -> int:
        """Fetch live prices for open positions and compute unrealized P&L.

        Returns the number of positions marked.
        """
        from neutralis.venues.kalshi_client import KalshiClient
        from neutralis.venues.polymarket_client import PolymarketClient

        positions = self._storage.get_open_positions()
        if not positions:
            return 0

        kalshi_pos = [p for p in positions if p.venue == "kalshi"]
        poly_pos = [p for p in positions if p.venue == "polymarket"]
        poly_us_pos = [p for p in positions if p.venue == "polymarket_us"]
        marked = 0

        # Mark Kalshi positions
        if kalshi_pos:
            with KalshiClient(settings.kalshi) as client:
                for pos in kalshi_pos:
                    try:
                        raw = client.get_market(pos.ticker)
                    except Exception:
                        logger.warning("MTM: error fetching Kalshi %s, skipping", pos.ticker)
                        continue
                    if raw is None:
                        continue

                    if pos.side == TradeSide.BUY_YES:
                        price_str = raw.get("yes_bid_dollars")
                    else:
                        price_str = raw.get("no_bid_dollars")

                    if price_str is None:
                        continue
                    try:
                        current_price = float(price_str)
                    except (ValueError, TypeError):
                        continue

                    pnl = round(current_price * pos.quantity - pos.size_dollars, 4)
                    self._storage.update_unrealized_pnl(pos.id, pnl)
                    marked += 1
                    logger.debug(
                        "MTM: %s %s price=%.4f pnl=$%.2f",
                        pos.ticker, pos.side.value, current_price, pnl,
                    )

        # Mark Polymarket (international) positions
        if poly_pos:
            with PolymarketClient(settings.polymarket) as client:
                for pos in poly_pos:
                    try:
                        raw = client.get_market(pos.ticker)
                    except Exception:
                        logger.warning("MTM: error fetching Polymarket %s, skipping", pos.ticker)
                        continue
                    if raw is None:
                        continue

                    outcome_prices = raw.get("outcomePrices", [])
                    if not outcome_prices or len(outcome_prices) < 2:
                        continue

                    try:
                        if pos.side == TradeSide.BUY_YES:
                            current_price = float(outcome_prices[0])
                        else:
                            current_price = float(outcome_prices[1])
                    except (ValueError, TypeError):
                        continue

                    pnl = round(current_price * pos.quantity - pos.size_dollars, 4)
                    self._storage.update_unrealized_pnl(pos.id, pnl)
                    marked += 1
                    logger.debug(
                        "MTM: %s %s price=%.4f pnl=$%.2f",
                        pos.ticker, pos.side.value, current_price, pnl,
                    )

        # Mark Polymarket US positions
        if poly_us_pos:
            from neutralis.venues.polymarket_us_client import PolymarketUSClient
            try:
                with PolymarketUSClient(settings.polymarket_us) as us_client:
                    for pos in poly_us_pos:
                        try:
                            raw = us_client.get_market_by_slug(pos.market_slug or pos.ticker)
                        except Exception:
                            logger.warning("MTM: error fetching PolyUS %s, skipping", pos.ticker)
                            continue
                        if raw is None:
                            continue

                        best_bid = raw.get("bestBid")
                        best_ask = raw.get("bestAsk")
                        if best_bid is None or best_ask is None:
                            continue

                        try:
                            if pos.side == TradeSide.BUY_YES:
                                current_price = float(best_bid)
                            else:
                                current_price = 1.0 - float(best_ask)
                        except (ValueError, TypeError):
                            continue

                        pnl = round(current_price * pos.quantity - pos.size_dollars, 4)
                        self._storage.update_unrealized_pnl(pos.id, pnl)
                        marked += 1
                        logger.debug(
                            "MTM: %s %s price=%.4f pnl=$%.2f",
                            pos.ticker, pos.side.value, current_price, pnl,
                        )
            except Exception:
                logger.warning("MTM: failed to connect to Polymarket US, skipping %d positions", len(poly_us_pos))

        logger.info("Marked %d/%d open positions to market", marked, len(positions))
        return marked

    def get_event_exposure(self, event_ticker: str) -> float:
        """Return total dollar exposure to a specific event."""
        positions = self._storage.get_positions_by_event(event_ticker)
        return sum(p.size_dollars for p in positions)

    def get_ticker_exposure(self, ticker: str) -> float:
        """Return total dollar exposure to a specific ticker."""
        positions = self._storage.get_positions_by_ticker(ticker)
        return sum(p.size_dollars for p in positions)

    # -- Exit strategies --

    def evaluate_exits(
        self,
        settings: Settings,
        exit_config: ExitConfig | None = None,
        directional_config: DirectionalConfig | None = None,
    ) -> list[tuple[Position, str, float]]:
        """Evaluate exit conditions for all open positions.

        Runs AFTER mark_to_market so unrealized_pnl is fresh.
        Returns list of (position, exit_reason, exit_price).
        """
        from neutralis.venues.kalshi_client import KalshiClient
        from neutralis.venues.polymarket_client import PolymarketClient

        cfg = exit_config or ExitConfig()
        if not cfg.enabled:
            return []

        positions = self._storage.get_open_positions()
        if not positions:
            return []

        kalshi_pos = [p for p in positions if p.venue == "kalshi"]
        poly_pos = [p for p in positions if p.venue == "polymarket"]
        poly_us_pos = [p for p in positions if p.venue == "polymarket_us"]

        # Fetch current bid prices (conservative exit prices)
        bid_prices: dict[str, float] = {}

        if kalshi_pos:
            with KalshiClient(settings.kalshi) as client:
                for pos in kalshi_pos:
                    try:
                        raw = client.get_market(pos.ticker)
                        if raw is None:
                            continue
                        if pos.side == TradeSide.BUY_YES:
                            bid_str = raw.get("yes_bid_dollars")
                        else:
                            bid_str = raw.get("no_bid_dollars")
                        if bid_str is not None:
                            bid_prices[pos.id] = float(bid_str)
                    except Exception:
                        logger.warning("Exit: error fetching bid for %s", pos.ticker)

        if poly_pos:
            with PolymarketClient(settings.polymarket) as client:
                for pos in poly_pos:
                    try:
                        raw = client.get_market(pos.ticker)
                        if raw is None:
                            continue
                        outcome_prices = raw.get("outcomePrices", [])
                        if outcome_prices and len(outcome_prices) >= 2:
                            idx = 0 if pos.side == TradeSide.BUY_YES else 1
                            bid_prices[pos.id] = float(outcome_prices[idx])
                    except Exception:
                        logger.warning("Exit: error fetching bid for %s", pos.ticker)

        if poly_us_pos:
            from neutralis.venues.polymarket_us_client import PolymarketUSClient
            try:
                with PolymarketUSClient(settings.polymarket_us) as us_client:
                    for pos in poly_us_pos:
                        try:
                            raw = us_client.get_market_by_slug(pos.market_slug or pos.ticker)
                            if raw is None:
                                continue
                            best_bid = raw.get("bestBid")
                            best_ask = raw.get("bestAsk")
                            if best_bid is not None and best_ask is not None:
                                if pos.side == TradeSide.BUY_YES:
                                    bid_prices[pos.id] = float(best_bid)
                                else:
                                    bid_prices[pos.id] = 1.0 - float(best_ask)
                        except Exception:
                            logger.warning("Exit: error fetching bid for PolyUS %s", pos.ticker)
            except Exception:
                logger.warning("Exit: failed to connect to Polymarket US")

        exits: list[tuple[Position, str, float]] = []

        for pos in positions:
            current_bid = bid_prices.get(pos.id)
            if current_bid is None or current_bid <= 0.01:
                continue

            exit_value = current_bid * pos.quantity
            pnl_dollars = exit_value - pos.size_dollars
            pnl_pct = (pnl_dollars / pos.size_dollars * 100) if pos.size_dollars > 0 else 0.0

            exit_reason = None

            # 1. Stop loss (fixed)
            if pnl_pct <= -cfg.stop_loss_pct:
                exit_reason = "stop_loss"
            # 2. Take profit (dynamic — tightens near expiry)
            elif exit_reason is None:
                effective_tp = self._dynamic_take_profit(pos, cfg)
                if pnl_pct >= effective_tp:
                    exit_reason = "take_profit"
            # 3. Trailing stop (activates after position is up activation_pct)
            if exit_reason is None:
                exit_reason = self._check_trailing_stop(pos, pnl_pct, cfg)
            # 4. Time decay
            if exit_reason is None:
                exit_reason = self._check_time_decay(pos, current_bid, cfg)
            # 5. Probability floor (directional positions only)
            if exit_reason is None and pos.signal_type == SignalType.HIGH_PROBABILITY_DIRECTIONAL.value:
                dir_cfg = directional_config or DirectionalConfig()
                if current_bid <= dir_cfg.probability_floor:
                    exit_reason = "probability_floor"

            # 6. Momentum reversal (tighter trailing stop for live momentum)
            if exit_reason is None and pos.signal_type == SignalType.LIVE_MOMENTUM.value:
                prev_hwm = self._hwm.get(pos.id, 0.0)
                if prev_hwm >= 3.0:  # Activate after +3% profit (vs default +5%)
                    drawdown = prev_hwm - pnl_pct
                    if drawdown >= 7.0:  # 7% drawdown from peak (vs default ~10%)
                        exit_reason = "momentum_reversal"
                # Also check probability floor (looser than directional: 0.50)
                if exit_reason is None and current_bid <= 0.50:
                    exit_reason = "probability_floor"

            if exit_reason is not None:
                # Clean up HWM on exit
                self._hwm.pop(pos.id, None)
                exits.append((pos, exit_reason, current_bid))

        return exits

    def _check_time_decay(
        self,
        pos: Position,
        current_bid: float,
        cfg: ExitConfig,
    ) -> str | None:
        """Check if position should exit due to time decay."""
        from datetime import datetime as dt, timezone

        rows = self._storage._fetch_dicts(
            """SELECT expected_expiration, close_time
               FROM market_snapshots
               WHERE ticker = %(ticker)s
               ORDER BY snapshot_ts DESC LIMIT 1""",
            {"ticker": pos.ticker},
        )
        if not rows:
            return None

        expiry = rows[0].get("expected_expiration") or rows[0].get("close_time")
        if expiry is None:
            return None

        if isinstance(expiry, str):
            expiry = dt.fromisoformat(expiry)

        now = dt.now(timezone.utc)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)

        hours_to_expiry = (expiry - now).total_seconds() / 3600.0
        if hours_to_expiry > cfg.time_decay_hours:
            return None

        # Check if edge has narrowed below floor
        current_edge_pct = ((current_bid - pos.entry_price) / pos.entry_price * 100
                            if pos.entry_price > 0 else 0.0)
        if current_edge_pct < cfg.time_decay_edge_floor_pct:
            return "time_decay"

        return None

    def _load_hwm(self) -> None:
        """Load high-water marks from DB for all open positions."""
        try:
            positions = self._storage.get_open_positions()
            for pos in positions:
                if pos.hwm_pnl_pct > 0:
                    self._hwm[pos.id] = pos.hwm_pnl_pct
        except Exception:
            logger.warning("Failed to load HWM from DB, starting fresh", exc_info=True)

    def _check_trailing_stop(
        self,
        pos: Position,
        pnl_pct: float,
        cfg: ExitConfig,
    ) -> str | None:
        """Trailing stop: exit if price drops trailing_stop_pct from high-water mark.

        Only activates after position has reached +activation_pct to avoid
        triggering on normal noise around entry.
        """
        prev_hwm = self._hwm.get(pos.id, 0.0)

        # Update high-water mark and persist to DB
        if pnl_pct > prev_hwm:
            self._hwm[pos.id] = pnl_pct
            prev_hwm = pnl_pct
            try:
                self._storage.update_hwm_pnl_pct(pos.id, pnl_pct)
            except Exception:
                logger.warning("Failed to persist HWM for %s", pos.id)

        # Only activate trailing stop after position has been profitable enough
        if prev_hwm < cfg.trailing_stop_activation_pct:
            return None

        # Check if price dropped trailing_stop_pct from peak
        drawdown_from_peak = prev_hwm - pnl_pct
        if drawdown_from_peak >= cfg.trailing_stop_pct:
            logger.info(
                "Trailing stop: %s peak=+%.1f%% now=+%.1f%% drawdown=%.1f%%",
                pos.ticker, prev_hwm, pnl_pct, drawdown_from_peak,
            )
            return "trailing_stop"

        return None

    def _dynamic_take_profit(
        self,
        pos: Position,
        cfg: ExitConfig,
    ) -> float:
        """Compute dynamic take-profit threshold that tightens near expiry.

        Far from expiry: use cfg.take_profit_pct (e.g., 25%)
        Within dynamic_tp_hours: linear interpolation down to dynamic_tp_floor_pct (e.g., 8%)

        This captures gains earlier when time is running out rather than
        waiting for a large move that may never come.
        """
        from datetime import datetime as dt, timezone

        rows = self._storage._fetch_dicts(
            """SELECT expected_expiration, close_time
               FROM market_snapshots
               WHERE ticker = %(ticker)s
               ORDER BY snapshot_ts DESC LIMIT 1""",
            {"ticker": pos.ticker},
        )
        if not rows:
            return cfg.take_profit_pct

        expiry = rows[0].get("expected_expiration") or rows[0].get("close_time")
        if expiry is None:
            return cfg.take_profit_pct

        if isinstance(expiry, str):
            expiry = dt.fromisoformat(expiry)

        now = dt.now(timezone.utc)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)

        hours_left = (expiry - now).total_seconds() / 3600.0

        if hours_left >= cfg.dynamic_tp_hours:
            return cfg.take_profit_pct

        if hours_left <= 0:
            return cfg.dynamic_tp_floor_pct

        # Linear interpolation: full TP at dynamic_tp_hours, floor at 0
        ratio = hours_left / cfg.dynamic_tp_hours
        return cfg.dynamic_tp_floor_pct + (cfg.take_profit_pct - cfg.dynamic_tp_floor_pct) * ratio

    def execute_exit(
        self,
        position: Position,
        exit_reason: str,
        exit_price: float,
    ) -> Position:
        """Close a position at the given bid price with an exit reason."""
        return self.close_position(
            position_id=position.id,
            settlement_price=exit_price,
            exit_reason=exit_reason,
        )
