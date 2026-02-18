"""Paper executor -- creates orders, simulates fills, records trades."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime

from neutralis.execution.fill_simulator import simulate_fill
from neutralis.execution.models import (
    ExecutionResult,
    Fill,
    Order,
    OrderStatus,
    SlippageConfig,
    TickContext,
    VENUE_SLIPPAGE,
)
from neutralis.logging import get_logger
from neutralis.models import Decision, NormalizedMarket, Signal, Trade, TradeSide
from neutralis.portfolio.manager import PortfolioManager
from neutralis.storage.postgres import PostgresStorage

logger = get_logger(__name__)


class PaperExecutor:
    """Creates orders, simulates fills, and delegates position accounting to PortfolioManager."""

    def __init__(
        self,
        storage: PostgresStorage,
        portfolio: PortfolioManager,
        slippage_config: SlippageConfig | None = None,
    ) -> None:
        self._storage = storage
        self._portfolio = portfolio
        self._slippage_config = slippage_config

    def execute(
        self,
        signal: Signal,
        decision: Decision,
        decision_id: int,
        tick_ctx: TickContext,
        market: NormalizedMarket | None = None,
    ) -> ExecutionResult:
        """Execute a paper order for each leg of the signal.

        For each leg:
        1. Create Order (idempotent via DB unique index)
        2. simulate_fill -> fills
        3. For each fill: create legacy Trade, upsert position
        4. Update order status
        """
        orders: list[Order] = []
        fills: list[Fill] = []
        trades: list[Trade] = []
        total_slippage = 0.0
        total_fees = 0.0
        fully_filled = True

        venue = "kalshi"
        if signal.market_snapshot is not None:
            venue = signal.market_snapshot.venue

        for leg in signal.legs:
            side_str = "buy_yes" if leg.side == "yes" else "buy_no"
            leg_venue = leg.venue or venue

            # Proportional sizing across legs
            if signal.combined_cost > 0:
                leg_fraction = leg.price_dollars / signal.combined_cost
            else:
                leg_fraction = 1.0 / max(len(signal.legs), 1)
            leg_size = round(decision.suggested_size_dollars * leg_fraction, 2)

            if leg_size <= 0:
                continue

            quantity = leg_size / leg.price_dollars if leg.price_dollars > 0 else 0.0

            slippage_cfg = self._slippage_config or VENUE_SLIPPAGE.get(
                leg_venue, VENUE_SLIPPAGE["kalshi"],
            )

            order = Order(
                tick_id=tick_ctx.tick_id,
                signal_id=signal.id,
                decision_id=decision_id,
                ticker=leg.ticker,
                event_ticker=signal.event_ticker,
                venue=leg_venue,
                side=side_str,
                requested_price=leg.price_dollars,
                requested_size_dollars=leg_size,
                requested_quantity=round(quantity, 4),
            )

            # Idempotent insert
            saved_id = self._storage.save_order(order)
            if not saved_id:
                # Already exists for this tick -- skip
                logger.debug(
                    "Order skipped (idempotent): tick=%s decision=%d ticker=%s side=%s",
                    tick_ctx.tick_id, decision_id, leg.ticker, side_str,
                )
                continue

            orders.append(order)

            # Simulate fills
            leg_fills = simulate_fill(order, market, slippage_cfg)

            if not leg_fills:
                # No fill possible -- cancel
                self._storage.update_order_status(
                    order.id,
                    status=OrderStatus.CANCELLED.value,
                    expired_at=datetime.now(),
                )
                fully_filled = False
                continue

            fill = leg_fills[0]
            self._storage.save_fill(fill)
            fills.append(fill)

            # Create legacy Trade for backward compat
            side = TradeSide.BUY_YES if side_str == "buy_yes" else TradeSide.BUY_NO
            trade = Trade(
                signal_id=signal.id,
                decision_id=decision_id,
                ticker=leg.ticker,
                event_ticker=signal.event_ticker,
                venue=leg_venue,
                side=side,
                price=fill.price,
                size_dollars=fill.size_dollars,
                quantity=fill.quantity,
                is_paper=True,
            )
            self._storage.save_trade(trade)
            self._storage.update_fill_trade_id(fill.id, trade.id)
            trades.append(trade)

            # Upsert position (same VWAP logic as PortfolioManager)
            self._portfolio._upsert_position(trade, signal_type=signal.signal_type.value)

            # Determine order status
            is_full = abs(fill.size_dollars - order.requested_size_dollars) < 0.01
            status = OrderStatus.FILLED if is_full else OrderStatus.PARTIAL
            if not is_full:
                fully_filled = False

            self._storage.update_order_status(
                order.id,
                status=status.value,
                filled_size_dollars=fill.size_dollars,
                filled_quantity=fill.quantity,
                fill_count=1,
                avg_fill_price=fill.price,
                slippage_bps=fill.slippage_bps,
                fees_dollars=fill.fee_dollars,
                expired_at=datetime.now() if status == OrderStatus.PARTIAL else None,
            )

            total_slippage += fill.slippage_bps
            total_fees += fill.fee_dollars

            logger.info(
                "Fill: %s %s %s $%.2f @ %.4f (slip=%.1fbps fee=$%.4f)",
                leg_venue, side_str, leg.ticker,
                fill.size_dollars, fill.price,
                fill.slippage_bps, fill.fee_dollars,
            )

        avg_slippage = total_slippage / len(fills) if fills else 0.0

        return ExecutionResult(
            orders=tuple(orders),
            fills=tuple(fills),
            trades=tuple(trades),
            total_slippage_bps=round(avg_slippage, 2),
            total_fees_dollars=round(total_fees, 4),
            fully_filled=fully_filled,
        )
