from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient

from app.auth import security
from app.auth.security import AuthSecurityError, decode_token
from app.auth.routes import _login_limiter, _resend_cooldown_limiter, _resend_limiter
from app.main import app
from app.security.guest_rate_limit import _guest_limiter


def _token(purpose="access", minutes=5, algorithm="HS256"):
    return jwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000001",
            "purpose": purpose,
            "exp": int((datetime.now(timezone.utc) + timedelta(minutes=minutes)).timestamp()),
        },
        "test-jwt-secret-for-testing-only",
        algorithm=algorithm,
    )


def test_jwt_rejects_expired_and_wrong_algorithm():
    for token in (_token(minutes=-5), _token(algorithm="HS512")):
        try:
            decode_token(token)
        except AuthSecurityError:
            pass
        else:
            raise AssertionError("invalid JWT was accepted")


def test_reset_token_rejects_suspended_user(monkeypatch):
    monkeypatch.setattr(
        security,
        "get_user_by_id",
        lambda _user_id: {"id": "u1", "email_verified": True, "status": "SUSPENDED"},
    )
    try:
        security.get_reset_user(_token(purpose="password_reset"))
    except AuthSecurityError:
        pass
    else:
        raise AssertionError("suspended user accepted for password reset")


def test_security_headers_are_present():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "camera=()" in response.headers["permissions-policy"]


def test_rate_limiters_fail_closed_by_default():
    assert _guest_limiter.fail_closed is True
    assert _login_limiter.fail_closed is True
    assert _resend_limiter.fail_closed is True
    assert _resend_cooldown_limiter.fail_closed is True
    assert _guest_limiter.namespace != _login_limiter.namespace
    assert _guest_limiter.namespace != _resend_limiter.namespace


def test_production_settings_reject_fail_open_rate_limiting():
    production = Settings()
    production.ENVIRONMENT = "production"
    production.ADMIN_JWT_SECRET = "a" * 64
    production.ADMIN_BOOTSTRAP_TOKEN = "b" * 64
    production.ADMIN_IP_SALT = "c" * 64
    production.SUPABASE_SECRET_KEY = "d" * 64
    production.ADMIN_TOTP_ENCRYPTION_KEY = "fernet-key-configured"
    production.CORS_ALLOWED_ORIGINS = ("https://intellidefenda.com",)
    production.RATE_LIMIT_FAIL_CLOSED = False

    with pytest.raises(RuntimeError, match="NABEH_RATE_LIMIT_FAIL_CLOSED"):
        production.validate_admin_security()


def test_production_limiter_requires_private_salt(monkeypatch):
    from app.security.guest_rate_limit import UpstashRateLimiter

    monkeypatch.setenv("NABEH_ENVIRONMENT", "production")
    monkeypatch.setenv("NABEH_RATE_LIMIT_SALT", "")
    limiter = UpstashRateLimiter(url="https://redis.example", token="test-token", fail_closed=True)
    assert limiter.configured is False
from app.config import Settings
import pytest
