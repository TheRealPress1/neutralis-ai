"""In-memory simulated portfolio for backtesting — no DB writes."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import uuid4

from neutralis.categories import classify_market
from neutralis.models import (
    Decision,
    DecisionVerdict,
    Position,
    PositionStatus,
    PortfolioSnapshot,
    Signal,
    Trade,
    TradeSide,
)


@dataclass
class SimTrade:
    """Lightweight trade record for backtest results."""
    ts: datetime
    ticker: str
    event_ticker: str
    venue: str
    side: str
    price: float
    size_dollars: float
    quantity: float
    signal_type: str
    edge_pct: float


@dataclass
class SimClosedPosition:
    """A position that has been settled."""
    ticker: str
    event_ticker: str
    venue: str
    side: str
    entry_price: float
    size_dollars: float
    quantity: float
    realized_pnl: float
    opened_at: datetime
    closed_at: datetime
    category: str


class SimulatedPortfolio:
    """In-memory portfolio tracker that mirrors PortfolioManager without DB."""

    def __init__(self) -> None:
        # key: (ticker, venue, side_value) -> Position
        self._positions: dict[tuple[str, str, str], Position] = {}
        self._closed: list[SimClosedPosition] = []
        self._trades: list[SimTrade] = []
        self._total_realized_pnl: float = 0.0

    @property
    def trades(self) -> list[SimTrade]:
        return self._trades

    @property
    def closed_positions(self) -> list[SimClosedPosition]:
        return self._closed

    @property
    def total_realized_pnl(self) -> float:
        return self._total_realized_pnl

    def record_fill(
        self,
        signal: Signal,
        decision: Decision,
        ts: datetime,
    ) -> list[SimTrade]:
        """Record simulated trades from a PASS decision."""
        if decision.verdict != DecisionVerdict.PASS:
            return []

        trades: list[SimTrade] = []
        venue = "kalshi"
        if signal.market_snapshot is not None:
            venue = signal.market_snapshot.venue

        for leg in signal.legs:
            side = TradeSide.BUY_YES if leg.side == "yes" else TradeSide.BUY_NO
            leg_venue = leg.venue or venue

            if signal.combined_cost > 0:
                leg_fraction = leg.price_dollars / signal.combined_cost
            else:
                leg_fraction = 1.0 / max(len(signal.legs), 1)
            leg_size = round(decision.suggested_size_dollars * leg_fraction, 2)

            if leg_size <= 0:
                continue

            quantity = leg_size / leg.price_dollars if leg.price_dollars > 0 else 0.0

            trade = SimTrade(
                ts=ts,
                ticker=leg.ticker,
                event_ticker=signal.event_ticker,
                venue=leg_venue,
                side=side.value,
                price=leg.price_dollars,
                size_dollars=leg_size,
                quantity=round(quantity, 4),
                signal_type=signal.signal_type.value,
                edge_pct=signal.edge_pct,
            )
            self._trades.append(trade)
            self._upsert_position(trade, side, ts)
            trades.append(trade)

        return trades

    def _upsert_position(
        self, trade: SimTrade, side: TradeSide, ts: datetime,
    ) -> None:
        key = (trade.ticker, trade.venue, side.value)
        existing = self._positions.get(key)

        if existing is None:
            category = classify_market(trade.ticker, trade.event_ticker)
            self._positions[key] = Position(
                id=uuid4().hex[:12],
                ticker=trade.ticker,
                event_ticker=trade.event_ticker,
                venue=trade.venue,
                side=side,
                status=PositionStatus.OPEN,
                entry_price=trade.price,
                size_dollars=trade.size_dollars,
                quantity=trade.quantity,
                trade_count=1,
                opened_at=ts,
                category=category,
            )
            return

        new_quantity = existing.quantity + trade.quantity
        new_size = existing.size_dollars + trade.size_dollars
        if new_quantity > 0:
            new_vwap = (
                existing.entry_price * existing.quantity
                + trade.price * trade.quantity
            ) / new_quantity
        else:
            new_vwap = existing.entry_price

        self._positions[key] = Position(
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
            category=existing.category,
        )

    def settle_position(
        self,
        ticker: str,
        outcome: str,
        ts: datetime,
    ) -> float:
        """Settle all open positions for a ticker. Returns total realized P&L."""
        total_pnl = 0.0
        to_remove: list[tuple[str, str, str]] = []

        for key, pos in self._positions.items():
            if pos.ticker != ticker:
                continue

            result_lower = outcome.strip().lower()
            if result_lower == "yes":
                settlement_price = 1.0 if pos.side == TradeSide.BUY_YES else 0.0
            elif result_lower == "no":
                settlement_price = 1.0 if pos.side == TradeSide.BUY_NO else 0.0
            else:
                continue

            settlement_value = pos.quantity * settlement_price
            realized_pnl = round(settlement_value - pos.size_dollars, 4)
            total_pnl += realized_pnl
            self._total_realized_pnl += realized_pnl

            self._closed.append(SimClosedPosition(
                ticker=pos.ticker,
                event_ticker=pos.event_ticker,
                venue=pos.venue,
                side=pos.side.value,
                entry_price=pos.entry_price,
                size_dollars=pos.size_dollars,
                quantity=pos.quantity,
                realized_pnl=realized_pnl,
                opened_at=pos.opened_at,
                closed_at=ts,
                category=pos.category,
            ))
            to_remove.append(key)

        for key in to_remove:
            del self._positions[key]

        return total_pnl

    def get_snapshot(self) -> PortfolioSnapshot:
        """Build a snapshot compatible with the guard system."""
        positions = list(self._positions.values())

        total_exposure = 0.0
        total_realized = self._total_realized_pnl
        venue_map: dict[str, float] = defaultdict(float)
        event_map: dict[str, float] = defaultdict(float)

        for p in positions:
            total_exposure += p.size_dollars
            venue_map[p.venue] += p.size_dollars
            event_map[p.event_ticker] += p.size_dollars

        return PortfolioSnapshot(
            positions=tuple(positions),
            total_exposure_dollars=round(total_exposure, 2),
            total_realized_pnl=round(total_realized, 4),
            total_unrealized_pnl=0.0,
            open_position_count=len(positions),
            venue_exposure=tuple(sorted(venue_map.items(), key=lambda x: -x[1])),
            event_exposure=tuple(sorted(event_map.items(), key=lambda x: -x[1])),
        )

    @property
    def open_position_count(self) -> int:
        return len(self._positions)

    @property
    def total_exposure(self) -> float:
        return sum(p.size_dollars for p in self._positions.values())
