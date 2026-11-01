from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, EmailStr, Field

from app.admin.dependencies import ROLE_PERMISSIONS, bearer_token, client_ip, current_admin, require_permissions, require_roles
from app.admin.security import (
    AdminSecurityError, decrypt_totp_secret, encrypt_totp_secret, hash_password,
    hash_value, issue_access_token, issue_challenge_token, issue_setup_token,
    new_refresh_token, now, recovery_hash, refresh_hash, totp_uri, verify_password,
    verify_totp_step,
)
from app.config import settings
from app.db.supabase_client import supabase

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class BootstrapRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=128)


class CodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=32)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)


class InviteRequest(BaseModel):
    email: EmailStr
    role: Literal["SUPERVISOR", "ADMIN", "SUPER_ADMIN"] = "SUPERVISOR"


class InvitationAcceptRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=128)


class UserStatusRequest(BaseModel):
    status: Literal["ACTIVE", "SUSPENDED"]
    reason: str = Field(min_length=3, max_length=500)


class BroadcastNotificationRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=2, max_length=5000)


class SupportReplyRequest(BaseModel):
    status: Literal["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] | None = None
    priority: Literal["LOW", "NORMAL", "HIGH", "URGENT"] | None = None
    assign_to_me: bool = False
    reply: str | None = Field(default=None, max_length=5000)
    note: str | None = Field(default=None, max_length=1000)


def _admin_by_email(email: str) -> dict | None:
    result = supabase.table("admin_users").select("*").eq("email", str(email).strip().lower()).limit(1).execute()
    return result.data[0] if result.data else None


def _audit(admin_id: str | None, action: str, resource_type: str, resource_id: str | None, request: Request, before=None, after=None, target_user_id: str | None = None, target_scan_id: str | None = None):
    request_id = request.headers.get("x-request-id")
    try:
        UUID(request_id) if request_id else None
    except ValueError:
        request_id = None
    supabase.table("admin_audit_logs").insert({
        "admin_user_id": admin_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "target_user_id": target_user_id,
        "target_scan_id": target_scan_id,
        "before_data": before or {},
        "after_data": after or {},
        "metadata_masked": {},
        "ip_hash": hash_value(client_ip(request)),
        "user_agent_hash": hash_value(request.headers.get("user-agent", "")),
        "request_id": request_id,
    }).execute()


def _user_notification(user_id: str, title: str, body: str, notification_type: str = "SYSTEM"):
    """Create an in-app notification; failures are allowed to surface to admins."""
    return supabase.table("notifications").insert({
        "user_id": str(user_id),
        "type": notification_type,
        "title": title,
        "body": body,
    }).execute()


def _tokens(admin: dict, request: Request, token_family: str | None = None) -> dict:
    refresh = new_refresh_token()
    row = {
        "admin_user_id": str(admin["id"]),
        "refresh_token_hash": refresh_hash(refresh),
        "token_family": token_family or str(uuid4()),
        "ip_hash": hash_value(client_ip(request)),
        "user_agent_hash": hash_value(request.headers.get("user-agent", "")),
        "expires_at": (now() + timedelta(days=settings.ADMIN_REFRESH_TOKEN_DAYS)).isoformat(),
    }
    result = supabase.table("admin_sessions").insert(row).execute()
    session_id = result.data[0]["id"] if result.data else None
    if not session_id:
        raise HTTPException(status_code=503, detail="Unable to create administrator session")
    access = issue_access_token(admin, {"sid": session_id})
    return {"access_token": access, "refresh_token": refresh, "session_id": session_id}


def _claim_totp_step(method_id: str, step: int) -> bool:
    """Atomically consume a TOTP step; concurrent requests cannot reuse it."""
    result = (
        supabase.table("admin_2fa_methods")
        .update({"last_used_step": step})
        .eq("id", method_id)
        .or_(f"last_used_step.is.null,last_used_step.lt.{step}")
        .select("id")
        .execute()
    )
    return bool(result.data)


def _setup_rate_limited(admin_id: str, ip_hash: str) -> bool:
    result = (
        supabase.table("admin_login_attempts")
        .select("id", count="exact", head=True)
        .eq("admin_user_id", admin_id)
        .eq("ip_hash", ip_hash)
        .eq("outcome", "INVALID_2FA")
        .eq("failure_reason", "SETUP_CONFIRM")
        .gte("created_at", (now() - timedelta(minutes=15)).isoformat())
        .execute()
    )
    return (result.count or 0) >= settings.ADMIN_LOGIN_RATE_LIMIT


@router.post("/auth/bootstrap", status_code=201)
def bootstrap(request: BootstrapRequest, http_request: Request, bootstrap_token: str | None = Header(None, alias="X-Admin-Bootstrap-Token")):
    """Create the first SUPER_ADMIN only when the one-time server bootstrap secret matches."""
    if not settings.ADMIN_BOOTSTRAP_TOKEN or not bootstrap_token or bootstrap_token != settings.ADMIN_BOOTSTRAP_TOKEN:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        result = supabase.rpc("admin_bootstrap_first", {
            "p_email": str(request.email).strip().lower(),
            "p_display_name": request.display_name.strip(),
            "p_password_hash": hash_password(request.password),
        }).execute()
        admin = result.data if isinstance(result.data, dict) else (result.data or [None])[0]
    except Exception:
        raise HTTPException(status_code=409, detail="Admin bootstrap is already completed or unavailable") from None
    if not admin:
        raise HTTPException(status_code=503, detail="Unable to create the initial administrator")
    _audit(str(admin["id"]), "ADMIN_BOOTSTRAPPED", "admin_user", str(admin["id"]), http_request, after={"role": "SUPER_ADMIN", "status": "ACTIVE"})
    return {"success": True, "data": {"id": admin["id"], "email": admin["email"], "requires_2fa_setup": True}}


@router.post("/auth/login")
def login(request: LoginRequest, http_request: Request):
    email = str(request.email).strip().lower()
    ip_hash = hash_value(client_ip(http_request))
    recent = supabase.table("admin_login_attempts").select("id", count="exact", head=True).eq("ip_hash", ip_hash).gte("created_at", (now() - timedelta(minutes=15)).isoformat()).in_("outcome", ["INVALID_CREDENTIALS", "INVALID_2FA", "RATE_LIMITED"]).execute()
    if (recent.count or 0) >= settings.ADMIN_LOGIN_RATE_LIMIT:
        supabase.table("admin_login_attempts").insert({"email_hash": hash_value(email), "ip_hash": ip_hash, "outcome": "RATE_LIMITED", "failure_reason": "IP_WINDOW_EXCEEDED"}).execute()
        raise HTTPException(status_code=429, detail="Too many login attempts")
    admin = _admin_by_email(email)
    if not admin or admin.get("status") != "ACTIVE" or not verify_password(request.password, admin.get("password_hash", "")):
        supabase.table("admin_login_attempts").insert({"email_hash": hash_value(email), "ip_hash": ip_hash, "admin_user_id": admin.get("id") if admin else None, "outcome": "INVALID_CREDENTIALS"}).execute()
        raise HTTPException(status_code=401, detail="Invalid administrator credentials")
    method = supabase.table("admin_2fa_methods").select("id,is_enabled").eq("admin_user_id", admin["id"]).limit(1).execute()
    if admin.get("two_factor_required") and not (method.data and method.data[0].get("is_enabled")):
        return {"success": True, "status": "2FA_SETUP_REQUIRED", "setup_token": issue_setup_token(admin)}
    if admin.get("two_factor_required"):
        return {"success": True, "status": "2FA_REQUIRED", "challenge_token": issue_challenge_token(admin)}
    tokens = _tokens(admin, http_request)
    supabase.table("admin_users").update({"last_login_at": now().isoformat()}).eq("id", admin["id"]).execute()
    supabase.table("admin_login_attempts").insert({"email_hash": hash_value(email), "ip_hash": ip_hash, "admin_user_id": admin["id"], "outcome": "SUCCESS"}).execute()
    _audit(str(admin["id"]), "ADMIN_LOGIN", "admin_session", tokens["session_id"], http_request)
    return {"success": True, "status": "AUTHENTICATED", "data": tokens}


@router.post("/auth/2fa/setup")
def setup_2fa(http_request: Request, authorization: str | None = Header(None)):
    try:
        claims = __import__("app.admin.security", fromlist=["decode_token"]).decode_token(bearer_token(authorization), "2fa_setup")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid setup authorization") from None
    admin = _admin_by_id(claims["sub"])
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    secret = __import__("pyotp").random_base32()
    ciphertext, nonce = encrypt_totp_secret(secret)
    supabase.table("admin_2fa_methods").upsert({"admin_user_id": admin["id"], "method": "TOTP", "secret_ciphertext": ciphertext, "secret_nonce": nonce, "is_enabled": False}, on_conflict="admin_user_id").execute()
    return {"success": True, "data": {"otpauth_uri": totp_uri(secret, admin["email"]), "secret": secret}}


def _admin_by_id(admin_id: str) -> dict | None:
    result = supabase.table("admin_users").select("*").eq("id", admin_id).limit(1).execute()
    return result.data[0] if result.data else None


@router.post("/auth/2fa/confirm")
def confirm_2fa(request: CodeRequest, http_request: Request, authorization: str | None = Header(None)):
    try:
        claims = __import__("app.admin.security", fromlist=["decode_token"]).decode_token(bearer_token(authorization), "2fa_setup")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid setup authorization") from None
    ip_hash = hash_value(client_ip(http_request))
    if _setup_rate_limited(claims["sub"], ip_hash):
        raise HTTPException(status_code=429, detail="Too many 2FA setup attempts")
    method_result = supabase.table("admin_2fa_methods").select("*").eq("admin_user_id", claims["sub"]).limit(1).execute()
    method = method_result.data[0] if method_result.data else None
    step = verify_totp_step(decrypt_totp_secret(method["secret_ciphertext"]), request.code) if method else None
    if not method or step is None:
        supabase.table("admin_login_attempts").insert({"admin_user_id": claims["sub"], "ip_hash": ip_hash, "outcome": "INVALID_2FA", "failure_reason": "SETUP_CONFIRM"}).execute()
        raise HTTPException(status_code=400, detail="Invalid authenticator code")
    if not _claim_totp_step(method["id"], step):
        raise HTTPException(status_code=409, detail="Authenticator code has already been used")
    codes = [secrets.token_urlsafe(8) for _ in range(10)]
    supabase.table("admin_2fa_methods").update({"is_enabled": True, "verified_at": now().isoformat()}).eq("id", method["id"]).execute()
    supabase.table("admin_2fa_recovery_codes").delete().eq("admin_user_id", claims["sub"]).execute()
    supabase.table("admin_2fa_recovery_codes").insert([{"admin_user_id": claims["sub"], "code_hash": recovery_hash(code)} for code in codes]).execute()
    _audit(claims["sub"], "ADMIN_2FA_ENABLED", "admin_2fa", method["id"], http_request)
    return {"success": True, "data": {"recovery_codes": codes}}


@router.post("/auth/2fa/verify")
def verify_2fa(request: CodeRequest, http_request: Request, authorization: str | None = Header(None)):
    try:
        claims = __import__("app.admin.security", fromlist=["decode_token"]).decode_token(bearer_token(authorization), "2fa_challenge")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid 2FA challenge") from None
    ip_hash = hash_value(client_ip(http_request))
    recent = supabase.table("admin_login_attempts").select("id", count="exact", head=True).eq(
        "ip_hash", ip_hash
    ).gte("created_at", (now() - timedelta(minutes=15)).isoformat()).eq("outcome", "INVALID_2FA").execute()
    if (recent.count or 0) >= settings.ADMIN_LOGIN_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many 2FA attempts")
    method_result = supabase.table("admin_2fa_methods").select("*").eq("admin_user_id", claims["sub"]).limit(1).execute()
    method = method_result.data[0] if method_result.data else None
    step = verify_totp_step(decrypt_totp_secret(method["secret_ciphertext"]), request.code) if method else None
    valid = bool(method and step is not None)
    recovery_row = None
    if not valid:
        recovery_result = supabase.table("admin_2fa_recovery_codes").select("id").eq(
            "admin_user_id", claims["sub"]
        ).eq("code_hash", recovery_hash(request.code.strip())).is_("used_at", "null").limit(1).execute()
        recovery_row = recovery_result.data[0] if recovery_result.data else None
        valid = recovery_row is not None
    outcome = "SUCCESS" if valid else "INVALID_2FA"
    supabase.table("admin_login_attempts").insert({"admin_user_id": claims["sub"], "ip_hash": ip_hash, "outcome": outcome}).execute()
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid authenticator code")
    if recovery_row:
        consumed = supabase.table("admin_2fa_recovery_codes").update({"used_at": now().isoformat()}).eq("id", recovery_row["id"]).is_("used_at", "null").select("id").execute()
        if not consumed.data:
            raise HTTPException(status_code=409, detail="Recovery code has already been used")
    elif not _claim_totp_step(method["id"], step):
        raise HTTPException(status_code=409, detail="Authenticator code has already been used")
    admin = _admin_by_id(claims["sub"])
    tokens = _tokens(admin, http_request)
    supabase.table("admin_users").update({"last_login_at": now().isoformat()}).eq("id", admin["id"]).execute()
    _audit(str(admin["id"]), "ADMIN_LOGIN_2FA", "admin_session", tokens["session_id"], http_request)
    return {"success": True, "status": "AUTHENTICATED", "data": tokens}


@router.post("/auth/refresh")
def refresh(request: RefreshRequest, http_request: Request):
    old_hash = refresh_hash(request.refresh_token)
    result = supabase.table("admin_sessions").select("*").eq("refresh_token_hash", old_hash).limit(1).execute()
    session = result.data[0] if result.data else None
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    if session.get("revoked_at"):
        supabase.table("admin_sessions").update({
            "revoked_at": now().isoformat(),
            "revoke_reason": "REUSE_DETECTED",
        }).eq("admin_user_id", session["admin_user_id"]).eq(
            "token_family", session["token_family"]
        ).is_("revoked_at", "null").execute()
        raise HTTPException(status_code=401, detail="Refresh token has already been used")
    try:
        expires_at = datetime.fromisoformat(session.get("expires_at", "").replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token") from None
    if expires_at <= now():
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    admin = _admin_by_id(session["admin_user_id"])
    if not admin or admin.get("status") != "ACTIVE":
        raise HTTPException(status_code=401, detail="Admin is inactive")
    rotated = supabase.table("admin_sessions").update({
        "revoked_at": now().isoformat(),
        "last_used_at": now().isoformat(),
        "revoke_reason": "ROTATED",
    }).eq("id", session["id"]).is_("revoked_at", "null").execute()
    if not rotated.data:
        raise HTTPException(status_code=401, detail="Refresh token has already been used")
    tokens = _tokens(admin, http_request, str(session["token_family"]))
    _audit(str(admin["id"]), "ADMIN_SESSION_ROTATED", "admin_session", str(session["id"]), http_request)
    return {"success": True, "data": tokens}


@router.post("/auth/logout")
def logout(http_request: Request, authorization: str | None = Header(None), admin: dict = Depends(current_admin)):
    try:
        claims = __import__("app.admin.security", fromlist=["decode_token"]).decode_token(bearer_token(authorization), "access")
        sid = claims.get("sid")
        if sid:
            supabase.table("admin_sessions").update({"revoked_at": now().isoformat(), "revoke_reason": "LOGOUT"}).eq("id", sid).eq("admin_user_id", admin["id"]).execute()
    except Exception:
        pass
    _audit(str(admin["id"]), "ADMIN_LOGOUT", "admin_session", None, http_request)
    return {"success": True}


@router.post("/auth/logout-all")
def logout_all(http_request: Request, admin: dict = Depends(current_admin)):
    supabase.table("admin_sessions").update({"revoked_at": now().isoformat(), "revoke_reason": "LOGOUT_ALL"}).eq("admin_user_id", admin["id"]).is_("revoked_at", "null").execute()
    _audit(str(admin["id"]), "ADMIN_LOGOUT_ALL", "admin_session", None, http_request)
    return {"success": True}


@router.get("/auth/me")
def me(admin: dict = Depends(current_admin)):
    profile = {**admin, "permissions": sorted(ROLE_PERMISSIONS.get(admin.get("role"), frozenset()))}
    return {"success": True, "data": profile}


def _count(table_name: str, filters: list[tuple[str, str, object]] | None = None) -> int:
    query = supabase.table(table_name).select("id", count="exact", head=True)
    for operator, column, value in filters or []:
        if operator == "not_is":
            query = query.not_.is_(column, value)
        else:
            query = getattr(query, operator)(column, value)
    result = query.execute()
    return int(result.count or 0)


@router.get("/dashboard/overview")
def dashboard_overview(
    range_days: int = Query(30, ge=1, le=90),
    admin: dict = Depends(require_permissions("dashboard.read")),
):
    """Return operational metrics from Supabase without fabricated fallbacks."""
    del admin
    period_start = now() - timedelta(days=range_days)
    period_iso = period_start.isoformat()
    try:
        users_period = [("gte", "created_at", period_iso)]
        scans_period = [("gte", "created_at", period_iso)]
        feedback_period = [("gte", "created_at", period_iso)]
        support_period = [("gte", "created_at", period_iso)]
        audit_period = [("gte", "created_at", period_iso)]

        scan_counts = {
            "total": _count("scans", scans_period),
            "completed": _count("scans", scans_period + [("eq", "status", "COMPLETED")]),
            "failed": _count("scans", scans_period + [("eq", "status", "FAILED")]),
            "processing": _count("scans", scans_period + [("eq", "status", "PROCESSING")]),
            "safe": _count("scans", scans_period + [("eq", "classification", "SAFE")]),
            "suspicious": _count("scans", scans_period + [("eq", "classification", "SUSPICIOUS")]),
            "dangerous": _count("scans", scans_period + [("eq", "classification", "DANGEROUS")]),
            "unknown": _count("scans", scans_period + [("eq", "classification", "UNKNOWN")]),
            "needs_review": _count("scans", scans_period + [("eq", "classification", "NEEDS_REVIEW")]),
        }
        recent_audit = supabase.table("admin_audit_logs").select(
            "id,action,resource_type,resource_id,created_at,admin_user_id"
        ).gte("created_at", period_iso).order("created_at", desc=True).limit(8).execute()
        data = {
            "range_days": range_days,
            "period_start": period_iso,
            "generated_at": now().isoformat(),
            "users": {
                "total": _count("custom_users"),
                "active": _count("custom_users", [("eq", "status", "ACTIVE")]),
                "suspended": _count("custom_users", [("eq", "status", "SUSPENDED")]),
                "new": _count("custom_users", users_period),
            },
            "scans": scan_counts,
            "feedback": {
                "total": _count("feedback", feedback_period),
                "new": _count("feedback", feedback_period + [("eq", "status", "NEW")]),
                "reviewed": _count("feedback", feedback_period + [("eq", "status", "REVIEWED")]),
            },
            "support": {
                "open": _count("support_requests", [("eq", "status", "OPEN")]),
                "in_progress": _count("support_requests", [("eq", "status", "IN_PROGRESS")]),
                "urgent_open": _count("support_requests", [("eq", "status", "OPEN"), ("eq", "priority", "URGENT")]),
                "new": _count("support_requests", support_period),
            },
            "audit": {
                "period_events": _count("admin_audit_logs", audit_period),
                "recent": recent_audit.data or [],
            },
        }
        return {"success": True, "data": data}
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تحميل مؤشرات Dashboard من قاعدة البيانات") from None


@router.get("/users")
def users(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None, max_length=120),
    status: Literal["ACTIVE", "SUSPENDED", "DELETED"] | None = Query(None),
    admin: dict = Depends(require_permissions("users.read")),
):
    del admin
    query = supabase.table("custom_users").select(
        "id,email,display_name,role,status,email_verified,preferred_language,last_login_at,created_at,updated_at",
        count="exact",
    )
    if search:
        safe_search = search.strip().replace("%", "").replace("_", "").replace(",", "")
        if safe_search:
            query = query.or_(f"email.ilike.%{safe_search}%,display_name.ilike.%{safe_search}%")
    if status:
        query = query.eq("status", status)
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"success": True, "data": result.data or [], "meta": {"limit": limit, "offset": offset, "total": int(result.count or 0)}}


