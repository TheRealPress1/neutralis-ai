"""Fernet encrypt/decrypt for stored Polymarket L2 credentials."""

from __future__ import annotations

import os

from cryptography.fernet import Fernet

from neutralis.logging import get_logger

logger = get_logger(__name__)


def _get_fernet() -> Fernet:
    key = os.environ.get("CREDENTIALS_ENC_KEY")
    if not key:
        raise RuntimeError("CREDENTIALS_ENC_KEY not set in environment")
    return Fernet(key.encode())


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string and return base64 ciphertext."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a Fernet ciphertext and return the original plaintext."""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()
