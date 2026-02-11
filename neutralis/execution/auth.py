"""Shared RSA-PSS authentication for Kalshi REST and WebSocket APIs."""

from __future__ import annotations

import base64
import time
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa


def load_private_key(path_str: str) -> rsa.RSAPrivateKey:
    """Load an RSA private key from a PEM file."""
    pem_path = Path(path_str)
    if not pem_path.is_absolute():
        pem_path = Path(__file__).resolve().parent.parent.parent / pem_path
    if not pem_path.exists():
        raise FileNotFoundError(f"Private key not found: {pem_path}")
    pem_data = pem_path.read_bytes()
    key = serialization.load_pem_private_key(pem_data, password=None)
    if not isinstance(key, rsa.RSAPrivateKey):
        raise TypeError("Expected RSA private key")
    return key


def sign_request(
    private_key: rsa.RSAPrivateKey,
    api_key: str,
    method: str,
    path: str,
) -> dict[str, str]:
    """Generate Kalshi auth headers for a REST or WebSocket request.

    Args:
        private_key: RSA private key for signing.
        api_key: Kalshi API key ID.
        method: HTTP method (GET, POST, etc.).
        path: Full API path (e.g. "/trade-api/v2/markets" or "/trade-api/ws/v2").

    Returns:
        Dict with KALSHI-ACCESS-KEY, KALSHI-ACCESS-TIMESTAMP, KALSHI-ACCESS-SIGNATURE.
    """
    timestamp_ms = str(int(time.time() * 1000))
    message = timestamp_ms + method.upper() + path
    signature = private_key.sign(
        message.encode(),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH,
        ),
        hashes.SHA256(),
    )
    return {
        "KALSHI-ACCESS-KEY": api_key,
        "KALSHI-ACCESS-TIMESTAMP": timestamp_ms,
        "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode(),
    }


def ws_auth_headers(private_key: rsa.RSAPrivateKey, api_key: str) -> dict[str, str]:
    """Generate auth headers specifically for the WebSocket handshake.

    Kalshi WS auth signs: timestamp + "GET" + "/trade-api/ws/v2"
    """
    return sign_request(private_key, api_key, "GET", "/trade-api/ws/v2")