@router.get("/users/{user_id}")
def user_details(user_id: UUID, admin: dict = Depends(require_permissions("users.read"))):
    del admin
    result = supabase.table("custom_users").select(
        "id,email,display_name,role,status,email_verified,preferred_language,last_login_at,created_at,updated_at"
    ).eq("id", str(user_id)).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    user = result.data[0]
    try:
        user["scan_count"] = _count("scans", [("eq", "user_id", str(user_id))])
        user["feedback_count"] = _count("feedback", [("eq", "user_id", str(user_id))])
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تحميل إحصاءات المستخدم") from None
    return {"success": True, "data": user}


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: UUID,
    request: UserStatusRequest,
    http_request: Request,
    admin: dict = Depends(require_permissions("users.manage")),
):
    result = supabase.table("custom_users").select("id,status,email,display_name").eq("id", str(user_id)).limit(1).execute()
    user = result.data[0] if result.data else None
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if user["status"] == "DELETED":
        raise HTTPException(status_code=409, detail="لا يمكن تغيير حالة مستخدم محذوف")
    if user["status"] == request.status:
        return {"success": True, "data": user, "changed": False}
    updated = supabase.table("custom_users").update({"status": request.status}).eq("id", str(user_id)).execute()
    data = (updated.data or [None])[0] or {**user, "status": request.status}
    _audit(
        str(admin["id"]),
        "ADMIN_USER_STATUS_CHANGED",
        "custom_user",
        str(user_id),
        http_request,
        before={"status": user["status"]},
        after={"status": request.status, "reason": request.reason},
        target_user_id=str(user_id),
    )
    return {"success": True, "data": data, "changed": True}


