from datetime import datetime, timezone
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.auth.security import AuthSecurityError, get_authenticated_user
from app.security.guest_rate_limit import enforce_guest_rate_limit
from app.scans.service import ScanPersistenceError, ScanService
from app.scans.url_utils import normalize_web_url
from app.db.supabase_client import supabase
from app.system_settings import SystemSettingsUnavailable, setting_enabled
from app.observability import log_event, safe_error

router = APIRouter()
logger = logging.getLogger(__name__)


class ScanRequest(BaseModel):
    input_type: Literal["URL", "TEXT"] = "URL"
    input_value: str = Field(min_length=1, max_length=4096)
    language: Literal["ar", "en"] = "ar"


def _parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if authorization is None:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="جلسة غير صالحة")
    return parts[1]


async def get_optional_user_id(authorization: Optional[str] = None) -> Optional[str]:
    """Return a verified custom-auth user ID; malformed credentials fail closed."""
    token = _parse_bearer_token(authorization)
    if token is None:
        return None
    try:
        user = get_authenticated_user(token)
        require_latest_terms(user)
        return str(user["id"])
    except AuthSecurityError as error:
        log_event(logger, logging.WARNING, "authentication_failed", error_code="AUTH_REQUIRED", error_type=safe_error(error), user_context="authenticated")
        raise HTTPException(status_code=401, detail="جلسة غير صالحة") from None


async def get_required_user_id(authorization: Optional[str]) -> str:
    user_id = await get_optional_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="تسجيل الدخول مطلوب")
    return user_id


def _validate_input(request: ScanRequest) -> str:
    value = request.input_value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="المدخل مطلوب")
    if request.input_type == "URL":
        try:
            return normalize_web_url(value)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail="أدخل رابط ويب واحداً صالحاً يستخدم HTTP أو HTTPS؛ استخدم وضع الرسالة للنصوص أو الروابط المتعددة",
            ) from None
    return value


_UNCALIBRATED_SCORE_FIELDS = {
    "confidence", "confidence_score", "confidence_level", "phishing_prob",
    "ml_phishing_prob", "fraud_probability", "weighted_score",
    "urgency_pressure_score", "credential_theft_score", "identity_spoofing_score",
}


def _redact_uncalibrated_scores(value):
    if isinstance(value, list):
        return [_redact_uncalibrated_scores(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: None if key in _UNCALIBRATED_SCORE_FIELDS else _redact_uncalibrated_scores(item)
        for key, item in value.items()
    }


@router.post("/guest")
async def create_guest_scan(
    request: ScanRequest,
    response: Response,
    _: None = Depends(enforce_guest_rate_limit),
):
    """Run ML, VirusTotal, and Gemini for the guest without persistence."""
    try:
        guest_scanning_enabled = setting_enabled("features.guest_scans_enabled")
    except SystemSettingsUnavailable:
        raise HTTPException(
            status_code=503,
            detail="تعذر التحقق من إعدادات الفحص",
            headers={"X-Dependency-Error": "SYSTEM_SETTINGS_UNAVAILABLE"},
        ) from None
    if not guest_scanning_enabled:
        raise HTTPException(status_code=403, detail="فحص الضيف متوقف حالياً؛ سجّل الدخول لاستخدام الفحص")
    try:
        raw_input = _validate_input(request)
    except HTTPException:
        log_event(logger, logging.WARNING, "scan_validation_failed", input_type=request.input_type, error_code="INVALID_INPUT", user_context="guest")
        raise
    log_event(logger, logging.INFO, "scan_validation_succeeded", input_type=request.input_type, mode="guest", user_context="guest")
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    result = await ScanService.process_guest_scan(
        input_type=request.input_type,
        raw_input=raw_input,
        language=request.language,
    )
    return {"success": True, "data": result}


@router.post("/")
async def create_authenticated_scan(
    request: ScanRequest,
    response: Response,
    authorization: Optional[str] = Header(None),
):
    """Persist a scan only for the account verified from the bearer token."""
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    try:
        raw_input = _validate_input(request)
    except HTTPException:
        log_event(logger, logging.WARNING, "scan_validation_failed", input_type=request.input_type, error_code="INVALID_INPUT", user_context="authenticated")
        raise
    user_id = await get_required_user_id(authorization)
    log_event(logger, logging.INFO, "scan_validation_succeeded", input_type=request.input_type, mode="authenticated", user_context="authenticated")
    try:
        result = await ScanService.process_authenticated_scan(
            input_type=request.input_type,
            raw_input=raw_input,
            user_id=user_id,
            language=request.language,
        )
    except ScanPersistenceError:
        raise HTTPException(status_code=503, detail="تعذر حفظ نتيجة الفحص") from None
    return {"success": True, "data": result}


@router.get("/")
async def get_scans(
    response: Response,
    authorization: Optional[str] = Header(None),
):
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    user_id = await get_required_user_id(authorization)
    try:
        scans = await ScanService.get_recent_scans(limit=50, user_id=user_id)
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تحميل سجل الفحوصات") from None
    return {"success": True, "data": _redact_uncalibrated_scores(scans)}


@router.post("/{scan_id}/hide")
async def hide_scan(
    scan_id: str,
    authorization: Optional[str] = Header(None),
):
    user_id = await get_required_user_id(authorization)
    try:
        owned = supabase.table("scans").select("id").eq("id", scan_id).eq("user_id", user_id).is_("user_deleted_at", "null").limit(1).execute()
        if not owned.data:
            raise HTTPException(status_code=404, detail="الفحص غير موجود أو لا تملك صلاحية الوصول إليه")
        result = supabase.table("scans").update({"user_hidden_at": datetime.now(timezone.utc).isoformat()}).eq("id", scan_id).eq("user_id", user_id).execute()
        return {"success": True, "data": (result.data or [{"id": scan_id, "user_hidden_at": True}])[0]}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر إخفاء الفحص") from None


@router.post("/{scan_id}/unhide")
async def unhide_scan(
    scan_id: str,
    authorization: Optional[str] = Header(None),
):
    user_id = await get_required_user_id(authorization)
    try:
        owned = supabase.table("scans").select("id").eq("id", scan_id).eq("user_id", user_id).is_("user_deleted_at", "null").limit(1).execute()
        if not owned.data:
            raise HTTPException(status_code=404, detail="الفحص غير موجود أو لا تملك صلاحية الوصول إليه")
        result = supabase.table("scans").update({"user_hidden_at": None}).eq("id", scan_id).eq("user_id", user_id).execute()
        return {"success": True, "data": (result.data or [{"id": scan_id, "user_hidden_at": None}])[0]}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر إظهار الفحص") from None


@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: str,
    authorization: Optional[str] = Header(None),
):
    """User deletion is privacy-preserving soft deletion, not a destructive DB delete."""
    user_id = await get_required_user_id(authorization)
    try:
        now = datetime.now(timezone.utc).isoformat()
        deleted = supabase.rpc("nabeh_delete_user_scan", {
            "p_user_id": user_id,
            "p_scan_id": scan_id,
            "p_deleted_at": now,
        }).execute()
        if deleted.data is not True:
            raise HTTPException(status_code=404, detail="الفحص غير موجود أو لا تملك صلاحية الوصول إليه")
        return {"success": True, "message": "تم حذف بيانات الفحص من سجلك", "data": {"id": scan_id, "user_deleted_at": now}}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر حذف بيانات الفحص") from None


