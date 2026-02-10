"""Audit logging service -- records all pipeline events for traceability.

Every significant action (signal generation, risk decision, trade execution,
position changes, automation state changes) is recorded with full context.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from neutralis.logging import get_logger

logger = get_logger(__name__)


class AuditLogger:
    """Writes structured audit events to the audit_logs table."""

    def __init__(self, storage: object) -> None:
        self._storage = storage

    def _log(
        self,
        event_type: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Insert an audit log entry."""
        from neutralis.storage.postgres import PostgresStorage
        storage: PostgresStorage = self._storage  # type: ignore[assignment]

        try:
            conn = storage._ensure_connected()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_logs (event_type, entity_type, entity_id, details)
                    VALUES (%(event_type)s, %(entity_type)s, %(entity_id)s, %(details)s::jsonb)
                    """,
                    {
                        "event_type": event_type,
                        "entity_type": entity_type,
                        "entity_id": str(entity_id) if entity_id else None,
                        "details": json.dumps(details or {}, default=str),
                    },
                )
            conn.commit()
        except Exception:
            logger.warning("Failed to write audit log: %s", event_type, exc_info=True)

    # -- Signal events --

    def signal_generated(
        self,
        signal_id: str,
        signal_type: str,
        ticker: str,
        edge_pct: float,
        venue: str = "kalshi",
    ) -> None:
        self._log(
            "signal_generated",
            entity_type="signal",
            entity_id=signal_id,
            details={
                "signal_type": signal_type,
                "ticker": ticker,
                "edge_pct": edge_pct,
                "venue": venue,
            },
        )

    # -- Risk decision events --

    def risk_decision(
        self,
        signal_id: str,
        verdict: str,
        suggested_size: float,
        guard_results: list[dict],
    ) -> None:
        self._log(
            "risk_decision",
            entity_type="decision",
            entity_id=signal_id,
            details={
                "verdict": verdict,
                "suggested_size": suggested_size,
                "guard_count": len(guard_results),
                "passed": sum(1 for g in guard_results if g.get("passed")),
                "failed": [g["guard_name"] for g in guard_results if not g.get("passed")],
            },
        )

    # -- Trade/fill events --

    def fill_recorded(
        self,
        trade_id: str,
        signal_id: str,
        ticker: str,
        side: str,
        venue: str,
        size_dollars: float,
        price: float,
    ) -> None:
        self._log(
            "fill_recorded",
            entity_type="trade",
            entity_id=trade_id,
            details={
                "signal_id": signal_id,
                "ticker": ticker,
                "side": side,
                "venue": venue,
                "size_dollars": size_dollars,
                "price": price,
            },
        )

    # -- Position events --

    def position_opened(
        self,
        position_id: str,
        ticker: str,
        side: str,
        venue: str,
        entry_price: float,
        size_dollars: float,
    ) -> None:
        self._log(
            "position_opened",
            entity_type="position",
            entity_id=position_id,
            details={
                "ticker": ticker,
                "side": side,
                "venue": venue,
                "entry_price": entry_price,
                "size_dollars": size_dollars,
            },
        )

    def position_closed(
        self,
        position_id: str,
        ticker: str,
        realized_pnl: float,
        result: str,
    ) -> None:
        self._log(
            "position_closed",
            entity_type="position",
            entity_id=position_id,
            details={
                "ticker": ticker,
                "realized_pnl": realized_pnl,
                "result": result,
            },
        )

    # -- Automation state events --

    def automation_started(self) -> None:
        self._log("automation_started", entity_type="automation")

    def automation_paused(self) -> None:
        self._log("automation_paused", entity_type="automation")

    def kill_switch_triggered(self, reason: str) -> None:
        self._log(
            "kill_switch_triggered",
            entity_type="automation",
            details={"reason": reason},
        )

    def kill_switch_auto_triggered(self, reason: str, trigger_value: float, threshold: float) -> None:
        self._log(
            "kill_switch_triggered",
            entity_type="automation",
            details={
                "reason": reason,
                "auto": True,
                "trigger_value": trigger_value,
                "threshold": threshold,
            },
        )

    # -- Profile events --

    def profile_changed(self, profile_id: int, changes: dict) -> None:
        self._log(
            "profile_changed",
            entity_type="profile",
            entity_id=str(profile_id),
            details=changes,
        )

    def profile_activated(self, profile_id: int, profile_name: str) -> None:
        self._log(
            "profile_activated",
            entity_type="profile",
            entity_id=str(profile_id),
            details={"name": profile_name},
        )

    # -- Settlement events --

    def settlement(
        self,
        position_id: str,
        ticker: str,
        result: str,
        realized_pnl: float,
    ) -> None:
        self._log(
            "settlement",
            entity_type="position",
            entity_id=position_id,
            details={
                "ticker": ticker,
                "result": result,
                "realized_pnl": realized_pnl,
            },
        )

    # -- Pipeline events --

    def pipeline_run_complete(self, stats: dict) -> None:
        self._log(
            "pipeline_run_complete",
            entity_type="automation",
            details=stats,
        )