@router.get("/sessions")
def sessions(admin: dict = Depends(require_permissions("sessions.read"))):
    result = supabase.table("admin_sessions").select("id,created_at,last_used_at,expires_at,revoked_at,revoke_reason,ip_hash,user_agent_hash").eq("admin_user_id", admin["id"]).order("created_at", desc=True).limit(100).execute()
    return {"success": True, "data": result.data or []}


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: UUID, http_request: Request, admin: dict = Depends(require_permissions("sessions.manage"))):
    result = supabase.table("admin_sessions").update({"revoked_at": now().isoformat(), "revoke_reason": "ADMIN_REVOKED"}).eq("id", str(session_id)).eq("admin_user_id", admin["id"]).is_("revoked_at", "null").execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    _audit(str(admin["id"]), "ADMIN_SESSION_REVOKED", "admin_session", str(session_id), http_request)
    return {"success": True}


_AUDIT_SECRET_KEYS = ("password", "token", "secret", "code", "hash", "cipher", "nonce")


def _redact_audit(value):
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            lowered = str(key).lower()
            if any(part in lowered for part in _AUDIT_SECRET_KEYS):
                redacted[key] = "[REDACTED]"
            elif lowered == "email" and isinstance(item, str):
                local, separator, domain = item.partition("@")
                redacted[key] = f"{local[:2]}***{separator}{domain}" if separator else "[REDACTED]"
            else:
                redacted[key] = _redact_audit(item)
        return redacted
    if isinstance(value, list):
        return [_redact_audit(item) for item in value]
    return value