@router.get("/compare")
async def compare_scans(
    response: Response,
    ids: str = Query(..., description="Comma-separated scan IDs, maximum 4"),
    authorization: Optional[str] = Header(None),
):
    user_id = await get_required_user_id(authorization)
    scan_ids = [item.strip() for item in ids.split(",") if item.strip()]
    if len(scan_ids) < 2 or len(scan_ids) > 4:
        raise HTTPException(status_code=422, detail="اختر فحصين إلى أربعة فحوصات للمقارنة")
    try:
        result = supabase.table("scans").select(
            "id,input_type,input_value_masked,status,classification,confidence_score,confidence_level,recommendation,created_at,completed_at"
        ).eq("user_id", user_id).is_("user_hidden_at", "null").is_("user_deleted_at", "null").in_("id", scan_ids).order("created_at", desc=False).execute()
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تحميل بيانات المقارنة") from None
    if len(result.data or []) < 2:
        raise HTTPException(status_code=404, detail="لم يتم العثور على فحوصات كافية تخص حسابك")
    return {"success": True, "data": _redact_uncalibrated_scores(result.data or [])}


@router.get("/{scan_id}")
async def get_scan_details(
    scan_id: str,
    response: Response,
    authorization: Optional[str] = Header(None),
):
    user_id = await get_required_user_id(authorization)
    response.headers["Cache-Control"] = "no-store, private"
    try:
        try:
            result = supabase.table("scans").select(
                "id,user_id,input_type,input_value_masked,status,classification,confidence_score,confidence_level,recommendation,analysis_snapshot,created_at,completed_at"
            ).eq("id", scan_id).eq("user_id", user_id).is_("user_hidden_at", "null").is_("user_deleted_at", "null").limit(1).execute()
        except Exception:
            result = supabase.table("scans").select(
                "id,user_id,input_type,input_value_masked,status,classification,confidence_score,confidence_level,recommendation,created_at,completed_at"
            ).eq("id", scan_id).eq("user_id", user_id).is_("user_hidden_at", "null").is_("user_deleted_at", "null").limit(1).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="الفحص غير موجود أو لا تملك صلاحية الوصول إليه")
        explanation = supabase.table("scan_explanations").select(
            "id,language,summary,reasons,recommendation,provider,created_at"
        ).eq("scan_id", scan_id).order("created_at", desc=True).limit(1).execute()
        safe_scan = _redact_uncalibrated_scores(result.data[0])
        return {"success": True, "data": {"scan": safe_scan, "explanation": (explanation.data or [None])[0]}}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر تحميل تفاصيل الفحص") from None
from app.legal.terms_consent import require_latest_terms
