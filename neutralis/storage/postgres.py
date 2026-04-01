"""Postgres storage using psycopg (sync) for Supabase direct connection."""

from __future__ import annotations

import json
from typing import Optional

import psycopg

from neutralis.config import DatabaseConfig
from neutralis.logging import get_logger
from neutralis.core.matcher import MarketPair
from neutralis.models import (
    Decision,
    MarketStatus,
    MarketType,
    NormalizedMarket,
    Position,
    PositionStatus,
    Signal,
    Trade,
    TradeSide,
)

logger = get_logger(__name__)


class PostgresStorage:
    """Write-only storage for pipeline outputs.

    When ``user_id`` is set, all per-user tables (positions, trades, signals,
    decisions, automation_state) are scoped to that user.  Global tables
    (market_snapshots, regime_states, etc.) are unaffected.
    """

    def __init__(self, config: DatabaseConfig, user_id: str | None = None) -> None:
        self._dsn = config.dsn
        self._conn: Optional[psycopg.Connection] = None
        self._user_id: str | None = user_id

    def connect(self) -> None:
        self._conn = psycopg.connect(self._dsn, prepare_threshold=None)
        self._conn.autocommit = True
        self._conn.execute("DEALLOCATE ALL")
        self._conn.autocommit = False
        logger.info("Connected to Postgres")

    def close(self) -> None:
        if self._conn and not self._conn.closed:
            self._conn.close()
            logger.info("Postgres connection closed")

    def __enter__(self) -> PostgresStorage:
        self.connect()
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def _safe_rollback(self) -> None:
        """Rollback the current transaction if one is in error state."""
        if self._conn and not self._conn.closed:
            try:
                self._conn.rollback()
            except Exception:
                pass

    def _ensure_connected(self) -> psycopg.Connection:
        if self._conn is None or self._conn.closed:
            self.connect()
        assert self._conn is not None
        return self._conn

    # -- User-scoping helpers --

    def _user_filter(self) -> str:
        """SQL fragment: `` AND user_id = %(uid)s`` when user-scoped, else ``""``."""
        return " AND user_id = %(uid)s" if self._user_id else ""

    def _user_where(self) -> str:
        """SQL fragment: ``WHERE user_id = %(uid)s`` when user-scoped, else ``""``."""
        return " WHERE user_id = %(uid)s" if self._user_id else ""

    @property
    def _uid_params(self) -> dict:
        """Params dict containing ``uid`` when user-scoped, else empty."""
        return {"uid": self._user_id} if self._user_id else {}

    def save_market_snapshot(self, m: NormalizedMarket) -> int:
        """Insert a market snapshot row. Returns the generated id."""
        conn = self._ensure_connected()

        ob_yes_best = m.yes_bids[0] if m.yes_bids else None
        ob_no_best = m.no_bids[0] if m.no_bids else None

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO market_snapshots (
                    ticker, event_ticker, market_type, title, status,
                    yes_bid, yes_ask, no_bid, no_ask,
                    volume, volume_24h, liquidity, open_interest, notional_value,
                    close_time, expected_expiration, snapshot_ts,
                    ob_yes_best_bid, ob_yes_best_bid_qty,
                    ob_no_best_bid, ob_no_best_bid_qty,
                    venue
                ) VALUES (
                    %(ticker)s, %(event_ticker)s, %(market_type)s, %(title)s, %(status)s,
                    %(yes_bid)s, %(yes_ask)s, %(no_bid)s, %(no_ask)s,
                    %(volume)s, %(volume_24h)s, %(liquidity)s, %(open_interest)s,
                    %(notional_value)s,
                    %(close_time)s, %(expected_expiration)s, %(snapshot_ts)s,
                    %(ob_yes_best_bid)s, %(ob_yes_best_bid_qty)s,
                    %(ob_no_best_bid)s, %(ob_no_best_bid_qty)s,
                    %(venue)s
                )
                RETURNING id
                """,
                {
                    "ticker": m.ticker,
                    "event_ticker": m.event_ticker,
                    "market_type": m.market_type.value,
                    "title": m.title,
                    "status": m.status.value,
                    "yes_bid": m.yes_bid,
                    "yes_ask": m.yes_ask,
                    "no_bid": m.no_bid,
                    "no_ask": m.no_ask,
                    "volume": m.volume,
                    "volume_24h": m.volume_24h,
                    "liquidity": m.liquidity,
                    "open_interest": m.open_interest,
                    "notional_value": m.notional_value,
                    "close_time": m.close_time,
                    "expected_expiration": m.expected_expiration,
                    "snapshot_ts": m.snapshot_ts,
                    "ob_yes_best_bid": ob_yes_best.price_dollars if ob_yes_best else None,
                    "ob_yes_best_bid_qty": ob_yes_best.quantity_dollars if ob_yes_best else None,
                    "ob_no_best_bid": ob_no_best.price_dollars if ob_no_best else None,
                    "ob_no_best_bid_qty": ob_no_best.quantity_dollars if ob_no_best else None,
                    "venue": m.venue,
                },
            )
            row = cur.fetchone()
            assert row is not None
            snapshot_id: int = row[0]

        conn.commit()
        return snapshot_id

    def save_signal(self, signal: Signal, snapshot_id: int | None = None) -> str:
        """Insert a signal row. Returns the signal id."""
        conn = self._ensure_connected()

        features_json_str = json.dumps(signal.features_json) if signal.features_json else "{}"

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO signals (
                    id, signal_type, ticker, event_ticker,
                    yes_ask, no_ask, combined_cost,
                    gross_edge, net_edge, edge_pct,
                    snapshot_id, created_at,
                    confidence_score, time_to_resolution_days,
                    roi_per_day, features_json,
                    implied_probability, entry_side, probability_floor,
                    user_id
                ) VALUES (
                    %(id)s, %(signal_type)s, %(ticker)s, %(event_ticker)s,
                    %(yes_ask)s, %(no_ask)s, %(combined_cost)s,
                    %(gross_edge)s, %(net_edge)s, %(edge_pct)s,
                    %(snapshot_id)s, %(created_at)s,
                    %(confidence_score)s, %(time_to_resolution_days)s,
                    %(roi_per_day)s, %(features_json)s::jsonb,
                    %(implied_probability)s, %(entry_side)s, %(probability_floor)s,
                    %(uid)s
                )
                """,
                {
                    "id": signal.id,
                    "signal_type": signal.signal_type.value,
                    "ticker": signal.ticker,
                    "event_ticker": signal.event_ticker,
                    "yes_ask": signal.yes_ask,
                    "no_ask": signal.no_ask,
                    "combined_cost": signal.combined_cost,
                    "gross_edge": signal.gross_edge,
                    "net_edge": signal.net_edge,
                    "edge_pct": signal.edge_pct,
                    "snapshot_id": snapshot_id,
                    "created_at": signal.created_at,
                    "confidence_score": signal.confidence_score,
                    "time_to_resolution_days": signal.time_to_resolution_days,
                    "roi_per_day": signal.roi_per_day,
                    "features_json": features_json_str,
                    "implied_probability": signal.implied_probability or None,
                    "entry_side": signal.entry_side or None,
                    "probability_floor": signal.probability_floor or None,
                    "uid": self._user_id,
                },
            )
        conn.commit()
        return signal.id

    def save_decision(self, decision: Decision) -> int:
        """Insert a decision row. Returns the generated decision id."""
        conn = self._ensure_connected()

        guard_results_json = json.dumps(
            [
                {
                    "guard_name": gr.guard_name,
                    "passed": gr.passed,
                    "reason": gr.reason,
                    "value": gr.value,
                    "threshold": gr.threshold,
                }
                for gr in decision.guard_results
            ]
        )
        allocation_reasons_json = json.dumps(list(decision.allocation_reasons))

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO decisions (
                    signal_id, verdict, guard_results,
                    suggested_size, created_at,
                    selected, selection_score, allocation_reasons,
                    user_id
                ) VALUES (
                    %(signal_id)s, %(verdict)s, %(guard_results)s::jsonb,
                    %(suggested_size)s, %(created_at)s,
                    %(selected)s, %(selection_score)s, %(allocation_reasons)s::jsonb,
                    %(uid)s
                )
                RETURNING id
                """,
                {
                    "signal_id": decision.signal_id,
                    "verdict": decision.verdict.value,
                    "guard_results": guard_results_json,
                    "suggested_size": decision.suggested_size_dollars,
                    "created_at": decision.created_at,
                    "selected": decision.selected,
                    "selection_score": decision.selection_score,
                    "allocation_reasons": allocation_reasons_json,
                    "uid": self._user_id,
                },
            )
            row = cur.fetchone()
            assert row is not None
            decision_id: int = row[0]
        conn.commit()
        return decision_id

    def save_market_match(
        self,
        pair: MarketPair,
        kalshi_snapshot_id: int | None = None,
        polymarket_snapshot_id: int | None = None,
    ) -> int:
        """Insert a market match row. Returns the generated id."""
        conn = self._ensure_connected()

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO market_matches (
                    kalshi_ticker, kalshi_title,
                    polymarket_id, polymarket_question,
                    match_confidence,
                    kalshi_snapshot_id, polymarket_snapshot_id
                ) VALUES (
                    %(kalshi_ticker)s, %(kalshi_title)s,
                    %(polymarket_id)s, %(polymarket_question)s,
                    %(match_confidence)s,
                    %(kalshi_snapshot_id)s, %(polymarket_snapshot_id)s
                )
                RETURNING id
                """,
                {
                    "kalshi_ticker": pair.kalshi_market.ticker,
                    "kalshi_title": pair.kalshi_market.title,
                    "polymarket_id": pair.polymarket_market.ticker,
                    "polymarket_question": pair.polymarket_market.title,
                    "match_confidence": pair.similarity,
                    "kalshi_snapshot_id": kalshi_snapshot_id,
                    "polymarket_snapshot_id": polymarket_snapshot_id,
                },
            )
            row = cur.fetchone()
            assert row is not None
            match_id: int = row[0]

        conn.commit()
        return match_id

    def save_cross_platform_signal(
        self,
        signal: Signal,
        match_id: int | None = None,
        kalshi_snapshot_id: int | None = None,
        polymarket_snapshot_id: int | None = None,
    ) -> str:
        """Insert a cross-platform signal row. Returns the signal id."""
        conn = self._ensure_connected()
        xp = signal.cross_platform
        assert xp is not None

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO cross_platform_signals (
                    id, signal_type,
                    kalshi_ticker, kalshi_yes_ask, kalshi_no_ask,
                    polymarket_id, polymarket_yes_price, polymarket_no_price,
                    match_confidence, price_discrepancy_pct, favored_venue,
                    match_id, kalshi_snapshot_id, polymarket_snapshot_id
                ) VALUES (
                    %(id)s, %(signal_type)s,
                    %(kalshi_ticker)s, %(kalshi_yes_ask)s, %(kalshi_no_ask)s,
                    %(polymarket_id)s, %(polymarket_yes_price)s, %(polymarket_no_price)s,
                    %(match_confidence)s, %(price_discrepancy_pct)s, %(favored_venue)s,
                    %(match_id)s, %(kalshi_snapshot_id)s, %(polymarket_snapshot_id)s
                )
                """,
                {
                    "id": signal.id,
                    "signal_type": signal.signal_type.value,
                    "kalshi_ticker": xp.kalshi_ticker,
                    "kalshi_yes_ask": xp.kalshi_yes_ask,
                    "kalshi_no_ask": xp.kalshi_no_ask,
                    "polymarket_id": xp.polymarket_id,
                    "polymarket_yes_price": xp.polymarket_yes_price,
                    "polymarket_no_price": xp.polymarket_no_price,
                    "match_confidence": xp.match_confidence,
                    "price_discrepancy_pct": xp.price_discrepancy_pct,
                    "favored_venue": xp.favored_venue,
                    "match_id": match_id,
                    "kalshi_snapshot_id": kalshi_snapshot_id,
                    "polymarket_snapshot_id": polymarket_snapshot_id,
                },
            )
        conn.commit()
        return signal.id

    # -- Portfolio: trades and positions --

    _POSITION_COLS = (
        "id, ticker, event_ticker, venue, side, status, "
        "entry_price, size_dollars, quantity, "
        "realized_pnl, unrealized_pnl, trade_count, "
        "opened_at, closed_at, category, exit_reason, exit_price, signal_type, "
        "hwm_pnl_pct"
    )

    @staticmethod
    def _row_to_position(row: tuple) -> Position:
        return Position(
            id=row[0],
            ticker=row[1],
            event_ticker=row[2],
            venue=row[3],
            side=TradeSide(row[4]),
            status=PositionStatus(row[5]),
            entry_price=row[6],
            size_dollars=row[7],
            quantity=row[8],
            realized_pnl=row[9],
            unrealized_pnl=row[10],
            trade_count=row[11],
            opened_at=row[12],
            closed_at=row[13],
            category=row[14] if len(row) > 14 else "other",
            exit_reason=row[15] if len(row) > 15 else None,
            exit_price=float(row[16]) if len(row) > 16 and row[16] is not None else None,
            signal_type=row[17] if len(row) > 17 and row[17] is not None else "",
            hwm_pnl_pct=float(row[18]) if len(row) > 18 and row[18] is not None else 0.0,
        )

    def save_trade(self, trade: Trade) -> str:
        """Insert a trade row. Returns the trade id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO trades (
                    id, signal_id, decision_id, ticker, event_ticker,
                    venue, side, price, size_dollars, quantity,
                    is_paper, order_id, fill_price, created_at,
                    user_id
                ) VALUES (
                    %(id)s, %(signal_id)s, %(decision_id)s, %(ticker)s, %(event_ticker)s,
                    %(venue)s, %(side)s, %(price)s, %(size_dollars)s, %(quantity)s,
                    %(is_paper)s, %(order_id)s, %(fill_price)s, %(created_at)s,
                    %(uid)s
                )
                """,
                {
                    "id": trade.id,
                    "signal_id": trade.signal_id,
                    "decision_id": trade.decision_id,
                    "ticker": trade.ticker,
                    "event_ticker": trade.event_ticker,
                    "venue": trade.venue,
                    "side": trade.side.value,
                    "price": trade.price,
                    "size_dollars": trade.size_dollars,
                    "quantity": trade.quantity,
                    "is_paper": trade.is_paper,
                    "order_id": trade.order_id,
                    "fill_price": trade.fill_price,
                    "created_at": trade.created_at,
                    "uid": self._user_id,
                },
            )
        conn.commit()
        return trade.id

    def save_position(self, position: Position) -> str:
        """Insert a new position row. Returns the position id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO positions (
                    id, ticker, event_ticker, venue, side, status,
                    entry_price, size_dollars, quantity,
                    realized_pnl, unrealized_pnl, trade_count,
                    opened_at, closed_at, category, exit_reason, exit_price,
                    signal_type, hwm_pnl_pct, user_id
                ) VALUES (
                    %(id)s, %(ticker)s, %(event_ticker)s, %(venue)s, %(side)s, %(status)s,
                    %(entry_price)s, %(size_dollars)s, %(quantity)s,
                    %(realized_pnl)s, %(unrealized_pnl)s, %(trade_count)s,
                    %(opened_at)s, %(closed_at)s, %(category)s,
                    %(exit_reason)s, %(exit_price)s,
                    %(signal_type)s, %(hwm_pnl_pct)s, %(uid)s
                )
                """,
                {
                    "id": position.id,
                    "ticker": position.ticker,
                    "event_ticker": position.event_ticker,
                    "venue": position.venue,
                    "side": position.side.value,
                    "status": position.status.value,
                    "entry_price": position.entry_price,
                    "size_dollars": position.size_dollars,
                    "quantity": position.quantity,
                    "realized_pnl": position.realized_pnl,
                    "unrealized_pnl": position.unrealized_pnl,
                    "trade_count": position.trade_count,
                    "opened_at": position.opened_at,
                    "closed_at": position.closed_at,
                    "category": position.category,
                    "exit_reason": position.exit_reason,
                    "exit_price": position.exit_price,
                    "signal_type": position.signal_type,
                    "hwm_pnl_pct": position.hwm_pnl_pct,
                    "uid": self._user_id,
                },
            )
        conn.commit()
        return position.id

    def update_position(
        self,
        position_id: str,
        entry_price: float,
        size_dollars: float,
        quantity: float,
        trade_count: int,
    ) -> None:
        """Update an open position's size fields (for adding to a position)."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE positions
                SET entry_price = %(entry_price)s,
                    size_dollars = %(size_dollars)s,
                    quantity = %(quantity)s,
                    trade_count = %(trade_count)s
                WHERE id = %(id)s AND status = 'open'
                """,
                {
                    "id": position_id,
                    "entry_price": entry_price,
                    "size_dollars": size_dollars,
                    "quantity": quantity,
                    "trade_count": trade_count,
                },
            )
        conn.commit()

    def update_unrealized_pnl(self, position_id: str, unrealized_pnl: float) -> None:
        """Update the unrealized P&L for a single open position."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE positions
                SET unrealized_pnl = %(pnl)s
                WHERE id = %(id)s AND status = 'open'
                """,
                {"id": position_id, "pnl": unrealized_pnl},
            )
        conn.commit()

    def update_hwm_pnl_pct(self, position_id: str, hwm_pnl_pct: float) -> None:
        """Persist the trailing-stop high-water mark for an open position."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE positions
                SET hwm_pnl_pct = %(hwm)s
                WHERE id = %(id)s AND status = 'open'
                """,
                {"id": position_id, "hwm": hwm_pnl_pct},
            )
        conn.commit()

    def close_position(
        self,
        position_id: str,
        realized_pnl: float,
        closed_at: object,
        exit_reason: str | None = None,
        exit_price: float | None = None,
    ) -> None:
        """Mark a position as closed with realized P&L."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE positions
                SET status = 'closed',
                    realized_pnl = %(realized_pnl)s,
                    unrealized_pnl = 0,
                    closed_at = %(closed_at)s,
                    exit_reason = %(exit_reason)s,
                    exit_price = %(exit_price)s
                WHERE id = %(id)s AND status = 'open'
                """,
                {
                    "id": position_id,
                    "realized_pnl": realized_pnl,
                    "closed_at": closed_at,
                    "exit_reason": exit_reason,
                    "exit_price": exit_price,
                },
            )
        conn.commit()

    def get_open_positions(self) -> list[Position]:
        """Return all open positions (scoped by user_id when set)."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {self._POSITION_COLS} FROM positions "
                f"WHERE status = 'open'{self._user_filter()} ORDER BY opened_at",
                self._uid_params,
            )
            rows = cur.fetchall()
        return [self._row_to_position(row) for row in rows]

    def get_open_position(
        self, ticker: str, venue: str, side: TradeSide,
    ) -> Position | None:
        """Return the open position for a ticker/venue/side combo, or None."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {self._POSITION_COLS} FROM positions "
                "WHERE ticker = %(ticker)s AND venue = %(venue)s "
                f"AND side = %(side)s AND status = 'open'{self._user_filter()}",
                {"ticker": ticker, "venue": venue, "side": side.value, **self._uid_params},
            )
            row = cur.fetchone()
        return self._row_to_position(row) if row else None

    def get_position(self, position_id: str) -> Position | None:
        """Return a position by ID."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {self._POSITION_COLS} FROM positions WHERE id = %(id)s",
                {"id": position_id},
            )
            row = cur.fetchone()
        return self._row_to_position(row) if row else None

    def get_positions_by_event(self, event_ticker: str) -> list[Position]:
        """Return all open positions for an event."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {self._POSITION_COLS} FROM positions "
                f"WHERE event_ticker = %(event_ticker)s AND status = 'open'{self._user_filter()}",
                {"event_ticker": event_ticker, **self._uid_params},
            )
            rows = cur.fetchall()
        return [self._row_to_position(row) for row in rows]

    def get_positions_by_ticker(self, ticker: str) -> list[Position]:
        """Return all open positions for a ticker."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {self._POSITION_COLS} FROM positions "
                f"WHERE ticker = %(ticker)s AND status = 'open'{self._user_filter()}",
                {"ticker": ticker, **self._uid_params},
            )
            rows = cur.fetchall()
        return [self._row_to_position(row) for row in rows]

    def get_open_positions_by_signal_type(self, signal_type: str) -> list[Position]:
        """Return all open positions for a specific signal type."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {self._POSITION_COLS} FROM positions "
                f"WHERE signal_type = %(signal_type)s AND status = 'open'{self._user_filter()} "
                "ORDER BY opened_at",
                {"signal_type": signal_type, **self._uid_params},
            )
            rows = cur.fetchall()
        return [self._row_to_position(row) for row in rows]

    # -- Dashboard API read queries --

    def _fetch_dicts(self, sql: str, params: dict | None = None) -> list[dict]:
        """Execute a SELECT and return rows as dicts."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(sql, params or {})
            if cur.description is None:
                return []
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]

    def get_recent_signals(self, limit: int = 50) -> list[dict]:
        return self._fetch_dicts(
            f"SELECT * FROM signals WHERE 1=1{self._user_filter()} "
            "ORDER BY created_at DESC LIMIT %(limit)s",
            {"limit": limit, **self._uid_params},
        )

    def get_recent_decisions(
        self, limit: int = 50, verdict: str | None = None,
    ) -> list[dict]:
        if verdict:
            return self._fetch_dicts(
                "SELECT d.*, s.ticker, s.edge_pct, s.signal_type "
                "FROM decisions d JOIN signals s ON d.signal_id = s.id "
                f"WHERE d.verdict = %(verdict)s{self._user_filter().replace('user_id', 'd.user_id')} "
                "ORDER BY d.created_at DESC LIMIT %(limit)s",
                {"verdict": verdict, "limit": limit, **self._uid_params},
            )
        return self._fetch_dicts(
            "SELECT d.*, s.ticker, s.edge_pct, s.signal_type "
            "FROM decisions d JOIN signals s ON d.signal_id = s.id "
            f"WHERE 1=1{self._user_filter().replace('user_id', 'd.user_id')} "
            "ORDER BY d.created_at DESC LIMIT %(limit)s",
            {"limit": limit, **self._uid_params},
        )

    def get_recent_trades(self, limit: int = 50) -> list[dict]:
        return self._fetch_dicts(
            f"SELECT * FROM trades WHERE 1=1{self._user_filter()} "
            "ORDER BY created_at DESC LIMIT %(limit)s",
            {"limit": limit, **self._uid_params},
        )

    def get_closed_positions(self, limit: int = 50) -> list[dict]:
        return self._fetch_dicts(
            f"SELECT * FROM positions WHERE status = 'closed'{self._user_filter()} "
            "ORDER BY closed_at DESC LIMIT %(limit)s",
            {"limit": limit, **self._uid_params},
        )

    def get_recent_matches(self, limit: int = 50) -> list[dict]:
        return self._fetch_dicts(
            "SELECT * FROM market_matches "
            "ORDER BY created_at DESC LIMIT %(limit)s",
            {"limit": limit},
        )

    def get_recent_cross_platform_signals(self, limit: int = 50) -> list[dict]:
        return self._fetch_dicts(
            "SELECT * FROM cross_platform_signals "
            "ORDER BY created_at DESC LIMIT %(limit)s",
            {"limit": limit},
        )

    def get_portfolio_stats(self) -> dict:
        """Aggregate portfolio statistics."""
        conn = self._ensure_connected()
        uf = self._user_filter()
        p = self._uid_params
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'open') AS open_positions,
                    COUNT(*) FILTER (WHERE status = 'closed') AS closed_positions,
                    COALESCE(SUM(size_dollars) FILTER (WHERE status = 'open'), 0) AS total_exposure,
                    COALESCE(SUM(realized_pnl) FILTER (WHERE status = 'closed'), 0) AS total_realized_pnl,
                    COUNT(*) FILTER (WHERE status = 'closed' AND realized_pnl > 0) AS wins,
                    COUNT(*) FILTER (WHERE status = 'closed' AND realized_pnl <= 0) AS losses
                FROM positions
                WHERE 1=1{uf}
            """, p)
            row = cur.fetchone()

            cur.execute(f"SELECT COUNT(*) FROM trades WHERE 1=1{uf}", p)
            trade_count = cur.fetchone()[0]  # type: ignore[index]

        return {
            "open_positions": row[0],  # type: ignore[index]
            "closed_positions": row[1],  # type: ignore[index]
            "total_exposure": float(row[2]),  # type: ignore[index]
            "total_realized_pnl": float(row[3]),  # type: ignore[index]
            "wins": row[4],  # type: ignore[index]
            "losses": row[5],  # type: ignore[index]
            "win_rate": round(row[4] / max(row[4] + row[5], 1), 4),  # type: ignore[index]
            "total_trades": trade_count,
        }

    # -- Analytics queries --

    def get_daily_pnl(self, days: int = 90) -> list[dict]:
        """Daily realized P&L for closed positions over the last N days."""
        return self._fetch_dicts(
            f"""
            SELECT
                DATE(closed_at) AS date,
                SUM(realized_pnl) AS pnl,
                COUNT(*) AS trades,
                SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN realized_pnl <= 0 THEN 1 ELSE 0 END) AS losses
            FROM positions
            WHERE status = 'closed'
              AND closed_at >= now() - make_interval(days => %(days)s)
              {self._user_filter()}
            GROUP BY DATE(closed_at)
            ORDER BY date
            """,
            {"days": days, **self._uid_params},
        )

    def get_today_realized_pnl(self) -> float:
        """Sum of realized P&L for positions closed today (UTC).

        Used by the daily loss circuit breaker to determine if the cumulative
        daily loss has breached the configured threshold.
        """
        conn = self._ensure_connected()
        uf = self._user_filter()
        p = self._uid_params
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT COALESCE(SUM(realized_pnl), 0)
                    FROM positions
                    WHERE status = 'closed'
                      AND closed_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
                      {uf}
                    """,
                    p,
                )
                row = cur.fetchone()
            conn.commit()
        except Exception:
            self._safe_rollback()
            return 0.0
        return float(row[0]) if row else 0.0

    def get_today_unrealized_pnl(self) -> float:
        """Sum of unrealized P&L for currently open positions.

        Used together with realized P&L for the daily loss circuit breaker
        to compute total daily P&L (realized + unrealized).
        """
        conn = self._ensure_connected()
        uf = self._user_filter()
        p = self._uid_params
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT COALESCE(SUM(unrealized_pnl), 0)
                    FROM positions
                    WHERE status = 'open'
                      {uf}
                    """,
                    p,
                )
                row = cur.fetchone()
            conn.commit()
        except Exception:
            self._safe_rollback()
            return 0.0
        return float(row[0]) if row else 0.0

    def get_category_breakdown(self) -> list[dict]:
        """P&L and trade counts per market category."""
        return self._fetch_dicts(f"""
            SELECT
                category,
                COUNT(*) AS total_trades,
                SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN realized_pnl <= 0 THEN 1 ELSE 0 END) AS losses,
                COALESCE(SUM(realized_pnl), 0) AS total_pnl,
                COALESCE(AVG(realized_pnl), 0) AS avg_pnl
            FROM positions
            WHERE status = 'closed'{self._user_filter()}
            GROUP BY category
            ORDER BY total_pnl DESC
        """, self._uid_params)

    def get_venue_breakdown(self) -> list[dict]:
        """P&L and trade counts per venue."""
        return self._fetch_dicts(f"""
            SELECT
                venue,
                COUNT(*) AS total_trades,
                SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN realized_pnl <= 0 THEN 1 ELSE 0 END) AS losses,
                COALESCE(SUM(realized_pnl), 0) AS total_pnl
            FROM positions
            WHERE status = 'closed'{self._user_filter()}
            GROUP BY venue
        """, self._uid_params)

    def get_analytics_summary(self) -> dict:
        """Aggregate analytics: total P&L, best/worst day, max drawdown, avg trade."""
        uf = self._user_filter()
        rows = self._fetch_dicts(f"""
            WITH daily AS (
                SELECT DATE(closed_at) AS d, SUM(realized_pnl) AS pnl
                FROM positions WHERE status = 'closed'{uf}
                GROUP BY DATE(closed_at)
            ),
            cumulative AS (
                SELECT d, pnl, SUM(pnl) OVER (ORDER BY d) AS cum_pnl
                FROM daily
            ),
            drawdown AS (
                SELECT d, cum_pnl,
                       cum_pnl - MAX(cum_pnl) OVER (
                           ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                       ) AS dd
                FROM cumulative
            )
            SELECT
                (SELECT COALESCE(SUM(realized_pnl), 0) FROM positions WHERE status = 'closed'{uf})
                    AS total_pnl,
                (SELECT COUNT(*) FROM positions WHERE status = 'closed'{uf})
                    AS total_closed,
                (SELECT COALESCE(MAX(pnl), 0) FROM daily) AS best_day,
                (SELECT COALESCE(MIN(pnl), 0) FROM daily) AS worst_day,
                (SELECT COALESCE(MIN(dd), 0) FROM drawdown) AS max_drawdown,
                (SELECT COALESCE(AVG(realized_pnl), 0) FROM positions WHERE status = 'closed'{uf})
                    AS avg_trade_pnl,
                (SELECT COALESCE(AVG(realized_pnl), 0) FROM positions
                    WHERE status = 'closed' AND realized_pnl > 0{uf}) AS avg_win,
                (SELECT COALESCE(ABS(AVG(realized_pnl)), 0) FROM positions
                    WHERE status = 'closed' AND realized_pnl <= 0{uf}) AS avg_loss
        """, self._uid_params)
        return rows[0] if rows else {}

    def get_pnl_distribution(self, bucket_size: float = 5.0) -> list[dict]:
        """Histogram of realized P&L values."""
        return self._fetch_dicts(
            f"""
            SELECT
                FLOOR(realized_pnl / %(bucket)s) * %(bucket)s AS bucket_start,
                COUNT(*) AS count
            FROM positions
            WHERE status = 'closed'{self._user_filter()}
            GROUP BY bucket_start
            ORDER BY bucket_start
            """,
            {"bucket": bucket_size, **self._uid_params},
        )

    def get_guard_effectiveness(self) -> list[dict]:
        """Rejection rate per guard name from decisions."""
        return self._fetch_dicts(f"""
            SELECT
                g->>'guard_name' AS guard_name,
                COUNT(*) AS total_evaluations,
                SUM(CASE WHEN (g->>'passed')::boolean = false THEN 1 ELSE 0 END)
                    AS rejections,
                ROUND(
                    SUM(CASE WHEN (g->>'passed')::boolean = false THEN 1 ELSE 0 END)::numeric
                    / NULLIF(COUNT(*), 0), 4
                ) AS rejection_rate
            FROM decisions, jsonb_array_elements(guard_results) AS g
            WHERE 1=1{self._user_filter().replace('user_id', 'decisions.user_id')}
            GROUP BY g->>'guard_name'
            ORDER BY rejections DESC
        """, self._uid_params)

    # -- Signal feed & regime queries --

    def get_enriched_signals(
        self,
        limit: int = 50,
        min_confidence: int = 0,
        signal_type: str | None = None,
        verdict: str | None = None,
    ) -> list[dict]:
        """Signals joined with their latest decision, for the live feed."""
        where_clauses = ["s.confidence_score >= %(min_confidence)s"]
        params: dict = {"limit": limit, "min_confidence": min_confidence, **self._uid_params}

        if self._user_id:
            where_clauses.append("s.user_id = %(uid)s")
        if signal_type:
            where_clauses.append("s.signal_type = %(signal_type)s")
            params["signal_type"] = signal_type
        if verdict:
            where_clauses.append("d.verdict = %(verdict)s")
            params["verdict"] = verdict

        where_sql = " AND ".join(where_clauses)

        return self._fetch_dicts(f"""
            SELECT
                s.id, s.signal_type, s.ticker, s.event_ticker,
                s.edge_pct, s.net_edge, s.confidence_score,
                s.roi_per_day, s.time_to_resolution_days,
                s.features_json, s.created_at AS signal_created_at,
                d.id AS decision_id, d.verdict, d.selected,
                d.selection_score, d.suggested_size,
                d.guard_results, d.allocation_reasons
            FROM signals s
            LEFT JOIN decisions d ON d.signal_id = s.id
            WHERE {where_sql}
            ORDER BY s.created_at DESC
            LIMIT %(limit)s
        """, params)

    def get_current_regime(self) -> dict | None:
        """Return the most recent regime state."""
        rows = self._fetch_dicts(
            "SELECT * FROM regime_states ORDER BY created_at DESC LIMIT 1"
        )
        return rows[0] if rows else None

    # -- Backtest queries --

    def get_snapshot_timestamps(
        self, start_date: str, end_date: str,
    ) -> list[dict]:
        """Get distinct pipeline-run timestamps within a date range.

        Groups snapshots into runs by rounding snapshot_ts to the nearest minute.
        Returns [{ts, kalshi_count, poly_count}] ordered chronologically.
        """
        return self._fetch_dicts(
            """
            SELECT
                date_trunc('minute', snapshot_ts) AS ts,
                COUNT(*) FILTER (WHERE venue = 'kalshi') AS kalshi_count,
                COUNT(*) FILTER (WHERE venue = 'polymarket') AS poly_count
            FROM market_snapshots
            WHERE snapshot_ts >= %(start)s::timestamptz
              AND snapshot_ts < %(end)s::timestamptz
            GROUP BY date_trunc('minute', snapshot_ts)
            HAVING COUNT(*) >= 2
            ORDER BY ts
            """,
            {"start": start_date, "end": end_date},
        )

    def get_snapshots_at(
        self, ts: object, venue: str | None = None,
    ) -> list[NormalizedMarket]:
        """Fetch all market snapshots at a given pipeline-run timestamp.

        Matches within a 1-minute window around `ts`.
        """
        conn = self._ensure_connected()
        sql = """
            SELECT
                ticker, event_ticker, market_type, title, status,
                yes_bid, yes_ask, no_bid, no_ask,
                volume, volume_24h, liquidity, open_interest, notional_value,
                close_time, expected_expiration, snapshot_ts, venue
            FROM market_snapshots
            WHERE snapshot_ts >= %(ts)s::timestamptz
              AND snapshot_ts < %(ts)s::timestamptz + interval '1 minute'
        """
        params: dict = {"ts": str(ts)}
        if venue:
            sql += " AND venue = %(venue)s"
            params["venue"] = venue

        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

        markets: list[NormalizedMarket] = []
        for r in rows:
            try:
                markets.append(NormalizedMarket(
                    ticker=r[0],
                    event_ticker=r[1],
                    market_type=MarketType(r[2]) if r[2] else MarketType.BINARY,
                    title=r[3] or "",
                    subtitle="",
                    status=MarketStatus(r[4]) if r[4] else MarketStatus.ACTIVE,
                    yes_bid=float(r[5]),
                    yes_ask=float(r[6]),
                    no_bid=float(r[7]),
                    no_ask=float(r[8]),
                    volume=float(r[9]),
                    volume_24h=float(r[10]),
                    liquidity=float(r[11]),
                    open_interest=float(r[12]),
                    notional_value=float(r[13]),
                    close_time=r[14],
                    expected_expiration=r[15],
                    venue=r[17] or "kalshi",
                ))
            except (ValueError, TypeError):
                continue
        return markets

    def get_market_outcome(self, ticker: str) -> str | None:
        """Check if a market resolved by looking at the latest snapshot status.

        Returns 'yes', 'no', or None if not yet resolved.
        Uses the last snapshot: if status is determined/finalized/closed,
        infers outcome from yes_ask (near 1.0 = yes won, near 0.0 = no won).
        """
        rows = self._fetch_dicts(
            """
            SELECT status, yes_ask, no_ask
            FROM market_snapshots
            WHERE ticker = %(ticker)s
            ORDER BY snapshot_ts DESC
            LIMIT 1
            """,
            {"ticker": ticker},
        )
        if not rows:
            return None
        row = rows[0]
        status = row.get("status", "")
        if status not in ("determined", "finalized", "closed"):
            return None
        yes_ask = float(row.get("yes_ask", 0.5))
        if yes_ask >= 0.90:
            return "yes"
        if yes_ask <= 0.10:
            return "no"
        return None

    # -- Alpha vNext: regime & disagreement --

    def save_regime_state(
        self, regime: str, metrics: dict, params: dict,
    ) -> int:
        """Insert a regime state row. Returns the generated id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO regime_states (regime, metrics_json, params_json)
                VALUES (%(regime)s, %(metrics)s::jsonb, %(params)s::jsonb)
                RETURNING id
                """,
                {
                    "regime": regime,
                    "metrics": json.dumps(metrics),
                    "params": json.dumps(params),
                },
            )
            row = cur.fetchone()
            assert row is not None
            state_id: int = row[0]
        conn.commit()
        return state_id

    def save_disagreement_index(
        self, overall: float, by_category: dict, sample_size: int,
    ) -> int:
        """Insert a disagreement index row. Returns the generated id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO disagreement_index (overall, by_category, sample_size)
                VALUES (%(overall)s, %(by_category)s::jsonb, %(sample_size)s)
                RETURNING id
                """,
                {
                    "overall": overall,
                    "by_category": json.dumps(by_category),
                    "sample_size": sample_size,
                },
            )
            row = cur.fetchone()
            assert row is not None
            idx_id: int = row[0]
        conn.commit()
        return idx_id

    def save_scheduler_run(self, run_number: int, run_stats: object) -> int:
        """Insert a scheduler run metrics row. Returns the generated id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scheduler_runs (
                    run_number, duration_ms,
                    kalshi_markets, poly_markets,
                    complement_signals, cross_platform_signals, matches,
                    decisions_pass, decisions_reject, decisions_selected,
                    open_positions, total_exposure,
                    positions_settled, settlement_pnl, marked_positions,
                    exits_triggered, exit_pnl,
                    regime, disagreement_index
                ) VALUES (
                    %(run_number)s, %(duration_ms)s,
                    %(kalshi_markets)s, %(poly_markets)s,
                    %(complement_signals)s, %(cross_platform_signals)s, %(matches)s,
                    %(decisions_pass)s, %(decisions_reject)s, %(decisions_selected)s,
                    %(open_positions)s, %(total_exposure)s,
                    %(positions_settled)s, %(settlement_pnl)s, %(marked_positions)s,
                    %(exits_triggered)s, %(exit_pnl)s,
                    %(regime)s, %(disagreement_index)s
                )
                RETURNING id
                """,
                {
                    "run_number": run_number,
                    "duration_ms": getattr(run_stats, "duration_ms", 0.0),
                    "kalshi_markets": getattr(run_stats, "kalshi_markets", 0),
                    "poly_markets": getattr(run_stats, "poly_markets", 0),
                    "complement_signals": getattr(run_stats, "complement_signals", 0),
                    "cross_platform_signals": getattr(run_stats, "cross_platform_signals", 0),
                    "matches": getattr(run_stats, "matches", 0),
                    "decisions_pass": getattr(run_stats, "decisions_pass", 0),
                    "decisions_reject": getattr(run_stats, "decisions_reject", 0),
                    "decisions_selected": getattr(run_stats, "decisions_selected", 0),
                    "open_positions": getattr(run_stats, "open_positions", 0),
                    "total_exposure": getattr(run_stats, "total_exposure", 0.0),
                    "positions_settled": getattr(run_stats, "positions_settled", 0),
                    "settlement_pnl": getattr(run_stats, "settlement_pnl", 0.0),
                    "marked_positions": getattr(run_stats, "marked_positions", 0),
                    "exits_triggered": getattr(run_stats, "exits_triggered", 0),
                    "exit_pnl": getattr(run_stats, "exit_pnl", 0.0),
                    "regime": getattr(run_stats, "regime", "normal"),
                    "disagreement_index": getattr(run_stats, "disagreement_index", 0.0),
                },
            )
            row = cur.fetchone()
            assert row is not None
            run_id: int = row[0]
        conn.commit()
        return run_id

    # -- Execution: orders and fills --

    def save_order(self, order: object) -> str:
        """Insert an order row (idempotent via ON CONFLICT DO NOTHING).

        Returns the order id if inserted, or '' if skipped due to conflict.
        """
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO orders (
                    id, tick_id, signal_id, decision_id,
                    ticker, event_ticker, venue, side, order_type,
                    requested_price, requested_size_dollars, requested_quantity,
                    status, filled_size_dollars, filled_quantity, fill_count,
                    avg_fill_price, slippage_bps, fees_dollars,
                    is_paper, user_id, created_at, updated_at, expired_at
                ) VALUES (
                    %(id)s, %(tick_id)s, %(signal_id)s, %(decision_id)s,
                    %(ticker)s, %(event_ticker)s, %(venue)s, %(side)s, %(order_type)s,
                    %(requested_price)s, %(requested_size_dollars)s, %(requested_quantity)s,
                    %(status)s, %(filled_size_dollars)s, %(filled_quantity)s, %(fill_count)s,
                    %(avg_fill_price)s, %(slippage_bps)s, %(fees_dollars)s,
                    %(is_paper)s, %(user_id)s, %(created_at)s, %(updated_at)s, %(expired_at)s
                )
                ON CONFLICT (tick_id, decision_id, ticker, side) DO NOTHING
                RETURNING id
                """,
                {
                    "id": getattr(order, "id"),
                    "tick_id": getattr(order, "tick_id"),
                    "signal_id": getattr(order, "signal_id"),
                    "decision_id": getattr(order, "decision_id"),
                    "ticker": getattr(order, "ticker"),
                    "event_ticker": getattr(order, "event_ticker"),
                    "venue": getattr(order, "venue"),
                    "side": getattr(order, "side"),
                    "order_type": getattr(order, "order_type"),
                    "requested_price": getattr(order, "requested_price"),
                    "requested_size_dollars": getattr(order, "requested_size_dollars"),
                    "requested_quantity": getattr(order, "requested_quantity"),
                    "status": getattr(order, "status"),
                    "filled_size_dollars": getattr(order, "filled_size_dollars"),
                    "filled_quantity": getattr(order, "filled_quantity"),
                    "fill_count": getattr(order, "fill_count"),
                    "avg_fill_price": getattr(order, "avg_fill_price"),
                    "slippage_bps": getattr(order, "slippage_bps"),
                    "fees_dollars": getattr(order, "fees_dollars"),
                    "is_paper": getattr(order, "is_paper"),
                    "user_id": getattr(order, "user_id"),
                    "created_at": getattr(order, "created_at"),
                    "updated_at": getattr(order, "updated_at"),
                    "expired_at": getattr(order, "expired_at"),
                },
            )
            row = cur.fetchone()
        conn.commit()
        return row[0] if row else ""

    def save_fill(self, fill: object) -> str:
        """Insert a fill row. Returns the fill id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO fills (
                    id, order_id, fill_number,
                    price, quantity, size_dollars,
                    fee_dollars, slippage_bps, liquidity_consumed,
                    trade_id, is_paper, user_id, created_at
                ) VALUES (
                    %(id)s, %(order_id)s, %(fill_number)s,
                    %(price)s, %(quantity)s, %(size_dollars)s,
                    %(fee_dollars)s, %(slippage_bps)s, %(liquidity_consumed)s,
                    %(trade_id)s, %(is_paper)s, %(user_id)s, %(created_at)s
                )
                """,
                {
                    "id": getattr(fill, "id"),
                    "order_id": getattr(fill, "order_id"),
                    "fill_number": getattr(fill, "fill_number"),
                    "price": getattr(fill, "price"),
                    "quantity": getattr(fill, "quantity"),
                    "size_dollars": getattr(fill, "size_dollars"),
                    "fee_dollars": getattr(fill, "fee_dollars"),
                    "slippage_bps": getattr(fill, "slippage_bps"),
                    "liquidity_consumed": getattr(fill, "liquidity_consumed"),
                    "trade_id": getattr(fill, "trade_id"),
                    "is_paper": getattr(fill, "is_paper"),
                    "user_id": getattr(fill, "user_id"),
                    "created_at": getattr(fill, "created_at"),
                },
            )
        conn.commit()
        return getattr(fill, "id")

    def update_order_status(
        self,
        order_id: str,
        status: str,
        filled_size_dollars: float = 0.0,
        filled_quantity: float = 0.0,
        fill_count: int = 0,
        avg_fill_price: float | None = None,
        slippage_bps: float | None = None,
        fees_dollars: float = 0.0,
        expired_at: object = None,
    ) -> None:
        """Update an order's status and fill aggregates."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE orders
                SET status = %(status)s,
                    filled_size_dollars = %(filled_size_dollars)s,
                    filled_quantity = %(filled_quantity)s,
                    fill_count = %(fill_count)s,
                    avg_fill_price = %(avg_fill_price)s,
                    slippage_bps = %(slippage_bps)s,
                    fees_dollars = %(fees_dollars)s,
                    expired_at = %(expired_at)s,
                    updated_at = now()
                WHERE id = %(id)s
                """,
                {
                    "id": order_id,
                    "status": status,
                    "filled_size_dollars": filled_size_dollars,
                    "filled_quantity": filled_quantity,
                    "fill_count": fill_count,
                    "avg_fill_price": avg_fill_price,
                    "slippage_bps": slippage_bps,
                    "fees_dollars": fees_dollars,
                    "expired_at": expired_at,
                },
            )
        conn.commit()

    def update_fill_trade_id(self, fill_id: str, trade_id: str) -> None:
        """Link a fill to a legacy trade row."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE fills SET trade_id = %(trade_id)s WHERE id = %(id)s",
                {"id": fill_id, "trade_id": trade_id},
            )
        conn.commit()

    def get_recent_orders(
        self, limit: int = 50, status: str | None = None,
    ) -> list[dict]:
        """Return recent orders, optionally filtered by status."""
        if status:
            return self._fetch_dicts(
                f"SELECT * FROM orders WHERE status = %(status)s{self._user_filter()} "
                "ORDER BY created_at DESC LIMIT %(limit)s",
                {"status": status, "limit": limit, **self._uid_params},
            )
        return self._fetch_dicts(
            f"SELECT * FROM orders WHERE 1=1{self._user_filter()} "
            "ORDER BY created_at DESC LIMIT %(limit)s",
            {"limit": limit, **self._uid_params},
        )

    def get_fills_for_order(self, order_id: str) -> list[dict]:
        """Return all fills for a given order."""
        return self._fetch_dicts(
            "SELECT * FROM fills WHERE order_id = %(order_id)s "
            "ORDER BY fill_number",
            {"order_id": order_id},
        )

    def get_recent_fills(self, limit: int = 50) -> list[dict]:
        """Return recent fills joined with order fields."""
        uf = self._user_filter().replace("user_id", "f.user_id") if self._user_id else ""
        return self._fetch_dicts(
            f"""
            SELECT f.*, o.ticker, o.venue, o.side, o.event_ticker,
                   o.requested_price
            FROM fills f
            JOIN orders o ON f.order_id = o.id
            WHERE 1=1{uf}
            ORDER BY f.created_at DESC
            LIMIT %(limit)s
            """,
            {"limit": limit, **self._uid_params},
        )

    def get_decision_with_reasons(self, decision_id: int) -> dict | None:
        """Return a decision with full guard results and signal features."""
        rows = self._fetch_dicts(
            """
            SELECT d.*, s.ticker, s.event_ticker, s.edge_pct, s.signal_type,
                   s.confidence_score, s.features_json, s.roi_per_day,
                   s.time_to_resolution_days
            FROM decisions d
            JOIN signals s ON d.signal_id = s.id
            WHERE d.id = %(id)s
            """,
            {"id": decision_id},
        )
        return rows[0] if rows else None

    def get_execution_stats(self) -> dict:
        """Aggregate execution statistics across all orders."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT
                    COUNT(*) AS total_orders,
                    COUNT(*) FILTER (WHERE status = 'filled') AS filled,
                    COUNT(*) FILTER (WHERE status = 'partial') AS partial,
                    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                    COALESCE(AVG(slippage_bps) FILTER (WHERE slippage_bps IS NOT NULL), 0)
                        AS avg_slippage_bps,
                    COALESCE(SUM(fees_dollars), 0) AS total_fees
                FROM orders
                WHERE 1=1{self._user_filter()}
            """, self._uid_params)
            row = cur.fetchone()

        if row is None:
            return {
                "total_orders": 0, "filled": 0, "partial": 0,
                "cancelled": 0, "avg_slippage_bps": 0.0, "total_fees": 0.0,
            }

        return {
            "total_orders": row[0],
            "filled": row[1],
            "partial": row[2],
            "cancelled": row[3],
            "avg_slippage_bps": round(float(row[4]), 2),
            "total_fees": round(float(row[5]), 4),
        }

    # -- Polymarket credentials --

    def upsert_polymarket_connection(self, wallet_address: str, user_id: str) -> int:
        """Insert or update a polymarket wallet connection. Returns row id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO polymarket_credentials (wallet_address, user_id)
                VALUES (%(wallet_address)s, %(user_id)s)
                ON CONFLICT (user_id, wallet_address) DO UPDATE
                    SET updated_at = now()
                RETURNING id
                """,
                {"wallet_address": wallet_address, "user_id": user_id},
            )
            row = cur.fetchone()
            assert row is not None
            row_id: int = row[0]
        conn.commit()
        return row_id

    def get_polymarket_connection(self, user_id: str) -> dict | None:
        """Return the polymarket connection for a user, or None."""
        rows = self._fetch_dicts(
            "SELECT * FROM polymarket_credentials "
            "WHERE user_id = %(user_id)s "
            "ORDER BY updated_at DESC LIMIT 1",
            {"user_id": user_id},
        )
        return rows[0] if rows else None

    def update_polymarket_l2_creds(
        self,
        wallet_address: str,
        user_id: str,
        api_key_enc: str,
        api_secret_enc: str,
        passphrase_enc: str,
    ) -> None:
        """Store encrypted L2 credentials for a connected wallet."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE polymarket_credentials
                SET api_key_enc = %(api_key_enc)s,
                    api_secret_enc = %(api_secret_enc)s,
                    passphrase_enc = %(passphrase_enc)s,
                    updated_at = now()
                WHERE wallet_address = %(wallet_address)s
                  AND user_id = %(user_id)s
                """,
                {
                    "wallet_address": wallet_address,
                    "user_id": user_id,
                    "api_key_enc": api_key_enc,
                    "api_secret_enc": api_secret_enc,
                    "passphrase_enc": passphrase_enc,
                },
            )
        conn.commit()

    # -- Market mappings --

    def upsert_market_mapping(
        self,
        kalshi_ticker: str,
        polymarket_token_id_yes: str,
        title: str,
        match_confidence: float,
    ) -> int:
        """Create or update a market mapping. Returns the mapping id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO market_mappings (
                    kalshi_ticker, polymarket_token_id_yes, title, match_confidence
                ) VALUES (
                    %(kalshi_ticker)s, %(polymarket_token_id_yes)s,
                    %(title)s, %(match_confidence)s
                )
                ON CONFLICT (kalshi_ticker, polymarket_token_id_yes) DO UPDATE
                    SET title = EXCLUDED.title,
                        match_confidence = EXCLUDED.match_confidence,
                        updated_at = now()
                RETURNING id
                """,
                {
                    "kalshi_ticker": kalshi_ticker,
                    "polymarket_token_id_yes": polymarket_token_id_yes,
                    "title": title,
                    "match_confidence": match_confidence,
                },
            )
            row = cur.fetchone()
            assert row is not None
            mapping_id: int = row[0]
        conn.commit()
        return mapping_id

    def get_active_mappings(self, limit: int = 100) -> list[dict]:
        """Return all active market mappings."""
        return self._fetch_dicts(
            "SELECT * FROM market_mappings WHERE active = TRUE "
            "ORDER BY updated_at DESC LIMIT %(limit)s",
            {"limit": limit},
        )

    # -- Arb signals --

    def save_arb_signal(
        self,
        mapping_id: int,
        kalshi_bid: float,
        kalshi_ask: float,
        poly_bid: float,
        poly_ask: float,
        edge_kp: float,
        edge_pk: float,
        liquidity_notes: str | None = None,
    ) -> int:
        """Insert an arb signal row. Returns the generated id."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO arb_signals (
                    mapping_id, kalshi_bid, kalshi_ask,
                    poly_bid, poly_ask,
                    edge_kalshi_to_poly, edge_poly_to_kalshi,
                    liquidity_notes
                ) VALUES (
                    %(mapping_id)s, %(kalshi_bid)s, %(kalshi_ask)s,
                    %(poly_bid)s, %(poly_ask)s,
                    %(edge_kp)s, %(edge_pk)s,
                    %(liquidity_notes)s
                )
                RETURNING id
                """,
                {
                    "mapping_id": mapping_id,
                    "kalshi_bid": kalshi_bid,
                    "kalshi_ask": kalshi_ask,
                    "poly_bid": poly_bid,
                    "poly_ask": poly_ask,
                    "edge_kp": edge_kp,
                    "edge_pk": edge_pk,
                    "liquidity_notes": liquidity_notes,
                },
            )
            row = cur.fetchone()
            assert row is not None
            signal_id: int = row[0]
        conn.commit()
        return signal_id

    def get_recent_arb_signals(
        self, limit: int = 50, min_edge: float = 0.0,
    ) -> list[dict]:
        """Return recent arb signals joined with market mapping titles."""
        return self._fetch_dicts(
            """
            SELECT
                a.id, a.mapping_id, a.ts,
                a.kalshi_bid, a.kalshi_ask,
                a.poly_bid, a.poly_ask,
                a.edge_kalshi_to_poly, a.edge_poly_to_kalshi,
                a.liquidity_notes,
                m.kalshi_ticker, m.polymarket_token_id_yes,
                m.title, m.match_confidence
            FROM arb_signals a
            JOIN market_mappings m ON a.mapping_id = m.id
            WHERE GREATEST(a.edge_kalshi_to_poly, a.edge_poly_to_kalshi) >= %(min_edge)s
            ORDER BY a.ts DESC
            LIMIT %(limit)s
            """,
            {"limit": limit, "min_edge": min_edge},
        )

    # -- Discrepancy analytics --

    def save_discrepancy_batch(self, rows: list[dict]) -> int:
        """Batch-insert discrepancy observations. Returns count inserted."""
        if not rows:
            return 0
        conn = self._ensure_connected()
        sql = """
            INSERT INTO discrepancy_log (
                kalshi_ticker, poly_ticker,
                kalshi_yes_bid, kalshi_yes_ask,
                poly_yes_bid, poly_yes_ask,
                mid_discrepancy, gross_edge, net_edge, edge_pct,
                favored_venue, match_confidence,
                trigger_source, actionable
            ) VALUES (
                %(kalshi_ticker)s, %(poly_ticker)s,
                %(kalshi_yes_bid)s, %(kalshi_yes_ask)s,
                %(poly_yes_bid)s, %(poly_yes_ask)s,
                %(mid_discrepancy)s, %(gross_edge)s, %(net_edge)s, %(edge_pct)s,
                %(favored_venue)s, %(match_confidence)s,
                %(trigger_source)s, %(actionable)s
            )
        """
        with conn.cursor() as cur:
            cur.executemany(sql, rows)
        conn.commit()
        return len(rows)

    def get_discrepancy_summary(self, hours: int = 24) -> list[dict]:
        """Per-pair discrepancy stats over the last N hours."""
        return self._fetch_dicts(
            """
            SELECT
                kalshi_ticker,
                COUNT(*) AS observations,
                AVG(mid_discrepancy) AS avg_discrepancy,
                MAX(mid_discrepancy) AS max_discrepancy,
                AVG(edge_pct) AS avg_edge_pct,
                MAX(edge_pct) AS max_edge_pct,
                SUM(actionable::int) AS actionable_count
            FROM discrepancy_log
            WHERE ts >= now() - make_interval(hours => %(hours)s)
            GROUP BY kalshi_ticker
            ORDER BY observations DESC
            """,
            {"hours": hours},
        )

    def get_discrepancy_distribution(self, hours: int = 24) -> list[dict]:
        """Edge percent histogram in 0.5% buckets."""
        return self._fetch_dicts(
            """
            SELECT
                FLOOR(edge_pct * 2) / 2 AS bucket,
                COUNT(*) AS count,
                SUM(actionable::int) AS actionable
            FROM discrepancy_log
            WHERE ts >= now() - make_interval(hours => %(hours)s)
            GROUP BY bucket
            ORDER BY bucket
            """,
            {"hours": hours},
        )

    def get_discrepancy_hourly(self, hours: int = 24) -> list[dict]:
        """Observations and edge stats by hour of day (UTC)."""
        return self._fetch_dicts(
            """
            SELECT
                EXTRACT(HOUR FROM ts)::int AS hour,
                COUNT(*) AS observations,
                AVG(edge_pct) AS avg_edge,
                MAX(edge_pct) AS max_edge,
                SUM(actionable::int) AS actionable
            FROM discrepancy_log
            WHERE ts >= now() - make_interval(hours => %(hours)s)
            GROUP BY hour
            ORDER BY hour
            """,
            {"hours": hours},
        )

    def get_discrepancy_by_trigger(self, hours: int = 24) -> list[dict]:
        """Stats grouped by trigger source (kalshi_ws vs poly_ws)."""
        return self._fetch_dicts(
            """
            SELECT
                trigger_source,
                COUNT(*) AS observations,
                AVG(edge_pct) AS avg_edge,
                MAX(edge_pct) AS max_edge,
                SUM(actionable::int) AS actionable
            FROM discrepancy_log
            WHERE ts >= now() - make_interval(hours => %(hours)s)
            GROUP BY trigger_source
            ORDER BY observations DESC
            """,
            {"hours": hours},
        )

    def get_recent_snapshots_for_ticker(
        self, ticker: str, limit: int = 10,
    ) -> list[NormalizedMarket]:
        """Fetch the most recent snapshots for a ticker, for feature extraction.

        Used by the scoring pipeline to compute rolling volatility.
        """
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    ticker, event_ticker, market_type, title, status,
                    yes_bid, yes_ask, no_bid, no_ask,
                    volume, volume_24h, liquidity, open_interest, notional_value,
                    close_time, expected_expiration, snapshot_ts, venue
                FROM market_snapshots
                WHERE ticker = %(ticker)s
                ORDER BY snapshot_ts DESC
                LIMIT %(limit)s
                """,
                {"ticker": ticker, "limit": limit},
            )
            rows = cur.fetchall()

        markets: list[NormalizedMarket] = []
        for r in rows:
            try:
                markets.append(NormalizedMarket(
                    ticker=r[0],
                    event_ticker=r[1],
                    market_type=MarketType(r[2]) if r[2] else MarketType.BINARY,
                    title=r[3] or "",
                    subtitle="",
                    status=MarketStatus(r[4]) if r[4] else MarketStatus.ACTIVE,
                    yes_bid=float(r[5]),
                    yes_ask=float(r[6]),
                    no_bid=float(r[7]),
                    no_ask=float(r[8]),
                    volume=float(r[9]),
                    volume_24h=float(r[10]),
                    liquidity=float(r[11]),
                    open_interest=float(r[12]),
                    notional_value=float(r[13]),
                    close_time=r[14],
                    expected_expiration=r[15],
                    venue=r[17] or "kalshi",
                ))
            except (ValueError, TypeError):
                continue
        return markets

    # ── Automation state ────────────────────────────────────────────

    def _row_to_automation_state(self, row: tuple) -> dict:
        """Convert a raw automation_state DB row to a dict."""
        return {
            "id": row[0],
            "status": row[1],
            "kill_switch": row[2],
            "killed_reason": row[3],
            "started_at": row[4].isoformat() if row[4] else None,
            "paused_at": row[5].isoformat() if row[5] else None,
            "killed_at": row[6].isoformat() if row[6] else None,
            "daily_loss_dollars": float(row[7]),
            "daily_loss_reset_at": row[8].isoformat() if row[8] else None,
            "peak_portfolio_value": float(row[9]),
            "max_drawdown_dollars": float(row[10]),
            "updated_at": row[11].isoformat() if row[11] else None,
        }

    _AUTOMATION_COLS = """
        id, status, kill_switch, killed_reason,
        started_at, paused_at, killed_at,
        daily_loss_dollars, daily_loss_reset_at,
        peak_portfolio_value, max_drawdown_dollars,
        updated_at
    """

    def get_automation_state(self) -> dict | None:
        """Return the automation state row (scoped by user_id when set)."""
        conn = self._ensure_connected()
        try:
            if self._user_id:
                sql = (
                    f"SELECT {self._AUTOMATION_COLS} FROM automation_state "
                    "WHERE user_id = %(uid)s LIMIT 1"
                )
                params = {"uid": self._user_id}
            else:
                sql = f"SELECT {self._AUTOMATION_COLS} FROM automation_state ORDER BY id LIMIT 1"
                params = {}
            with conn.cursor() as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
            conn.commit()
        except Exception:
            self._safe_rollback()
            return None
        if row is None:
            return None
        return self._row_to_automation_state(row)

    def update_automation_state(
        self,
        status: str,
        reason: str | None = None,
    ) -> dict:
        """Update the automation state and return the updated row."""
        conn = self._ensure_connected()

        set_parts = ["status = %(status)s", "updated_at = NOW()"]
        params: dict = {"status": status, **self._uid_params}

        if status == "running":
            set_parts += [
                "started_at = NOW()", "paused_at = NULL",
                "killed_at = NULL", "kill_switch = FALSE", "killed_reason = NULL",
            ]
        elif status == "paused":
            set_parts.append("paused_at = NOW()")
            if reason:
                set_parts.append("killed_reason = %(reason)s")
                params["reason"] = reason
        elif status == "killed":
            set_parts += [
                "killed_at = NOW()", "kill_switch = TRUE",
                "killed_reason = %(reason)s",
            ]
            params["reason"] = reason

        if self._user_id:
            where = "WHERE user_id = %(uid)s"
        else:
            where = "WHERE id = (SELECT id FROM automation_state ORDER BY id LIMIT 1)"

        sql = f"""
            UPDATE automation_state
            SET {', '.join(set_parts)}
            {where}
            RETURNING {self._AUTOMATION_COLS}
        """
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
            conn.commit()
        except Exception:
            self._safe_rollback()
            raise

        if row is None:
            raise ValueError("No automation_state row found")
        return self._row_to_automation_state(row)

    def update_automation_metrics(
        self,
        daily_loss: float,
        peak_value: float,
        max_drawdown: float,
    ) -> None:
        """Update the risk metrics on the automation state row."""
        conn = self._ensure_connected()
        if self._user_id:
            where = "WHERE user_id = %(uid)s"
        else:
            where = "WHERE id = (SELECT id FROM automation_state ORDER BY id LIMIT 1)"
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE automation_state
                    SET daily_loss_dollars = %(daily_loss)s,
                        peak_portfolio_value = %(peak_value)s,
                        max_drawdown_dollars = %(max_drawdown)s,
                        updated_at = NOW()
                    {where}
                    """,
                    {
                        "daily_loss": daily_loss,
                        "peak_value": peak_value,
                        "max_drawdown": max_drawdown,
                        **self._uid_params,
                    },
                )
            conn.commit()
        except Exception:
            self._safe_rollback()
            logger.warning("Failed to update automation metrics", exc_info=True)

    # ------------------------------------------------------------------
    # Performance Fees
    # ------------------------------------------------------------------

    def get_user_fee_state(self, user_id: str) -> dict | None:
        """Return the fee state row for a user, or None if not found."""
        rows = self._fetch_dicts(
            "SELECT * FROM user_fee_state WHERE user_id = %(user_id)s",
            {"user_id": user_id},
        )
        return rows[0] if rows else None

    def upsert_user_fee_state(
        self,
        user_id: str,
        high_water_mark: float,
        cumulative_realized_pnl: float,
        total_fees_accrued: float,
        current_tier: str,
    ) -> int:
        """Create or update fee state for a user. Returns the row id."""
        conn = self._ensure_connected()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_fee_state (
                        user_id, high_water_mark, cumulative_realized_pnl,
                        total_fees_accrued, current_tier
                    ) VALUES (
                        %(user_id)s, %(hwm)s, %(cum_pnl)s,
                        %(fees)s, %(tier)s
                    )
                    ON CONFLICT (user_id) DO UPDATE SET
                        high_water_mark = %(hwm)s,
                        cumulative_realized_pnl = %(cum_pnl)s,
                        total_fees_accrued = %(fees)s,
                        current_tier = %(tier)s,
                        updated_at = now()
                    RETURNING id
                    """,
                    {
                        "user_id": user_id,
                        "hwm": high_water_mark,
                        "cum_pnl": cumulative_realized_pnl,
                        "fees": total_fees_accrued,
                        "tier": current_tier,
                    },
                )
                row = cur.fetchone()
                assert row is not None
                row_id: int = row[0]
            conn.commit()
        except Exception:
            self._safe_rollback()
            raise
        return row_id

    def append_fee_ledger(
        self,
        user_id: str,
        position_id: str,
        realized_pnl_delta: float,
        cumulative_pnl_before: float,
        cumulative_pnl_after: float,
        hwm_before: float,
        hwm_after: float,
        fee_rate: float,
        fee_amount: float,
        tier_at_time: str,
        notes: str | None = None,
    ) -> int:
        """Append an immutable fee ledger entry. Returns the row id."""
        conn = self._ensure_connected()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO fee_ledger (
                        user_id, position_id, realized_pnl_delta,
                        cumulative_pnl_before, cumulative_pnl_after,
                        hwm_before, hwm_after,
                        fee_rate, fee_amount, tier_at_time, notes
                    ) VALUES (
                        %(user_id)s, %(position_id)s, %(realized_pnl_delta)s,
                        %(cum_before)s, %(cum_after)s,
                        %(hwm_before)s, %(hwm_after)s,
                        %(fee_rate)s, %(fee_amount)s, %(tier)s, %(notes)s
                    )
                    RETURNING id
                    """,
                    {
                        "user_id": user_id,
                        "position_id": position_id,
                        "realized_pnl_delta": realized_pnl_delta,
                        "cum_before": cumulative_pnl_before,
                        "cum_after": cumulative_pnl_after,
                        "hwm_before": hwm_before,
                        "hwm_after": hwm_after,
                        "fee_rate": fee_rate,
                        "fee_amount": fee_amount,
                        "tier": tier_at_time,
                        "notes": notes,
                    },
                )
                row = cur.fetchone()
                assert row is not None
                ledger_id: int = row[0]
            conn.commit()
        except Exception:
            self._safe_rollback()
            raise
        return ledger_id

    def get_fee_ledger(self, user_id: str, limit: int = 50) -> list[dict]:
        """Return recent fee ledger entries for a user."""
        return self._fetch_dicts(
            "SELECT * FROM fee_ledger "
            "WHERE user_id = %(user_id)s "
            "ORDER BY created_at DESC LIMIT %(limit)s",
            {"user_id": user_id, "limit": limit},
        )

    def get_fee_summary(self, user_id: str) -> dict:
        """Return aggregate fee stats for a user."""
        rows = self._fetch_dicts(
            """
            SELECT
                COALESCE(SUM(fee_amount), 0) AS total_fees,
                COUNT(*) AS total_entries,
                COUNT(*) FILTER (WHERE fee_amount > 0) AS fee_events,
                COALESCE(MAX(hwm_after), 0) AS current_hwm,
                COALESCE(
                    (SELECT cumulative_pnl_after FROM fee_ledger
                     WHERE user_id = %(user_id)s
                     ORDER BY created_at DESC LIMIT 1),
                    0
                ) AS current_cumulative_pnl
            FROM fee_ledger
            WHERE user_id = %(user_id)s
            """,
            {"user_id": user_id},
        )
        return rows[0] if rows else {
            "total_fees": 0.0,
            "total_entries": 0,
            "fee_events": 0,
            "current_hwm": 0.0,
            "current_cumulative_pnl": 0.0,
        }

    def settle_pending_fees(self, user_id: str) -> float:
        """Mark accrued fees as settled (billed via Stripe).

        Returns the amount that was settled (accrued - previously settled).
        """
        state = self.get_user_fee_state(user_id)
        if state is None:
            return 0.0

        accrued = float(state["total_fees_accrued"])
        settled = float(state.get("total_fees_settled", 0.0))
        pending = round(accrued - settled, 4)

        if pending <= 0:
            return 0.0

        conn = self._ensure_connected()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE user_fee_state
                    SET total_fees_settled = total_fees_accrued,
                        updated_at = now()
                    WHERE user_id = %(user_id)s
                    """,
                    {"user_id": user_id},
                )
            conn.commit()
        except Exception:
            self._safe_rollback()
            raise

        return pending

    # ── Pipeline Logs ──────────────────────────────────────────────────

    _LOG_BATCH_SIZE = 20

    def save_pipeline_log(
        self,
        level: str,
        category: str,
        message: str,
        details: dict | None = None,
    ) -> None:
        """Buffer a pipeline log entry; auto-flushes at batch threshold."""
        if not hasattr(self, "_log_batch"):
            self._log_batch: list[tuple] = []
        self._log_batch.append((
            self._user_id, level, category, message, json.dumps(details or {}),
        ))
        if len(self._log_batch) >= self._LOG_BATCH_SIZE:
            self.flush_pipeline_logs()

    def flush_pipeline_logs(self) -> None:
        """Write all buffered pipeline logs in a single transaction."""
        batch = getattr(self, "_log_batch", None)
        if not batch:
            return
        conn = self._ensure_connected()
        try:
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO pipeline_logs (user_id, level, category, message, details) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    batch,
                )
            conn.commit()
        except Exception:
            self._safe_rollback()
            logger.debug("Failed to flush %d pipeline logs", len(batch), exc_info=True)
        self._log_batch.clear()

    def get_pipeline_logs(self, limit: int = 100) -> list[dict]:
        """Fetch recent pipeline logs (newest first)."""
        conn = self._ensure_connected()
        sql = (
            "SELECT id, level, category, message, details, created_at "
            "FROM pipeline_logs"
            + self._user_where()
            + " ORDER BY created_at DESC LIMIT %(limit)s"
        )
        return self._fetch_dicts(sql, {**self._uid_params, "limit": limit})

    # ── Market Browser ─────────────────────────────────────────────────

    def get_market_browser(
        self,
        limit: int = 100,
        venue: str | None = None,
        q: str | None = None,
    ) -> list[dict]:
        """Fetch distinct recent market snapshots for browsing."""
        conn = self._ensure_connected()
        conditions = []
        params: dict = {"limit": limit}

        if venue:
            conditions.append("venue = %(venue)s")
            params["venue"] = venue
        if q:
            conditions.append("title ILIKE %(q)s")
            params["q"] = f"%{q}%"

        where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

        sql = (
            "SELECT DISTINCT ON (ticker, venue) "
            "ticker, event_ticker, title, venue, yes_bid, yes_ask, no_bid, no_ask, "
            "volume, liquidity, snapshot_ts "
            "FROM market_snapshots"
            + where
            + " ORDER BY ticker, venue, snapshot_ts DESC "
            "LIMIT %(limit)s"
        )
        return self._fetch_dicts(sql, params)
