"""Postgres storage using psycopg (sync) for Supabase direct connection."""

from __future__ import annotations

import json
from typing import Optional

import psycopg

from neutralis.config import DatabaseConfig
from neutralis.logging import get_logger
from neutralis.core.matcher import MarketPair
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
