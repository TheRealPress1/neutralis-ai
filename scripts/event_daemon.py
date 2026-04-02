#!/usr/bin/env python3
"""Event-driven daemon — WebSocket-powered real-time arb detection.

Usage:
    python scripts/event_daemon.py

This is the default (fastest) execution mode. Falls back to loop_daemon.py
polling if WebSocket connection fails.

Architecture:
    1. Full REST fetch of Kalshi + Polymarket on startup
    2. Match cross-platform pairs
    3. Subscribe to focused Kalshi tickers via WebSocket
    4. Real-time arb detection on every price tick (<1ms)
    5. Periodic: settlement (60s), MTM (30s), REST refresh (5min)
"""

from __future__ import annotations

import asyncio
import json
import signal
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import threading

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from neutralis.config import load_settings
from neutralis.engine.event_loop import EventEngine
from neutralis.logging import get_logger
from neutralis.storage.postgres import PostgresStorage
from neutralis.services.user_credentials import load_active_users, load_user_credentials

logger = get_logger("event_daemon")


_health_engine: EventEngine | None = None
_health_server: HTTPServer | None = None


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_response(404)
            self.end_headers()
            return
        if _health_engine is not None:
            body = json.dumps(_health_engine.health_snapshot())
        else:
            body = json.dumps({"status": "starting", "engine": "initializing"})
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, format: str, *args: object) -> None:
        pass


def _start_health_server_early(port: int) -> None:
    """Start the health server immediately (before engine/DB init)."""
    global _health_server  # noqa: PLW0603
    try:
        _health_server = HTTPServer(("0.0.0.0", port), _HealthHandler)
    except OSError:
        logger.warning("Health server failed to bind to port %d", port, exc_info=True)
        return
    thread = threading.Thread(target=_health_server.serve_forever, daemon=True)
    thread.start()
    logger.info("Health server listening on port %d (pre-init)", port)


def _promote_health_server(engine: EventEngine) -> None:
    """Attach the real engine to the health server for detailed snapshots."""
    global _health_engine  # noqa: PLW0603
    _health_engine = engine
    logger.info("Health server promoted to engine-backed responses")


async def main() -> None:
    settings = load_settings()
    ws_cfg = settings.websocket

    # Start health server FIRST so Railway sees the service is alive
    # (even if DB is temporarily unreachable)
    _start_health_server_early(ws_cfg.health_port)

    # Startup DB connectivity check (retry up to 5 times)
    logger.info("Running startup database connectivity check")
    db_ok = False
    for attempt in range(1, 6):
        try:
            with PostgresStorage(settings.db):
                pass
            logger.info("Database reachable (attempt %d)", attempt)
            db_ok = True
            break
        except Exception:
            logger.warning(
                "Database unreachable (attempt %d/5)", attempt, exc_info=True
            )
            if attempt < 5:
                await asyncio.sleep(5 * attempt)  # 5s, 10s, 15s, 20s backoff
    if not db_ok:
        logger.error("Database unreachable after 5 attempts — exiting")
        sys.exit(1)

    # Check automation state before starting — refuse to start if killed or paused
    try:
        with PostgresStorage(settings.db) as storage:
            active_users = load_active_users(storage)
            if not active_users:
                # No multi-tenant users — check legacy singleton state
                auto_state = storage.get_automation_state()
                if auto_state:
                    status = auto_state.get("status", "")
                    kill_switch = auto_state.get("kill_switch", False)
                    if status == "killed" or kill_switch:
                        logger.error(
                            "Automation is killed (reason: %s) — refusing to start. "
                            "Set automation_state.status to 'running' to re-enable.",
                            auto_state.get("killed_reason", "unknown"),
                        )
                        sys.exit(1)
                    if status == "paused":
                        logger.error(
                            "Automation is paused — refusing to start. "
                            "Set automation_state.status to 'running' to resume."
                        )
                        sys.exit(1)
                    logger.info(
                        "Automation state check passed: status=%s", status
                    )
                else:
                    logger.info(
                        "No automation_state row found — proceeding with startup"
                    )
            else:
                logger.info(
                    "Automation state check passed: %d active user(s)",
                    len(active_users),
                )
    except SystemExit:
        raise
    except Exception:
        logger.warning(
            "Failed to check automation state on startup — proceeding anyway",
            exc_info=True,
        )

    # Load credentials from DB — find the first active user with valid keys
    kalshi_key_id = ""
    kalshi_pem = ""
    poly_us_key_id = ""
    poly_us_secret = ""
    try:
        with PostgresStorage(settings.db) as storage:
            users = load_active_users(storage)
            for user in users:
                uid = str(user["user_id"])
                creds = load_user_credentials(storage, uid)
                if creds.kalshi and not kalshi_key_id:
                    kalshi_key_id = creds.kalshi.api_key_id
                    kalshi_pem = creds.kalshi.private_key_pem
                    logger.info(
                        "Loaded Kalshi credentials from user %s for WS auth",
                        uid[:8],
                    )
                if creds.polymarket and not poly_us_key_id:
                    poly_us_key_id = creds.polymarket.api_key
                    poly_us_secret = creds.polymarket.api_secret
                    logger.info(
                        "Loaded Polymarket US credentials from user %s",
                        uid[:8],
                    )
                if kalshi_key_id and poly_us_key_id:
                    break
    except Exception:
        logger.warning("Failed to load user credentials from DB", exc_info=True)

    # Fallback to env vars if no DB credentials
    if not kalshi_key_id:
        kalshi_key_id = settings.execution.kalshi_api_key_id
        logger.info("Using env-var Kalshi credentials for WS auth")

    if not kalshi_key_id:
        logger.error(
            "No Kalshi credentials found (DB or env vars). "
            "A user must save Kalshi API keys in the dashboard and start automation."
        )
        sys.exit(1)

    # Inject Polymarket US credentials into settings so market fetch works
    if poly_us_key_id and not settings.execution.polymarket_us_key_id:
        import dataclasses
        settings = dataclasses.replace(
            settings,
            execution=dataclasses.replace(
                settings.execution,
                polymarket_us_key_id=poly_us_key_id,
                polymarket_us_secret_key=poly_us_secret,
            ),
        )
        logger.info("Injected Polymarket US credentials from DB into settings")

    # Create engine with DB credentials if available
    engine = EventEngine(settings, kalshi_key_id=kalshi_key_id, kalshi_pem=kalshi_pem)

    # Promote health endpoint with real engine data
    _promote_health_server(engine)

    # Graceful shutdown
    loop = asyncio.get_event_loop()

    def _handle_shutdown() -> None:
        logger.info("Shutdown signal received")
        asyncio.ensure_future(engine.stop())

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _handle_shutdown)

    # Start
    logger.info(
        "Event daemon starting (ws_url=%s, health_port=%d, focus=%s)",
        ws_cfg.ws_url, ws_cfg.health_port, ws_cfg.focus_categories,
    )

    try:
        await engine.start()
        await engine.run_until_stopped()
    except KeyboardInterrupt:
        pass
    finally:
        await engine.stop()

    logger.info("Event daemon stopped")


if __name__ == "__main__":
    asyncio.run(main())
