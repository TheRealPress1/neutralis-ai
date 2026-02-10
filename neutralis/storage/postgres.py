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
    """Write-only storage for pipeline outputs."""

    def __init__(self, config: DatabaseConfig) -> None:
        self._dsn = config.dsn
        self._conn: Optional[psycopg.Connection] = None

    def connect(self) -> None:
        self._conn = psycopg.connect(self._dsn)
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
                    roi_per_day, features_json
                ) VALUES (
                    %(id)s, %(signal_type)s, %(ticker)s, %(event_ticker)s,
                    %(yes_ask)s, %(no_ask)s, %(combined_cost)s,
                    %(gross_edge)s, %(net_edge)s, %(edge_pct)s,
                    %(snapshot_id)s, %(created_at)s,
                    %(confidence_score)s, %(time_to_resolution_days)s,
                    %(roi_per_day)s, %(features_json)s::jsonb
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
                    selected, selection_score, allocation_reasons
                ) VALUES (
                    %(signal_id)s, %(verdict)s, %(guard_results)s::jsonb,
                    %(suggested_size)s, %(created_at)s,
                    %(selected)s, %(selection_score)s, %(allocation_reasons)s::jsonb
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
        "opened_at, closed_at, category, exit_reason, exit_price"
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
                    is_paper, created_at
                ) VALUES (
                    %(id)s, %(signal_id)s, %(decision_id)s, %(ticker)s, %(event_ticker)s,
                    %(venue)s, %(side)s, %(price)s, %(size_dollars)s, %(quantity)s,
                    %(is_paper)s, %(created_at)s
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
                    "created_at": trade.created_at,
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
                    opened_at, closed_at, category, exit_reason, exit_price
                ) VALUES (
                    %(id)s, %(ticker)s, %(event_ticker)s, %(venue)s, %(side)s, %(status)s,
                    %(entry_price)s, %(size_dollars)s, %(quantity)s,
                    %(realized_pnl)s, %(unrealized_pnl)s, %(trade_count)s,
                    %(opened_at)s, %(closed_at)s, %(category)s,
                    %(exit_reason)s, %(exit_price)s
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
        """Return all open positions."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {self._POSITION_COLS} FROM positions "
                "WHERE status = 'open' ORDER BY opened_at"
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
                "AND side = %(side)s AND status = 'open'",
                {"ticker": ticker, "venue": venue, "side": side.value},
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
                "WHERE event_ticker = %(event_ticker)s AND status = 'open'",
                {"event_ticker": event_ticker},
            )
            rows = cur.fetchall()
        return [self._row_to_position(row) for row in rows]

    def get_positions_by_ticker(self, ticker: str) -> list[Position]:
        """Return all open positions for a ticker."""
        conn = self._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {self._POSITION_COLS} FROM positions "
                "WHERE ticker = %(ticker)s AND status = 'open'",
                {"ticker": ticker},
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
            "SELECT * FROM signals ORDER BY created_at DESC LIMIT %(limit)s",
            {"limit": limit},
        )

    def get_recent_decisions(
        self, limit: int = 50, verdict: str | None = None,
    ) -> list[dict]:
        if verdict:
            return self._fetch_dicts(
                "SELECT d.*, s.ticker, s.edge_pct, s.signal_type "
                "FROM decisions d JOIN signals s ON d.signal_id = s.id "
                "WHERE d.verdict = %(verdict)s "
                "ORDER BY d.created_at DESC LIMIT %(limit)s",
                {"verdict": verdict, "limit": limit},
            )
        return self._fetch_dicts(
            "SELECT d.*, s.ticker, s.edge_pct, s.signal_type "
            "FROM decisions d JOIN signals s ON d.signal_id = s.id "
            "ORDER BY d.created_at DESC LIMIT %(limit)s",
            {"limit": limit},
        )

    def get_recent_trades(self, limit: int = 50) -> list[dict]:
        return self._fetch_dicts(
            "SELECT * FROM trades ORDER BY created_at DESC LIMIT %(limit)s",
            {"limit": limit},
        )

    def get_closed_positions(self, limit: int = 50) -> list[dict]:
        return self._fetch_dicts(
            "SELECT * FROM positions WHERE status = 'closed' "
            "ORDER BY closed_at DESC LIMIT %(limit)s",
            {"limit": limit},
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
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'open') AS open_positions,
                    COUNT(*) FILTER (WHERE status = 'closed') AS closed_positions,
                    COALESCE(SUM(size_dollars) FILTER (WHERE status = 'open'), 0) AS total_exposure,
                    COALESCE(SUM(realized_pnl) FILTER (WHERE status = 'closed'), 0) AS total_realized_pnl,
                    COUNT(*) FILTER (WHERE status = 'closed' AND realized_pnl > 0) AS wins,
                    COUNT(*) FILTER (WHERE status = 'closed' AND realized_pnl <= 0) AS losses
                FROM positions
            """)
            row = cur.fetchone()

            cur.execute("SELECT COUNT(*) FROM trades")
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
            """
            SELECT
                DATE(closed_at) AS date,
                SUM(realized_pnl) AS pnl,
                COUNT(*) AS trades,
                SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN realized_pnl <= 0 THEN 1 ELSE 0 END) AS losses
            FROM positions
            WHERE status = 'closed'
              AND closed_at >= now() - make_interval(days => %(days)s)
            GROUP BY DATE(closed_at)
            ORDER BY date
            """,
            {"days": days},
        )

    def get_category_breakdown(self) -> list[dict]:
        """P&L and trade counts per market category."""
        return self._fetch_dicts("""
            SELECT
                category,
                COUNT(*) AS total_trades,
                SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN realized_pnl <= 0 THEN 1 ELSE 0 END) AS losses,
                COALESCE(SUM(realized_pnl), 0) AS total_pnl,
                COALESCE(AVG(realized_pnl), 0) AS avg_pnl
            FROM positions
            WHERE status = 'closed'
            GROUP BY category
            ORDER BY total_pnl DESC
        """)

    def get_venue_breakdown(self) -> list[dict]:
        """P&L and trade counts per venue."""
        return self._fetch_dicts("""
            SELECT
                venue,
                COUNT(*) AS total_trades,
                SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN realized_pnl <= 0 THEN 1 ELSE 0 END) AS losses,
                COALESCE(SUM(realized_pnl), 0) AS total_pnl
            FROM positions
            WHERE status = 'closed'
            GROUP BY venue
        """)

    def get_analytics_summary(self) -> dict:
        """Aggregate analytics: total P&L, best/worst day, max drawdown, avg trade."""
        rows = self._fetch_dicts("""
            WITH daily AS (
                SELECT DATE(closed_at) AS d, SUM(realized_pnl) AS pnl
                FROM positions WHERE status = 'closed'
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
                (SELECT COALESCE(SUM(realized_pnl), 0) FROM positions WHERE status = 'closed')
                    AS total_pnl,
                (SELECT COUNT(*) FROM positions WHERE status = 'closed')
                    AS total_closed,
                (SELECT COALESCE(MAX(pnl), 0) FROM daily) AS best_day,
                (SELECT COALESCE(MIN(pnl), 0) FROM daily) AS worst_day,
                (SELECT COALESCE(MIN(dd), 0) FROM drawdown) AS max_drawdown,
                (SELECT COALESCE(AVG(realized_pnl), 0) FROM positions WHERE status = 'closed')
                    AS avg_trade_pnl,
                (SELECT COALESCE(AVG(realized_pnl), 0) FROM positions
                    WHERE status = 'closed' AND realized_pnl > 0) AS avg_win,
                (SELECT COALESCE(ABS(AVG(realized_pnl)), 0) FROM positions
                    WHERE status = 'closed' AND realized_pnl <= 0) AS avg_loss
        """)
        return rows[0] if rows else {}

    def get_pnl_distribution(self, bucket_size: float = 5.0) -> list[dict]:
        """Histogram of realized P&L values."""
        return self._fetch_dicts(
            """
            SELECT
                FLOOR(realized_pnl / %(bucket)s) * %(bucket)s AS bucket_start,
                COUNT(*) AS count
            FROM positions
            WHERE status = 'closed'
            GROUP BY bucket_start
            ORDER BY bucket_start
            """,
            {"bucket": bucket_size},
        )

    def get_guard_effectiveness(self) -> list[dict]:
        """Rejection rate per guard name from decisions."""
        return self._fetch_dicts("""
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
            GROUP BY g->>'guard_name'
            ORDER BY rejections DESC
        """)

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
        params: dict = {"limit": limit, "min_confidence": min_confidence}

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