@router.get("/audit-logs")
def audit_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None, max_length=100),
    resource_type: str | None = Query(None, max_length=80),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    admin: dict = Depends(require_permissions("audit.read")),
):
    del admin
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="نطاق التاريخ غير صحيح")
    query = supabase.table("admin_audit_logs").select(
        "id,admin_user_id,action,resource_type,resource_id,target_user_id,target_scan_id,request_id,created_at",
        count="exact",
    )
    if action:
        query = query.eq("action", action.strip())
    if resource_type:
        query = query.eq("resource_type", resource_type.strip())
    if from_date:
        query = query.gte("created_at", from_date.isoformat())
    if to_date:
        query = query.lte("created_at", to_date.isoformat())
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"success": True, "data": result.data or [], "meta": {"limit": limit, "offset": offset, "total": int(result.count or 0)}}


@router.get("/audit-logs/{log_id}")
def audit_log_details(log_id: UUID, admin: dict = Depends(require_permissions("audit.read"))):
    del admin
    result = supabase.table("admin_audit_logs").select(
        "id,admin_user_id,action,resource_type,resource_id,target_user_id,target_scan_id,request_id,before_data,after_data,metadata_masked,created_at"
    ).eq("id", str(log_id)).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="سجل التدقيق غير موجود")
    row = result.data[0]
    row["before_data"] = _redact_audit(row.get("before_data") or {})
    row["after_data"] = _redact_audit(row.get("after_data") or {})
    row["metadata_masked"] = _redact_audit(row.get("metadata_masked") or {})
    return {"success": True, "data": row}


