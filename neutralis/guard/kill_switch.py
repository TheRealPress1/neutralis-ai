"""Kill switch and automation state management.

Provides global pause/resume/kill controls that the Guard evaluator
checks before approving any trade. State is persisted in the
automation_state table.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from neutralis.logging import get_logger
from neutralis.models import AutomationStatus

logger = get_logger(__name__)


class KillSwitch:
    """Reads and mutates the automation_state row in Postgres."""

    def __init__(self, storage: object) -> None:
        self._storage = storage

    # -- Reads --

    def get_state(self) -> dict:
        """Return the current automation state as a dict."""
        from neutralis.storage.postgres import PostgresStorage
        storage: PostgresStorage = self._storage  # type: ignore[assignment]
        conn = storage._ensure_connected()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, status, kill_switch, killed_reason, "
                "paused_at, killed_at, started_at, "
                "daily_loss_dollars, daily_loss_reset_at, "
                "peak_portfolio_value, max_drawdown_dollars, updated_at "
                "FROM automation_state ORDER BY id LIMIT 1"
            )
            row = cur.fetchone()
        if row is None:
            return {
                "status": "paused",
                "kill_switch": False,
                "killed_reason": None,
                "daily_loss_dollars": 0.0,
                "peak_portfolio_value": 0.0,
                "max_drawdown_dollars": 0.0,
            }
        return {
            "id": row[0],
            "status": row[1],
            "kill_switch": row[2],
            "killed_reason": row[3],
            "paused_at": row[4].isoformat() if row[4] else None,
            "killed_at": row[5].isoformat() if row[5] else None,
            "started_at": row[6].isoformat() if row[6] else None,
            "daily_loss_dollars": float(row[7]),
            "daily_loss_reset_at": row[8].isoformat() if row[8] else None,
            "peak_portfolio_value": float(row[9]),
            "max_drawdown_dollars": float(row[10]),
            "updated_at": row[11].isoformat() if row[11] else None,
        }

    def is_active(self) -> bool:
        """Return True if automation is running (not paused or killed)."""
        state = self.get_state()
        return state["status"] == AutomationStatus.RUNNING.value and not state["kill_switch"]

    def is_killed(self) -> bool:
        state = self.get_state()
        return bool(state["kill_switch"])

    # -- Mutations --

    def start(self) -> dict:
        """Start/resume automation."""
        from neutralis.storage.postgres import PostgresStorage
        storage: PostgresStorage = self._storage  # type: ignore[assignment]
        conn = storage._ensure_connected()
        now = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE automation_state SET status = 'running', kill_switch = FALSE, "
                "killed_reason = NULL, started_at = %(now)s, updated_at = %(now)s "
                "WHERE id = (SELECT id FROM automation_state ORDER BY id LIMIT 1)",
                {"now": now},
            )
        conn.commit()
        logger.info("Automation started")
        return self.get_state()

    def pause(self) -> dict:
        """Pause automation (user-initiated, reversible)."""
        from neutralis.storage.postgres import PostgresStorage
        storage: PostgresStorage = self._storage  # type: ignore[assignment]
        conn = storage._ensure_connected()
        now = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE automation_state SET status = 'paused', paused_at = %(now)s, "
                "updated_at = %(now)s "
                "WHERE id = (SELECT id FROM automation_state ORDER BY id LIMIT 1)",
                {"now": now},
            )
        conn.commit()
        logger.info("Automation paused")
        return self.get_state()

    def kill(self, reason: str = "Manual kill switch") -> dict:
        """Trigger kill switch (emergency stop). Requires explicit restart."""
        from neutralis.storage.postgres import PostgresStorage
        storage: PostgresStorage = self._storage  # type: ignore[assignment]
        conn = storage._ensure_connected()
        now = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE automation_state SET status = 'killed', kill_switch = TRUE, "
                "killed_reason = %(reason)s, killed_at = %(now)s, updated_at = %(now)s "
                "WHERE id = (SELECT id FROM automation_state ORDER BY id LIMIT 1)",
                {"reason": reason, "now": now},
            )
        conn.commit()
        logger.warning("KILL SWITCH triggered: %s", reason)
        return self.get_state()

    def record_daily_loss(self, loss_dollars: float) -> None:
        """Accumulate daily realized loss. Resets daily."""
        from neutralis.storage.postgres import PostgresStorage
        storage: PostgresStorage = self._storage  # type: ignore[assignment]
        conn = storage._ensure_connected()
        now = datetime.now(timezone.utc)

        with conn.cursor() as cur:
            # Check if we need to reset (new day)
            cur.execute(
                "SELECT daily_loss_dollars, daily_loss_reset_at "
                "FROM automation_state ORDER BY id LIMIT 1"
            )
            row = cur.fetchone()
            if row is None:
                return

            current_loss = float(row[0])
            reset_at = row[1]

            # Reset if it's a new UTC day
            if reset_at and reset_at.date() < now.date():
                current_loss = 0.0
                cur.execute(
                    "UPDATE automation_state SET daily_loss_dollars = %(loss)s, "
                    "daily_loss_reset_at = %(now)s, updated_at = %(now)s "
                    "WHERE id = (SELECT id FROM automation_state ORDER BY id LIMIT 1)",
                    {"loss": abs(loss_dollars), "now": now},
                )
            else:
                new_total = current_loss + abs(loss_dollars)
                cur.execute(
                    "UPDATE automation_state SET daily_loss_dollars = %(loss)s, "
                    "updated_at = %(now)s "
                    "WHERE id = (SELECT id FROM automation_state ORDER BY id LIMIT 1)",
                    {"loss": new_total, "now": now},
                )
        conn.commit()

    def update_drawdown(self, portfolio_value: float) -> None:
        """Track peak portfolio value and max drawdown."""
        from neutralis.storage.postgres import PostgresStorage
        storage: PostgresStorage = self._storage  # type: ignore[assignment]
        conn = storage._ensure_connected()
        now = datetime.now(timezone.utc)

        with conn.cursor() as cur:
            cur.execute(
                "SELECT peak_portfolio_value, max_drawdown_dollars "
                "FROM automation_state ORDER BY id LIMIT 1"
            )
            row = cur.fetchone()
            if row is None:
                return

            peak = float(row[0])
            new_peak = max(peak, portfolio_value)
            drawdown = new_peak - portfolio_value
            max_dd = max(float(row[1]), drawdown)

            cur.execute(
                "UPDATE automation_state SET peak_portfolio_value = %(peak)s, "
                "max_drawdown_dollars = %(dd)s, updated_at = %(now)s "
                "WHERE id = (SELECT id FROM automation_state ORDER BY id LIMIT 1)",
                {"peak": new_peak, "dd": max_dd, "now": now},
            )
        conn.commit()

    def get_daily_loss(self) -> float:
        """Return the current day's accumulated loss."""
        state = self.get_state()
        return state.get("daily_loss_dollars", 0.0)
