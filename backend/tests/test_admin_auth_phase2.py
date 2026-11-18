import base64
import os

os.environ.setdefault("ADMIN_JWT_SECRET", "a" * 64)
os.environ.setdefault("ADMIN_IP_SALT", "b" * 32)
os.environ.setdefault("ADMIN_TOTP_ENCRYPTION_KEY", base64.urlsafe_b64encode(b"c" * 32).decode())
os.environ.setdefault("ADMIN_JWT_ISSUER", "nabeh-admin")
os.environ.setdefault("ADMIN_JWT_AUDIENCE", "nabeh-admin-api")

import jwt
import pytest

from app.admin.dependencies import ROLE_PERMISSIONS
from app.admin.security import decode_token, issue_token, now
from app.config import settings


def test_admin_jwt_contains_and_validates_issuer_audience_and_required_claims():
    token = issue_token("admin-id", "ADMIN", "access", 5, {"sid": "session-id"})
    claims = decode_token(token, "access")
    assert claims["iss"] == settings.ADMIN_JWT_ISSUER
    assert claims["aud"] == settings.ADMIN_JWT_AUDIENCE
    assert claims["sid"] == "session-id"
    for key in ("sub", "type", "purpose", "jti", "iat", "nbf", "exp"):
        assert key in claims


def test_admin_jwt_rejects_wrong_audience():
    token = issue_token("admin-id", "ADMIN", "access", 5)
    claims = jwt.decode(token, options={"verify_signature": False})
    claims["aud"] = "wrong-audience"
    forged = jwt.encode(claims, settings.ADMIN_JWT_SECRET, algorithm="HS256")
    with pytest.raises(Exception):
        decode_token(forged, "access")


def test_rbac_permissions_are_strictly_ordered():
    assert "dashboard.read" in ROLE_PERMISSIONS["SUPERVISOR"]
    assert "users.manage" not in ROLE_PERMISSIONS["SUPERVISOR"]
    assert "users.manage" in ROLE_PERMISSIONS["ADMIN"]
    assert "admins.manage" not in ROLE_PERMISSIONS["ADMIN"]
    assert "admins.manage" in ROLE_PERMISSIONS["SUPER_ADMIN"]
    assert "policies.manage" in ROLE_PERMISSIONS["SUPER_ADMIN"]


def test_access_token_expiry_is_positive():
    token = issue_token("admin-id", "ADMIN", "access", 5)
    claims = decode_token(token, "access")
    assert claims["exp"] > int(now().timestamp())
