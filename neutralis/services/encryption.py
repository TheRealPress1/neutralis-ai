"""AES-256-GCM encryption/decryption compatible with TypeScript encryption.ts.

Format: base64(iv):base64(authTag):base64(ciphertext)
Key: API_KEY_ENC_KEY env var (64-char hex = 32 bytes)
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from neutralis.logging import get_logger

logger = get_logger(__name__)


def _get_key() -> bytes:
    """Load the 32-byte AES key from environment."""
    hex_key = os.environ.get("API_KEY_ENC_KEY", "")
    if not hex_key or len(hex_key) != 64:
        raise RuntimeError(
            "API_KEY_ENC_KEY env var must be a 64-char hex string (32 bytes)"
        )
    return bytes.fromhex(hex_key)


def decrypt(ciphertext: str) -> str:
    """Decrypt a string encrypted by TypeScript encrypt().

    Expected format: base64(iv):base64(authTag):base64(ciphertext)
    """
    parts = ciphertext.split(":")
    if len(parts) != 3:
        raise ValueError("Invalid ciphertext format (expected iv:tag:data)")

    iv = base64.b64decode(parts[0])
    auth_tag = base64.b64decode(parts[1])
    encrypted_data = base64.b64decode(parts[2])

    key = _get_key()
    aesgcm = AESGCM(key)

    # Python AESGCM expects tag appended to ciphertext
    plaintext = aesgcm.decrypt(iv, encrypted_data + auth_tag, None)
    return plaintext.decode("utf-8")


def try_decrypt(value: str) -> str:
    """Attempt decryption; return raw value if it fails (handles legacy plaintext)."""
    if not value or ":" not in value:
        return value
    try:
        return decrypt(value)
    except Exception:
        return value
