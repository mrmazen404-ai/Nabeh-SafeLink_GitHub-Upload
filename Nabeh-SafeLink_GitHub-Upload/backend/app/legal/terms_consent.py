from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from app.auth.security import AuthSecurityError, get_authenticated_user
from app.db.supabase_client import supabase
from app.system_settings import SystemSettingsUnavailable, get_system_settings, setting_enabled

router = APIRouter(prefix="/api/v1/legal", tags=["Legal consent"])


def _require_user(authorization: Optional[str]) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="تسجيل الدخول مطلوب")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="جلسة غير صالحة")
    try:
        return get_authenticated_user(parts[1])
    except AuthSecurityError:
        raise HTTPException(status_code=401, detail="جلسة غير صالحة") from None


def _latest_terms(language: str) -> dict:
    lang_key = "ar" if language == "ar" else "en"
    try:
        result = (
            supabase.table("policy_documents")
            .select("id,policy_type,language,version,title,content_markdown,published_at")
            .eq("policy_type", "TERMS")
            .eq("language", lang_key)
            .eq("is_active", True)
            .order("published_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception:
        pass

    from app.legal.routes import DEFAULT_POLICIES
    default_doc = DEFAULT_POLICIES.get("TERMS", {}).get(lang_key, {})
    return {
        "id": f"default-terms-{lang_key}",
        "policy_type": "TERMS",
        "language": lang_key,
        "version": default_doc.get("version", "1.0"),
        "title": default_doc.get("title", "شروط الاستخدام"),
        "content_markdown": default_doc.get("content_markdown", ""),
        "published_at": None,
    }


def _consent_language(user: dict) -> str:
    try:
        settings = get_system_settings()
        if not settings.get("ui.allow_language_override", True):
            return settings.get("ui.default_language", "ar")
        preferred = user.get("preferred_language") if isinstance(user, dict) else None
        return preferred if preferred in {"ar", "en"} else settings.get("ui.default_language", "ar")
    except Exception:
        preferred = user.get("preferred_language") if isinstance(user, dict) else None
        return preferred if preferred in {"ar", "en"} else "ar"


def require_latest_terms(user: dict) -> None:
    """Enforce current terms on authenticated APIs, not only in the React route gate."""
    try:
        try:
            if not setting_enabled("legal.require_latest_terms"):
                return
        except Exception:
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
        if consent.data:
            return
    except HTTPException:
        raise
    except Exception:
        return
    if not consent.data:
        raise HTTPException(
            status_code=403,
            detail={"code": "TERMS_CONSENT_REQUIRED", "version": str(terms["version"])},
        )


@router.get("/terms-status")
def terms_status(authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    try:
        required = setting_enabled("legal.require_latest_terms")
    except Exception:
        required = True
    if not required:
        return {"success": True, "data": {"required": False, "accepted": True}}

    language = _consent_language(user)
    terms = _latest_terms(language)
    accepted = False
    try:
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
        accepted = bool(consent.data)
    except Exception:
        accepted = False

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
def accept_latest_terms(authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    try:
        required = setting_enabled("legal.require_latest_terms")
    except Exception:
        required = True
    if not required:
        return {"success": True, "data": {"accepted": True, "required": False}}

    user_id = str(user["id"])
    language = _consent_language(user)
    terms = _latest_terms(language)
    version = str(terms["version"])
    now = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table("privacy_consents").upsert({
            "user_id": user_id,
            "consent_type": "TERMS_OF_USE",
            "version": version,
            "granted": True,
            "accepted_at": now,
        }, on_conflict="user_id,consent_type,version").execute()
    except Exception:
        try:
            existing = supabase.table("privacy_consents").select("id").eq("user_id", user_id).eq("consent_type", "TERMS_OF_USE").eq("version", version).limit(1).execute()
            if existing.data:
                supabase.table("privacy_consents").update({"granted": True, "accepted_at": now}).eq("id", existing.data[0]["id"]).execute()
            else:
                from uuid import uuid4
                supabase.table("privacy_consents").insert({
                    "id": str(uuid4()),
                    "user_id": user_id,
                    "consent_type": "TERMS_OF_USE",
                    "version": version,
                    "granted": True,
                    "accepted_at": now,
                }).execute()
        except Exception:
            pass

    return {"success": True, "data": {"accepted": True, "required": True, "version": version}}
