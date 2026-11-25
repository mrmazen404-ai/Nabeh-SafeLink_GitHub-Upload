from __future__ import annotations

from datetime import datetime
from typing import Callable

from fastapi import Depends, Header, HTTPException, Request

from app.admin.security import AdminSecurityError, decode_token, now
from app.config import settings
from app.db.supabase_client import supabase


ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "SUPERVISOR": frozenset({
        "dashboard.read",
        "users.read",
        "scans.read",
        "feedback.read",
        "support.read",
        "audit.read",
        "sessions.read",
    }),
    "ADMIN": frozenset({
        "dashboard.read",
        "users.read", "users.manage",
        "scans.read", "scans.review",
        "feedback.read", "feedback.manage",
        "support.read", "support.manage",
        "audit.read",
        "sessions.read", "sessions.manage",
        "indicators.manage",
    }),
    "SUPER_ADMIN": frozenset({
        "dashboard.read",
        "users.read", "users.manage",
        "scans.read", "scans.review",
        "feedback.read", "feedback.manage",
        "support.read", "support.manage",
        "audit.read",
        "sessions.read", "sessions.manage",
        "indicators.manage",
        "models.read", "models.approve",
        "admins.read", "admins.manage",
        "settings.read", "settings.manage",
        "policies.read", "policies.manage",
    }),
}


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return token


def current_admin(authorization: str | None = Header(None)) -> dict:
    try:
        claims = decode_token(bearer_token(authorization), "access")
        session_id = claims.get("sid")
        if not session_id:
            raise HTTPException(status_code=401, detail="Admin session is missing")

        result = supabase.table("admin_users").select(
            "id,email,display_name,role,status,email_verified,two_factor_required,last_login_at,created_at,updated_at"
        ).eq("id", claims["sub"]).limit(1).execute()
        admin = result.data[0] if result.data else None
        if not admin or admin.get("status") != "ACTIVE" or not admin.get("email_verified"):
            raise HTTPException(status_code=401, detail="Admin session is inactive")
        if admin.get("role") not in ROLE_PERMISSIONS:
            raise HTTPException(status_code=403, detail="Unknown administrator role")

        session = supabase.table("admin_sessions").select(
            "id,admin_user_id,expires_at,revoked_at"
        ).eq("id", session_id).eq("admin_user_id", admin["id"]).limit(1).execute()
        active_session = session.data[0] if session.data else None
        if not active_session or active_session.get("revoked_at"):
            raise HTTPException(status_code=401, detail="Admin session is revoked")
        expires_at = active_session.get("expires_at", "")
        try:
            expires_at_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except (AttributeError, ValueError):
            raise HTTPException(status_code=401, detail="Admin session expiry is invalid") from None
        if expires_at_dt <= now():
            raise HTTPException(status_code=401, detail="Admin session has expired")
        return admin
    except HTTPException:
        raise
    except AdminSecurityError:
        raise HTTPException(status_code=401, detail="Invalid admin authentication") from None
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid admin authentication") from None


def require_roles(*roles: str) -> Callable:
    def dependency(admin: dict = Depends(current_admin)) -> dict:
        if admin.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient administrator permissions")
        return admin
    return dependency


def require_permissions(*permissions: str) -> Callable:
    required = frozenset(permissions)

    def dependency(admin: dict = Depends(current_admin)) -> dict:
        granted = ROLE_PERMISSIONS.get(admin.get("role"), frozenset())
        if not required.issubset(granted):
            raise HTTPException(status_code=403, detail="Insufficient administrator permissions")
        return admin

    return dependency


def client_ip(request: Request) -> str:
    # Only trust forwarding headers when deployment explicitly declares a
    # trusted reverse proxy that overwrites them.
    if settings.NABEH_TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"
