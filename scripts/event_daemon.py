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


def _start_health_server(engine: EventEngine, port: int) -> None:
    """Start a minimal HTTP health server on a background daemon thread."""

    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path != "/health":
                self.send_response(404)
                self.end_headers()
                return
            body = json.dumps(engine.health_snapshot())
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())

        def log_message(self, format: str, *args: object) -> None:
            pass

    try:
        server = HTTPServer(("0.0.0.0", port), _Handler)
    except OSError:
        logger.warning("Health server failed to bind to port %d", port, exc_info=True)
        return

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info("Health server listening on port %d", port)


async def main() -> None:
    settings = load_settings()
    ws_cfg = settings.websocket

    # Startup health check
    logger.info("Running startup health check")
    try:
        with PostgresStorage(settings.db):
            pass
        logger.info("Health check passed: database reachable")
    except Exception:
        logger.exception("Health check failed: database unreachable")
        sys.exit(1)

    # Load credentials from DB — find the first active user with valid Kalshi keys
    kalshi_key_id = ""
    kalshi_pem = ""
    try:
        with PostgresStorage(settings.db) as storage:
            users = load_active_users(storage)
            for user in users:
                uid = str(user["user_id"])
                creds = load_user_credentials(storage, uid)
                if creds.kalshi:
                    kalshi_key_id = creds.kalshi.api_key_id
                    kalshi_pem = creds.kalshi.private_key_pem
                    logger.info(
                        "Loaded Kalshi credentials from user %s for WS auth",
                        uid[:8],
                    )
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

    # Create engine with DB credentials if available
    engine = EventEngine(settings, kalshi_key_id=kalshi_key_id, kalshi_pem=kalshi_pem)

    # Health endpoint
    _start_health_server(engine, ws_cfg.health_port)

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
