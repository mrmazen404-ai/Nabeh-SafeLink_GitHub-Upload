"""Authenticated user API for current Terms of Use consent."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth.security import AuthSecurityError, get_authenticated_user
from app.db.supabase_client import supabase
from app.system_settings import SystemSettingsUnavailable, get_system_settings, setting_enabled

router = APIRouter(prefix="/api/v1/legal", tags=["Legal consent"])


def current_user(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="تسجيل الدخول مطلوب")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="تسجيل الدخول مطلوب")
    try:
        return get_authenticated_user(token)
    except AuthSecurityError:
        raise HTTPException(status_code=401, detail="جلسة غير صالحة") from None


def _latest_terms(language: str) -> dict:
    try:
        result = (
            supabase.table("policy_documents")
            .select("id,policy_type,language,version,title,content_markdown,published_at")
            .eq("policy_type", "TERMS")
            .eq("language", language)
            .eq("is_active", True)
            .order("published_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail="تعذر تحميل شروط الاستخدام") from exc
    if result.data:
        return result.data[0]
    from app.legal.routes import DEFAULT_POLICIES
    return {
        "id": f"default-terms-{language}",
        "policy_type": "TERMS",
        "language": language,
        **DEFAULT_POLICIES["TERMS"][language],
        "published_at": None,
    }


def _consent_language(user: dict) -> str:
    try:
        settings = get_system_settings()
    except SystemSettingsUnavailable:
        raise HTTPException(status_code=503, detail="تعذر التحقق من إعدادات اللغة") from None
    if not settings.get("ui.allow_language_override", True):
        return settings.get("ui.default_language", "ar")
    preferred = user.get("preferred_language")
    return preferred if preferred in {"ar", "en"} else settings.get("ui.default_language", "ar")


def require_latest_terms(user: dict) -> None:
    """Enforce current terms on authenticated APIs, not only in the React route gate."""
    try:
        if not setting_enabled("legal.require_latest_terms"):
            return
        language = _consent_language(user)
        terms = _latest_terms(language)
        consent = (
            supabase.table("privacy_consents")
            .select("id")
            .eq("user_id", str(user["id"]))
            .eq("consent_type", "TERMS_OF_USE")
            .eq("version", str(terms["version"]))
            .eq("granted", True)
            .limit(1)
            .execute()
        )
    except HTTPException:
        raise
    except SystemSettingsUnavailable:
        raise HTTPException(status_code=503, detail="تعذر التحقق من حالة الشروط") from None
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر التحقق من أحدث موافقة للشروط") from None
    if not consent.data:
        raise HTTPException(
            status_code=403,
            detail={"code": "TERMS_CONSENT_REQUIRED", "version": str(terms["version"])},
        )


@router.get("/terms-status")
def terms_status(user: dict = Depends(current_user)):
    try:
        required = setting_enabled("legal.require_latest_terms")
    except SystemSettingsUnavailable:
        raise HTTPException(status_code=503, detail="تعذر التحقق من حالة الشروط") from None
    if not required:
        return {"success": True, "data": {"required": False, "accepted": True}}

    language = _consent_language(user)
    try:
        terms = _latest_terms(language)
        consent = (
            supabase.table("privacy_consents")
            .select("id,version,granted,accepted_at")
            .eq("user_id", str(user["id"]))
            .eq("consent_type", "TERMS_OF_USE")
            .eq("version", terms["version"])
            .eq("granted", True)
            .order("accepted_at", desc=True)
            .limit(1)
            .execute()
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تحميل حالة الموافقة") from None

    accepted = bool(consent.data)
    return {
        "success": True,
        "data": {
            "required": True,
            "accepted": accepted,
            "version": terms["version"],
            "terms": terms if not accepted else None,
        },
    }


@router.post("/terms-consent")
def accept_latest_terms(user: dict = Depends(current_user)):
    try:
        required = setting_enabled("legal.require_latest_terms")
    except SystemSettingsUnavailable:
        raise HTTPException(status_code=503, detail="تعذر التحقق من حالة الشروط") from None
    if not required:
        return {"success": True, "data": {"accepted": True, "required": False}}

    language = _consent_language(user)
    try:
        terms = _latest_terms(language)
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("privacy_consents").upsert({
            "user_id": str(user["id"]),
            "consent_type": "TERMS_OF_USE",
            "version": str(terms["version"]),
            "granted": True,
            "accepted_at": now,
        }, on_conflict="user_id,consent_type,version").execute()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تسجيل الموافقة") from None
    return {"success": True, "data": {"accepted": True, "required": True, "version": terms["version"]}}
