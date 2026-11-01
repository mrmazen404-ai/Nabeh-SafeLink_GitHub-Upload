import base64
import os
from datetime import datetime, timezone

os.environ.setdefault("ADMIN_JWT_SECRET", "a" * 64)
os.environ.setdefault("ADMIN_IP_SALT", "b" * 32)
os.environ.setdefault("ADMIN_TOTP_ENCRYPTION_KEY", base64.urlsafe_b64encode(b"c" * 32).decode())

import pyotp

from app.admin.security import (
    decode_token,
    decrypt_totp_secret,
    encrypt_totp_secret,
    hash_password,
    issue_token,
    verify_password,
    verify_totp,
    verify_totp_step,
)


def test_admin_password_hash_roundtrip():
    encoded = hash_password("StrongAdminPassword!123")
    assert encoded.startswith("scrypt$")
    assert verify_password("StrongAdminPassword!123", encoded)
    assert not verify_password("wrong-password", encoded)


def test_admin_totp_secret_is_encrypted_and_verifiable():
    secret = pyotp.random_base32()
    ciphertext, nonce = encrypt_totp_secret(secret)
    assert ciphertext != secret
    assert nonce
    assert decrypt_totp_secret(ciphertext) == secret
    assert verify_totp(secret, pyotp.TOTP(secret).now())


def test_admin_totp_returns_accepted_step_for_atomic_replay_protection():
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    at = datetime.fromtimestamp((int(datetime.now(timezone.utc).timestamp()) // totp.interval) * totp.interval + 5, tz=timezone.utc)
    code = totp.at(at)
    step = verify_totp_step(secret, code, at)
    assert step == totp.timecode(at)
    assert verify_totp_step(secret, "000000") is None


def test_admin_jwt_is_separate_and_purpose_bound():
    token = issue_token("admin-id", "SUPER_ADMIN", "access", 5)
    claims = decode_token(token, "access")
    assert claims["type"] == "admin"
    assert claims["sub"] == "admin-id"
    try:
        decode_token(token, "2fa_challenge")
    except Exception:
        pass
    else:
        raise AssertionError("access token must not be accepted as a 2FA challenge")
