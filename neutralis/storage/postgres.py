"""Postgres storage using psycopg (sync) for Supabase direct connection."""

from __future__ import annotations

import json
from typing import Optional

import psycopg

from neutralis.config import DatabaseConfig
from neutralis.logging import get_logger
from neutralis.models import Decision, NormalizedMarket, Signal

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
                    ob_no_best_bid, ob_no_best_bid_qty
                ) VALUES (
                    %(ticker)s, %(event_ticker)s, %(market_type)s, %(title)s, %(status)s,
                    %(yes_bid)s, %(yes_ask)s, %(no_bid)s, %(no_ask)s,
                    %(volume)s, %(volume_24h)s, %(liquidity)s, %(open_interest)s,
                    %(notional_value)s,
                    %(close_time)s, %(expected_expiration)s, %(snapshot_ts)s,
                    %(ob_yes_best_bid)s, %(ob_yes_best_bid_qty)s,
                    %(ob_no_best_bid)s, %(ob_no_best_bid_qty)s
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

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO signals (
                    id, signal_type, ticker, event_ticker,
                    yes_ask, no_ask, combined_cost,
                    gross_edge, net_edge, edge_pct,
                    snapshot_id, created_at
                ) VALUES (
                    %(id)s, %(signal_type)s, %(ticker)s, %(event_ticker)s,
                    %(yes_ask)s, %(no_ask)s, %(combined_cost)s,
                    %(gross_edge)s, %(net_edge)s, %(edge_pct)s,
                    %(snapshot_id)s, %(created_at)s
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
                },
            )
        conn.commit()
        return signal.id

    def save_decision(self, decision: Decision) -> None:
        """Insert a decision row."""
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

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO decisions (
                    signal_id, verdict, guard_results,
                    suggested_size, created_at
                ) VALUES (
                    %(signal_id)s, %(verdict)s, %(guard_results)s::jsonb,
                    %(suggested_size)s, %(created_at)s
                )
                """,
                {
                    "signal_id": decision.signal_id,
                    "verdict": decision.verdict.value,
                    "guard_results": guard_results_json,
                    "suggested_size": decision.suggested_size_dollars,
                    "created_at": decision.created_at,
                },
            )
        conn.commit()