@router.get("/security/overview")
def security_overview(
    range_days: int = Query(7, ge=1, le=30),
    admin: dict = Depends(require_permissions("audit.read")),
):
    del admin
    period_start = now() - timedelta(days=range_days)
    period_iso = period_start.isoformat()
    try:
        failed_outcomes = ["INVALID_CREDENTIALS", "INVALID_2FA", "RATE_LIMITED", "LOCKED", "SUSPENDED"]
        data = {
            "range_days": range_days,
            "period_start": period_iso,
            "generated_at": now().isoformat(),
            "login_attempts": {
                "total": _count("admin_login_attempts", [("gte", "created_at", period_iso)]),
                "successful": _count("admin_login_attempts", [("gte", "created_at", period_iso), ("eq", "outcome", "SUCCESS")]),
                "failed": sum(_count("admin_login_attempts", [("gte", "created_at", period_iso), ("eq", "outcome", outcome)]) for outcome in failed_outcomes),
                "rate_limited": _count("admin_login_attempts", [("gte", "created_at", period_iso), ("eq", "outcome", "RATE_LIMITED")]),
            },
            "sessions": {
                "active": _count("admin_sessions", [("is_", "revoked_at", "null"), ("gte", "expires_at", now().isoformat())]),
                "revoked": _count("admin_sessions", [("gte", "created_at", period_iso), ("not_is", "revoked_at", "null")]),
            },
            "admins": {
                "active": _count("admin_users", [("eq", "status", "ACTIVE")]),
                "suspended": _count("admin_users", [("eq", "status", "SUSPENDED")]),
            },
            "audit_events": _count("admin_audit_logs", [("gte", "created_at", period_iso)]),
        }
        data["risk_level"] = "HIGH" if data["login_attempts"]["rate_limited"] > 0 else "ELEVATED" if data["login_attempts"]["failed"] >= 5 else "NORMAL"
        return {"success": True, "data": data}
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تحميل مؤشرات أمان الإدارة") from None


