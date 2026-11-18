"""Custom authentication primitives independent of Supabase Auth."""

import base64
import binascii
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt

from app.config import settings
from app.db.supabase_client import supabase


class AuthSecurityError(Exception):
    """Raised for invalid or expired custom-auth credentials."""


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$16384$8$1${}${}".format(
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(digest).decode(),
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = encoded.split("$", 5)
        if scheme != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode())
        expected = base64.urlsafe_b64decode(digest_b64.encode())
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n),
            r=int(r),
            p=int(p),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, binascii.Error):
        return False


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(code: str) -> str:
    return hmac.new(
        settings.AUTH_OTP_PEPPER.encode("utf-8"),
        code.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def issue_access_token(user: dict[str, Any], purpose: str = "access") -> str:
    secret = settings.AUTH_JWT_SECRET
    if not secret:
        raise AuthSecurityError("AUTH_JWT_SECRET is not configured")
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user["id"]),
        "email": user["email"],
        "purpose": purpose,
        "session_version": int(user.get("auth_token_version", 0) or 0),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.AUTH_ACCESS_TOKEN_MINUTES)).timestamp()),
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def decode_token(token: str, required_purpose: str = "access") -> dict[str, Any]:
    secret = settings.AUTH_JWT_SECRET
    if not secret:
        raise AuthSecurityError("AUTH_JWT_SECRET is not configured")
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise AuthSecurityError("invalid token") from exc
    if claims.get("purpose") != required_purpose or not claims.get("sub"):
        raise AuthSecurityError("invalid token purpose")
    return claims


def get_user_by_id(user_id: str) -> Optional[dict[str, Any]]:
    result = supabase.table("custom_users").select(
        "id,email,display_name,password_hash,email_verified,preferred_language,role,status,auth_token_version,created_at,last_login_at"
    ).eq("id", user_id).limit(1).execute()
    return result.data[0] if result.data else None


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    result = supabase.table("custom_users").select(
        "id,email,display_name,password_hash,email_verified,preferred_language,role,status,auth_token_version,created_at,last_login_at"
    ).ilike("email", normalize_email(email)).limit(1).execute()
    return result.data[0] if result.data else None


def get_authenticated_user(token: str) -> dict[str, Any]:
    claims = decode_token(token, "access")
    user = get_user_by_id(str(claims["sub"]))
    if not user or not user.get("email_verified") or user.get("status", "ACTIVE") != "ACTIVE":
        raise AuthSecurityError("user is not authenticated")
    if int(claims.get("session_version", 0)) != int(user.get("auth_token_version", 0) or 0):
        raise AuthSecurityError("session has been revoked")
    return user


def get_reset_user(token: str) -> dict[str, Any]:
    claims = decode_token(token, "password_reset")
    user = get_user_by_id(str(claims["sub"]))
    if not user or not user.get("email_verified") or user.get("status", "ACTIVE") != "ACTIVE":
        raise AuthSecurityError("invalid reset token")
    if int(claims.get("session_version", 0)) != int(user.get("auth_token_version", 0) or 0):
        raise AuthSecurityError("reset session has been revoked")
    return user
