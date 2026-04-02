"""Load and decrypt user API keys from the user_api_keys table.

Bridges the TypeScript-encrypted credentials in Supabase to Python executor
initialization. Each user stores their Kalshi/Polymarket keys via the
dashboard UI; this module reads and decrypts them for the trading engine.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from neutralis.logging import get_logger
from neutralis.services.encryption import try_decrypt
from neutralis.storage.postgres import PostgresStorage

logger = get_logger(__name__)


@dataclass(frozen=True)
class KalshiCredentials:
    api_key_id: str
    private_key_pem: str  # Decrypted PEM string


@dataclass(frozen=True)
class PolymarketCredentials:
    api_key: str
    api_secret: str
    passphrase: str
    funder_address: str


@dataclass(frozen=True)
class UserCredentials:
    user_id: str
    kalshi: Optional[KalshiCredentials] = None
    polymarket: Optional[PolymarketCredentials] = None


def load_user_credentials(
    storage: PostgresStorage,
    user_id: str,
) -> UserCredentials:
    """Load and decrypt API keys for a user from the user_api_keys table."""
    rows = storage._fetch_dicts(
        "SELECT platform, api_key_id, api_secret, private_key_pem "
        "FROM user_api_keys "
        "WHERE user_id = %(user_id)s AND is_valid = TRUE",
        {"user_id": user_id},
    )

    kalshi_creds = None
    poly_creds = None
    poly_wallet_address = ""

    for row in rows:
        platform = row["platform"]

        if platform == "kalshi":
            pem_enc = row.get("private_key_pem", "")
            if not pem_enc:
                logger.warning("Kalshi key for user %s has no PEM", user_id)
                continue
            pem_str = try_decrypt(pem_enc)
            if not pem_str or "BEGIN" not in pem_str:
                logger.warning("Failed to decrypt Kalshi PEM for user %s", user_id)
                continue
            kalshi_creds = KalshiCredentials(
                api_key_id=row["api_key_id"],
                private_key_pem=pem_str,
            )

        elif platform in ("polymarket", "polymarket_us"):
            secret = try_decrypt(row.get("api_secret", ""))
            passphrase = try_decrypt(row.get("private_key_pem", ""))
            poly_creds = PolymarketCredentials(
                api_key=row["api_key_id"],
                api_secret=secret,
                passphrase=passphrase,
                funder_address="",  # filled from wallet row below
            )

        elif platform == "polymarket_wallet":
            poly_wallet_address = row["api_key_id"]

    # Attach wallet address to Polymarket credentials
    if poly_creds and poly_wallet_address:
        poly_creds = PolymarketCredentials(
            api_key=poly_creds.api_key,
            api_secret=poly_creds.api_secret,
            passphrase=poly_creds.passphrase,
            funder_address=poly_wallet_address,
        )

    return UserCredentials(
        user_id=user_id,
        kalshi=kalshi_creds,
        polymarket=poly_creds,
    )


def load_active_users(storage: PostgresStorage) -> list[dict]:
    """Load users with automation running and valid API keys.

    Returns dicts ordered by priority: founders first, then by signup date.
    Each dict has: user_id, email, subscription_tier, is_founder, execution_priority.
    """
    return storage._fetch_dicts("""
        SELECT
            p.id AS user_id,
            p.email,
            p.subscription_tier,
            p.is_founder,
            COALESCE(p.execution_priority, 4) AS execution_priority
        FROM profiles p
        JOIN automation_state a ON a.user_id = p.id
        WHERE a.status = 'running'
          AND a.kill_switch = FALSE
          AND EXISTS (
              SELECT 1 FROM user_api_keys k
              WHERE k.user_id = p.id
                AND k.platform = 'kalshi'
                AND k.is_valid = TRUE
          )
        ORDER BY
            p.is_founder DESC,
            COALESCE(p.execution_priority, 4) ASC,
            p.created_at ASC
    """)