@router.post("/invitations")
def invite(request: InviteRequest, http_request: Request, admin: dict = Depends(require_roles("SUPER_ADMIN"))):
    if request.role == "SUPER_ADMIN" and admin["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can invite SUPER_ADMIN")
    active = supabase.table("admin_invitations").select("id").eq(
        "email", str(request.email).lower()
    ).is_("accepted_at", "null").is_("revoked_at", "null").gt("expires_at", now().isoformat()).limit(1).execute()
    if active.data:
        raise HTTPException(status_code=409, detail="An active invitation already exists for this email")
    raw = new_refresh_token()
    result = supabase.table("admin_invitations").insert({"email": str(request.email).lower(), "role": request.role, "invited_by": admin["id"], "token_hash": refresh_hash(raw), "expires_at": (now() + timedelta(days=2)).isoformat()}).execute()
    invitation = result.data[0]
    _audit(str(admin["id"]), "ADMIN_INVITATION_CREATED", "admin_invitation", invitation["id"], http_request, after={"email": str(request.email).lower(), "role": request.role})
    return {"success": True, "data": {"id": invitation["id"], "token": raw, "expires_at": invitation["expires_at"]}}


@router.post("/auth/invitations/accept", status_code=201)
def accept_invitation(request: InvitationAcceptRequest, http_request: Request):
    try:
        result = supabase.rpc("admin_accept_invitation", {
            "p_token_hash": refresh_hash(request.token),
            "p_email": str(request.email).strip().lower(),
            "p_display_name": request.display_name.strip(),
            "p_password_hash": hash_password(request.password),
        }).execute()
        admin = result.data if isinstance(result.data, dict) else (result.data or [None])[0]
    except Exception:
        raise HTTPException(status_code=400, detail="Invitation is invalid, expired, or already used") from None
    if not admin:
        raise HTTPException(status_code=503, detail="Unable to accept invitation")
    _audit(str(admin["id"]), "ADMIN_INVITATION_ACCEPTED", "admin_invitation", str(admin["invitation_id"]), http_request, after={"role": admin["role"], "status": admin["status"]})
    return {"success": True, "data": {"id": admin["id"], "email": admin["email"], "role": admin["role"], "requires_2fa_setup": True}}


# ---------------------------------------------------------------------------
# Operational Admin modules: scans, feedback, support, deletion requests,
# and bounded statistics. All write operations are permission-gated and audited.
# ---------------------------------------------------------------------------

class ScanReviewRequest(BaseModel):
    classification: Literal["SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN", "NEEDS_REVIEW"]
    reason: str = Field(min_length=3, max_length=500)


class FeedbackStatusRequest(BaseModel):
    status: Literal["NEW", "REVIEWED", "USED_FOR_ANALYSIS"]
    note: str | None = Field(default=None, max_length=1000)


class DeletionDecisionRequest(BaseModel):
    status: Literal["CANCELLED", "PROCESSING", "COMPLETED"]
    reason: str = Field(min_length=3, max_length=500)


def _paged(table: str, fields: str, limit: int, offset: int, filters: list[tuple[str, str, object]] | None = None):
    query = supabase.table(table).select(fields, count="exact")
    for operator, column, value in filters or []:
        query = getattr(query, operator)(column, value)
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or [], {"limit": limit, "offset": offset, "total": int(result.count or 0)}


@router.get("/scans")
def admin_scans(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Literal["PROCESSING", "COMPLETED", "FAILED"] | None = Query(None),
    classification: Literal["SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN", "NEEDS_REVIEW"] | None = Query(None),
    input_type: Literal["URL", "TEXT", "MESSAGE", "FILE", "EMAIL_HEADER"] | None = Query(None),
    user_id: UUID | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    admin: dict = Depends(require_permissions("scans.read")),
):
    del admin
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="نطاق التاريخ غير صحيح")
    filters = []
    if status: filters.append(("eq", "status", status))
    if classification: filters.append(("eq", "classification", classification))
    if input_type: filters.append(("eq", "input_type", input_type))
    if user_id: filters.append(("eq", "user_id", str(user_id)))
    if from_date: filters.append(("gte", "created_at", from_date.isoformat()))
    if to_date: filters.append(("lte", "created_at", to_date.isoformat()))
    rows, meta = _paged(
        "scans",
        "id,user_id,input_type,input_language,status,classification,confidence_score,confidence_level,recommendation,model_version_id,created_at,completed_at,error_code",
        limit, offset, filters,
    )
    return {"success": True, "data": rows, "meta": meta}


