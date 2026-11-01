"""Security primitives for the isolated administrator plane."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import pyotp
from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


JWT_ALGORITHM = "HS256"


class AdminSecurityError(Exception):
    """Raised when an administrator credential is invalid."""


def now() -> datetime:
    return datetime.now(timezone.utc)


def hash_value(value: str) -> str:
    return hmac.new(settings.ADMIN_IP_SALT.encode(), value.encode(), hashlib.sha256).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$16384$8$1${}${}".format(
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(digest).decode(),
    )


def verify_password(password: str, encoded: str) -> bool:
    """Verify only bounded scrypt parameters to avoid a stored-hash DoS."""
    try:
        scheme, n, r, p, salt_b64, digest_b64 = encoded.split("$", 5)
        n_int, r_int, p_int = int(n), int(r), int(p)
        if scheme != "scrypt" or not (2**14 <= n_int <= 2**20) or not (1 <= r_int <= 32) or not (1 <= p_int <= 8):
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode())
        expected = base64.urlsafe_b64decode(digest_b64.encode())
        if len(salt) < 16 or len(salt) > 64 or not expected:
            return False
        actual = hashlib.scrypt(password.encode(), salt=salt, n=n_int, r=r_int, p=p_int)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, UnicodeError):
        return False


def _fernet() -> Fernet:
    key = settings.ADMIN_TOTP_ENCRYPTION_KEY
    if not key:
        raise AdminSecurityError("ADMIN_TOTP_ENCRYPTION_KEY is not configured")
    try:
        return Fernet(key.encode())
    except Exception as exc:
        raise AdminSecurityError("ADMIN_TOTP_ENCRYPTION_KEY is invalid") from exc


def encrypt_totp_secret(secret: str) -> tuple[str, str]:
    token = _fernet().encrypt(secret.encode()).decode()
    nonce = secrets.token_urlsafe(16)
    return token, nonce


def decrypt_totp_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, UnicodeError) as exc:
        raise AdminSecurityError("invalid encrypted TOTP secret") from exc


def recovery_hash(code: str) -> str:
    return hash_value(f"recovery:{code}")


def issue_token(subject: str, role: str, purpose: str, minutes: int, extra: dict[str, Any] | None = None) -> str:
    issued = now()
    claims: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "admin",
        "purpose": purpose,
        "jti": str(secrets.token_hex(16)),
        "iat": int(issued.timestamp()),
        "nbf": int(issued.timestamp()),
        "exp": int((issued + timedelta(minutes=minutes)).timestamp()),
        "iss": settings.ADMIN_JWT_ISSUER,
        "aud": settings.ADMIN_JWT_AUDIENCE,
    }
    if extra:
        claims.update(extra)
    return jwt.encode(claims, settings.ADMIN_JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str, purpose: str | tuple[str, ...] = "access") -> dict[str, Any]:
    if not settings.ADMIN_JWT_SECRET:
        raise AdminSecurityError("ADMIN_JWT_SECRET is not configured")
    try:
        claims = jwt.decode(
            token,
            settings.ADMIN_JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            issuer=settings.ADMIN_JWT_ISSUER,
            audience=settings.ADMIN_JWT_AUDIENCE,
            options={"require": ["sub", "type", "purpose", "jti", "iat", "nbf", "exp", "iss", "aud"]},
        )
    except jwt.PyJWTError as exc:
        raise AdminSecurityError("invalid administrator token") from exc
    expected = (purpose,) if isinstance(purpose, str) else purpose
    if claims.get("type") != "admin" or claims.get("purpose") not in expected or not claims.get("sub"):
        raise AdminSecurityError("invalid administrator token purpose")
    return claims


def issue_access_token(admin: dict[str, Any], extra: dict[str, Any] | None = None) -> str:
    return issue_token(str(admin["id"]), admin["role"], "access", settings.ADMIN_ACCESS_TOKEN_MINUTES, extra)


def issue_challenge_token(admin: dict[str, Any]) -> str:
    return issue_token(str(admin["id"]), admin["role"], "2fa_challenge", 5)


def issue_setup_token(admin: dict[str, Any]) -> str:
    return issue_token(str(admin["id"]), admin["role"], "2fa_setup", 10)


def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def verify_totp_step(secret: str, code: str, at: datetime | None = None) -> int | None:
    """Return the accepted TOTP step so callers can consume it atomically."""
    totp = pyotp.TOTP(secret)
    current = at or now()
    current_step = totp.timecode(current)
    normalized = code.strip()
    for step in (current_step - 1, current_step, current_step + 1):
        candidate_time = datetime.fromtimestamp(step * totp.interval, tz=timezone.utc)
        if totp.verify(normalized, for_time=candidate_time, valid_window=0):
            return step
    return None


def totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=settings.ADMIN_TOTP_ISSUER)


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def refresh_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