@router.get("/scans/{scan_id}")
def admin_scan_details(scan_id: UUID, admin: dict = Depends(require_permissions("scans.read"))):
    del admin
    result = supabase.table("scans").select(
        "id,user_id,input_type,input_value_masked,input_hash,input_language,status,classification,confidence_score,confidence_level,recommendation,model_version_id,request_id,error_code,analysis_snapshot,created_at,completed_at"
    ).eq("id", str(scan_id)).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="الفحص غير موجود")
    data = result.data[0]
    signals = supabase.table("scan_signals").select(
        "id,signal_code,signal_label_en,signal_label_ar,severity,evidence_masked,source,created_at"
    ).eq("scan_id", str(scan_id)).order("created_at", desc=True).limit(100).execute()
    explanations = supabase.table("scan_explanations").select(
        "id,language,summary,reasons,recommendation,provider,prompt_version,created_at"
    ).eq("scan_id", str(scan_id)).order("created_at", desc=True).limit(20).execute()
    data["signals"] = signals.data or []
    data["explanations"] = explanations.data or []
    return {"success": True, "data": data}


@router.patch("/scans/{scan_id}/review")
def review_scan(
    scan_id: UUID,
    request: ScanReviewRequest,
    http_request: Request,
    admin: dict = Depends(require_permissions("scans.review")),
):
    result = supabase.table("scans").select("id,classification,status,analysis_snapshot").eq("id", str(scan_id)).limit(1).execute()
    scan = result.data[0] if result.data else None
    if not scan:
        raise HTTPException(status_code=404, detail="الفحص غير موجود")
    before = {"classification": scan.get("classification")}
    snapshot = scan.get("analysis_snapshot") or {}
    if not isinstance(snapshot, dict): snapshot = {}
    snapshot["admin_review"] = {"reviewed_by": str(admin["id"]), "reason": request.reason, "reviewed_at": now().isoformat()}
    updated = supabase.table("scans").update({"classification": request.classification, "analysis_snapshot": snapshot}).eq("id", str(scan_id)).execute()
    data = (updated.data or [None])[0] or {**scan, "classification": request.classification}
    _audit(str(admin["id"]), "ADMIN_SCAN_REVIEWED", "scan", str(scan_id), http_request, before=before, after={"classification": request.classification, "reason": request.reason}, target_scan_id=str(scan_id))
    return {"success": True, "data": data}


@router.get("/feedback")
def admin_feedback(
    limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0),
    status: Literal["NEW", "REVIEWED", "USED_FOR_ANALYSIS"] | None = Query(None),
    admin: dict = Depends(require_permissions("feedback.read")),
):
    del admin
    filters = [("eq", "status", status)] if status else []
    rows, meta = _paged("feedback", "id,scan_id,user_id,reported_classification,comment,status,reviewed_at,created_at", limit, offset, filters)
    return {"success": True, "data": rows, "meta": meta}


@router.patch("/feedback/{feedback_id}/status")
def update_feedback(
    feedback_id: UUID,
    request: FeedbackStatusRequest,
    http_request: Request,
    admin: dict = Depends(require_permissions("feedback.manage")),
):
    result = supabase.table("feedback").select("id,status,scan_id").eq("id", str(feedback_id)).limit(1).execute()
    row = result.data[0] if result.data else None
    if not row: raise HTTPException(status_code=404, detail="البلاغ غير موجود")
    payload = {"status": request.status, "reviewed_at": now().isoformat(), "reviewed_by_admin_id": str(admin["id"])}
    updated = supabase.table("feedback").update(payload).eq("id", str(feedback_id)).execute()
    _audit(str(admin["id"]), "ADMIN_FEEDBACK_STATUS_CHANGED", "feedback", str(feedback_id), http_request, before={"status": row["status"]}, after={"status": request.status, "note": request.note}, target_scan_id=row.get("scan_id"))
    return {"success": True, "data": (updated.data or [None])[0] or {**row, **payload}}


@router.get("/support")
def admin_support(
    limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0),
    status: Literal["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] | None = Query(None),
    priority: Literal["LOW", "NORMAL", "HIGH", "URGENT"] | None = Query(None),
    admin: dict = Depends(require_permissions("support.read")),
):
    del admin
    filters = []
    if status: filters.append(("eq", "status", status))
    if priority: filters.append(("eq", "priority", priority))
    rows, meta = _paged("support_requests", "id,user_id,email,subject,message,status,priority,admin_reply,replied_at,assigned_admin_id,created_at,resolved_at", limit, offset, filters)
    return {"success": True, "data": rows, "meta": meta}


@router.patch("/support/{support_id}")
def update_support(
    support_id: UUID,
    request: SupportReplyRequest,
    http_request: Request,
    admin: dict = Depends(require_permissions("support.manage")),
):
    result = supabase.table("support_requests").select("id,status,priority,user_id,subject").eq("id", str(support_id)).limit(1).execute()
    row = result.data[0] if result.data else None
    if not row: raise HTTPException(status_code=404, detail="طلب الدعم غير موجود")
    payload = {key: value for key, value in {"status": request.status, "priority": request.priority}.items() if value is not None}
    if request.assign_to_me:
        payload["assigned_admin_id"] = str(admin["id"])
    if request.status in {"RESOLVED", "CLOSED"}: payload["resolved_at"] = now().isoformat()
    if request.reply and request.reply.strip():
        payload["admin_reply"] = request.reply.strip()
        payload["replied_at"] = now().isoformat()
    if not payload: raise HTTPException(status_code=422, detail="لا يوجد تعديل")
    updated = supabase.table("support_requests").update(payload).eq("id", str(support_id)).execute()
    if request.reply and request.reply.strip() and row.get("user_id"):
        _user_notification(str(row["user_id"]), f"رد على طلب الدعم: {row.get('subject') or ''}", request.reply.strip())
    _audit(str(admin["id"]), "ADMIN_SUPPORT_UPDATED", "support_request", str(support_id), http_request, before={"status": row.get("status"), "priority": row.get("priority")}, after={**payload, "note": request.note})
    return {"success": True, "data": (updated.data or [None])[0] or {**row, **payload}}


@router.post("/notifications/broadcast")
def broadcast_notification(request: BroadcastNotificationRequest, http_request: Request, admin: dict = Depends(require_permissions("users.manage"))):
    count_result = supabase.table("custom_users").select("id", count="exact", head=True).eq("status", "ACTIVE").execute()
    if (count_result.count or 0) > 10000:
        raise HTTPException(status_code=413, detail="Broadcast audience exceeds the safe batch limit")
    users = supabase.table("custom_users").select("id").eq("status", "ACTIVE").limit(10000).execute().data or []
    rows = [{"user_id": str(user["id"]), "type": "SYSTEM", "title": request.title.strip(), "body": request.body.strip()} for user in users]
    for start in range(0, len(rows), 500):
        if rows[start:start + 500]: supabase.table("notifications").insert(rows[start:start + 500]).execute()
    _audit(str(admin["id"]), "ADMIN_NOTIFICATION_BROADCAST", "notification", None, http_request, after={"recipient_count": len(rows), "title": request.title.strip()})
    return {"success": True, "data": {"recipient_count": len(rows)}}


@router.get("/deletion-requests")
def admin_deletion_requests(
    limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0),
    status: Literal["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"] | None = Query(None),
    admin: dict = Depends(require_permissions("users.read")),
):
    del admin
    filters = [("eq", "status", status)] if status else []
    rows, meta = _paged("account_deletion_requests", "id,user_id,status,reason,requested_at,confirmed_at,completed_at,cancelled_at,failure_reason,processed_by_admin_id,decision_reason", limit, offset, filters)
    return {"success": True, "data": rows, "meta": meta}


@router.patch("/deletion-requests/{request_id}")
def decide_deletion_request(
    request_id: UUID,
    request: DeletionDecisionRequest,
    http_request: Request,
    admin: dict = Depends(require_permissions("users.manage")),
):
    result = supabase.table("account_deletion_requests").select("id,status,user_id").eq("id", str(request_id)).limit(1).execute()
    row = result.data[0] if result.data else None
    if not row: raise HTTPException(status_code=404, detail="طلب الحذف غير موجود")
    allowed_transitions = {
        "PENDING": {"CANCELLED"},
        "CONFIRMED": {"PROCESSING", "CANCELLED"},
        "PROCESSING": {"COMPLETED"},
    }
    if request.status not in allowed_transitions.get(row["status"], set()):
        raise HTTPException(status_code=409, detail="Invalid deletion request state transition")
    payload = {"status": request.status, "processed_by_admin_id": str(admin["id"]), "decision_reason": request.reason}
    if request.status == "COMPLETED": payload["completed_at"] = now().isoformat()
    if request.status == "CANCELLED": payload["cancelled_at"] = now().isoformat()
    updated = supabase.table("account_deletion_requests").update(payload).eq("id", str(request_id)).eq("status", row["status"]).select("id,status,user_id").execute()
    if not updated.data:
        raise HTTPException(status_code=409, detail="Deletion request changed concurrently")
    _audit(str(admin["id"]), "ADMIN_DELETION_REQUEST_DECIDED", "account_deletion_request", str(request_id), http_request, before={"status": row["status"]}, after={"status": request.status, "reason": request.reason}, target_user_id=row.get("user_id"))
    return {"success": True, "data": (updated.data or [None])[0] or {**row, **payload}}


@router.get("/statistics/overview")
def statistics_overview(
    range_days: int = Query(30, ge=1, le=90),
    admin: dict = Depends(require_permissions("dashboard.read")),
):
    del admin
    start = (now() - timedelta(days=range_days)).isoformat()
    try:
        counts = {
            "scans": _count("scans", [("gte", "created_at", start)]),
            "completed": _count("scans", [("gte", "created_at", start), ("eq", "status", "COMPLETED")]),
            "failed": _count("scans", [("gte", "created_at", start), ("eq", "status", "FAILED")]),
            "safe": _count("scans", [("gte", "created_at", start), ("eq", "classification", "SAFE")]),
            "suspicious": _count("scans", [("gte", "created_at", start), ("eq", "classification", "SUSPICIOUS")]),
            "dangerous": _count("scans", [("gte", "created_at", start), ("eq", "classification", "DANGEROUS")]),
            "feedback": _count("feedback", [("gte", "created_at", start)]),
            "support": _count("support_requests", [("gte", "created_at", start)]),
        }
        denominator = counts["scans"] or 1
        counts["threat_rate"] = round((counts["dangerous"] + counts["suspicious"]) / denominator, 4)
        return {"success": True, "data": {"range_days": range_days, "period_start": start, "generated_at": now().isoformat(), "counts": counts}}
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تحميل الإحصائيات") from None
