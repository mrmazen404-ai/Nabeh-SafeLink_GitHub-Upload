"""Custom authentication: backend-generated OTP, EmailJS delivery, and JWT sessions."""

import base64
import hmac
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, EmailStr, Field

from app.auth.emailjs import send_otp_via_emailjs
from app.auth.security import (
    AuthSecurityError,
    generate_otp,
    get_authenticated_user,
    get_reset_user,
    get_user_by_email,
    hash_otp,
    hash_password,
    issue_access_token,
    normalize_email,
    verify_password,
)
from app.config import settings
from app.db.supabase_client import supabase
from app.observability import log_event, mask_email, safe_error
from app.security.guest_rate_limit import UpstashRateLimiter, client_identity
from app.system_settings import SystemSettingsUnavailable, get_system_settings, setting_enabled

logger = logging.getLogger(__name__)
router = APIRouter()


class EmailDeliveryError(Exception):
    """Raised when the verification message cannot be delivered."""


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=12, max_length=128)


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    token: str = Field(min_length=6, max_length=6)
    type: Literal["signup", "recovery"] = "signup"


class ResendOtpRequest(BaseModel):
    email: EmailStr
    type: Literal["signup", "recovery"] = "signup"


def _bearer_token(authorization: Optional[str]) -> str:
    parts = (authorization or "").split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="جلسة غير صالحة")
    return parts[1]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _increment_otp_attempts(otp: dict) -> None:
    attempts = int(otp.get("attempts", 0))
    result = (
        supabase.table("custom_auth_otps")
        .update({"attempts": attempts + 1})
        .eq("id", otp["id"])
        .eq("attempts", attempts)
        .is_("consumed_at", "null")
        .select("id")
        .execute()
    )
    if not result.data:
        raise ValueError("otp state changed")


def _consume_otp(otp: dict) -> None:
    now = _now().isoformat()
    result = (
        supabase.table("custom_auth_otps")
        .update({"consumed_at": now})
        .eq("id", otp["id"])
        .eq("code_hash", otp["code_hash"])
        .eq("attempts", int(otp.get("attempts", 0)))
        .is_("consumed_at", "null")
        .gt("expires_at", now)
        .select("id")
        .execute()
    )
    if not result.data:
        raise ValueError("otp unavailable or already consumed")


SYSTEM_PENDING_USER_ID = "00000000-0000-0000-0000-000000000000"


def _ensure_system_pending_user():
    """Ensure constant system pending user ID exists to satisfy custom_auth_otps FK constraint without creating unverified user records."""
    try:
        existing = supabase.table("custom_users").select("id").eq("id", SYSTEM_PENDING_USER_ID).limit(1).execute()
        if not existing.data:
            supabase.table("custom_users").insert({
                "id": SYSTEM_PENDING_USER_ID,
                "email": "system.pending@safelink.internal",
                "display_name": "System Pending Signup",
                "password_hash": "disabled",
                "email_verified": False,
                "preferred_language": "ar",
                "created_at": _now().isoformat(),
                "updated_at": _now().isoformat(),
            }).execute()
    except Exception:
        pass


def _issue_signup_otp(email: str, password_hash: str, display_name: str) -> None:
    """Store pending signup credentials in custom_auth_otps; custom_users remains untouched until OTP is verified."""
    _ensure_system_pending_user()
    log_event(logger, logging.INFO, "signup_otp_generation_started", recipient=mask_email(email))
    code = generate_otp()
    otp_id = str(uuid4())
    expires_at = (_now() + timedelta(minutes=settings.AUTH_OTP_MINUTES)).isoformat()

    otp_hash = hash_otp(code)
    b64_pass = base64.b64encode(password_hash.encode("utf-8")).decode("utf-8")
    b64_name = base64.b64encode(display_name.encode("utf-8")).decode("utf-8")
    composite_hash = f"signup${otp_hash}${b64_pass}${b64_name}"

    # Invalidate previous unconsumed signup OTPs for this email.
    supabase.table("custom_auth_otps").update({"consumed_at": _now().isoformat()}).eq(
        "email", normalize_email(email)
    ).eq("purpose", "signup").is_("consumed_at", "null").execute()

    supabase.table("custom_auth_otps").insert({
        "id": otp_id,
        "user_id": SYSTEM_PENDING_USER_ID,
        "email": normalize_email(email),
        "purpose": "signup",
        "code_hash": composite_hash,
        "expires_at": expires_at,
        "attempts": 0,
    }).execute()

    result = send_otp_via_emailjs(email, code, "signup")
    if not result.get("success"):
        supabase.table("custom_auth_otps").update({"consumed_at": _now().isoformat()}).eq(
            "id", otp_id
        ).execute()
        raise EmailDeliveryError(result.get("error", "email provider rejected OTP"))

    log_event(logger, logging.INFO, "signup_otp_delivery_succeeded", recipient=mask_email(email))


def _issue_recovery_otp(user_id: str, email: str) -> None:
    """Generate and store recovery OTP for existing verified users."""
    log_event(logger, logging.INFO, "recovery_otp_generation_started", recipient=mask_email(email))
    code = generate_otp()
    otp_id = str(uuid4())
    expires_at = (_now() + timedelta(minutes=settings.AUTH_OTP_MINUTES)).isoformat()

    otp_hash = hash_otp(code)
    composite_hash = f"recovery${otp_hash}"

    supabase.table("custom_auth_otps").update({"consumed_at": _now().isoformat()}).eq(
        "user_id", user_id
    ).eq("purpose", "recovery").is_("consumed_at", "null").execute()

    supabase.table("custom_auth_otps").insert({
        "id": otp_id,
        "user_id": user_id,
        "email": normalize_email(email),
        "purpose": "recovery",
        "code_hash": composite_hash,
        "expires_at": expires_at,
        "attempts": 0,
    }).execute()

    result = send_otp_via_emailjs(email, code, "recovery")
    if not result.get("success"):
        supabase.table("custom_auth_otps").update({"consumed_at": _now().isoformat()}).eq(
            "id", otp_id
        ).execute()
        raise EmailDeliveryError(result.get("error", "email provider rejected OTP"))

    log_event(logger, logging.INFO, "recovery_otp_delivery_succeeded", recipient=mask_email(email))


def _generic_auth_message() -> str:
    return "إذا كان البريد صالحاً، فستصلك رسالة التحقق عبر البريد الإلكتروني"


_AUTH_RATE_LIMIT_FAIL_CLOSED = os.getenv(
    "NABEH_AUTH_RATE_LIMIT_FAIL_CLOSED",
    os.getenv("NABEH_RATE_LIMIT_FAIL_CLOSED", "true"),
).lower() in {"1", "true", "yes"}


def _auth_limiters(limit: int, window_seconds: int, purpose: str) -> tuple[UpstashRateLimiter, UpstashRateLimiter]:
    return (
        UpstashRateLimiter(limit=limit * 4, window_seconds=window_seconds, fail_closed=_AUTH_RATE_LIMIT_FAIL_CLOSED, namespace=f"nabeh:auth:{purpose}:ip"),
        UpstashRateLimiter(limit=limit, window_seconds=window_seconds, fail_closed=_AUTH_RATE_LIMIT_FAIL_CLOSED, namespace=f"nabeh:auth:{purpose}:email"),
    )


async def _enforce_auth_limits(
    request: Request,
    email: str,
    limiters: tuple[UpstashRateLimiter, UpstashRateLimiter],
) -> None:
    ip_identity = client_identity(request)
    email_identity = normalize_email(email)
    for limiter, identity in zip(limiters, (ip_identity, email_identity)):
        decision = await limiter.check(identity)
        if not decision.allowed:
            log_event(logger, logging.WARNING, "rate_limit_rejected", purpose=limiter.namespace, user_context="system", error_code="RATE_LIMITED" if not decision.unavailable else "RATE_LIMIT_UNAVAILABLE")
            raise HTTPException(
                status_code=503 if decision.unavailable else 429,
                detail=("تعذر معالجة الطلب مؤقتاً. حاول لاحقاً." if decision.unavailable else "تم تجاوز عدد الطلبات. حاول لاحقاً."),
                headers={"Retry-After": str(decision.retry_after or 60), "Cache-Control": "no-store"},
            )


_registration_ip_limiter, _registration_email_limiter = _auth_limiters(5, 3600, "registration")
_recovery_ip_limiter, _recovery_email_limiter = _auth_limiters(3, 3600, "recovery")
_otp_verify_ip_limiter, _otp_verify_email_limiter = _auth_limiters(10, 300, "otp_verify")


@router.post("/register")
async def register(request: RegisterRequest, http_request: Request):
    try:
        registration_enabled = setting_enabled("features.registration_enabled")
    except SystemSettingsUnavailable:
        raise HTTPException(status_code=503, detail="تعذر التحقق من حالة التسجيل حالياً") from None
    if not registration_enabled:
        raise HTTPException(status_code=403, detail="التسجيل الجديد متوقف حالياً بقرار من إدارة النظام")
    email = normalize_email(str(request.email))
    await _enforce_auth_limits(http_request, email, (_registration_ip_limiter, _registration_email_limiter))
    log_event(logger, logging.INFO, "registration_started", recipient=mask_email(email))
    display_name = request.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="اسم العرض مطلوب")
    if not settings.AUTH_JWT_SECRET or not settings.AUTH_OTP_PEPPER:
        raise HTTPException(status_code=503, detail="خدمة المصادقة غير مهيأة")

    try:
        existing = get_user_by_email(email)
        if existing and existing.get("email_verified"):
            # Return the same response as the non-existing account case.
            return {"success": True, "message": _generic_auth_message()}

        # STRICT SECURITY POLICY: Do NOT create any record in custom_users before OTP verification!
        password_hash = hash_password(request.password)
        await run_in_threadpool(_issue_signup_otp, email, password_hash, display_name)
    except EmailDeliveryError as error:
        log_event(logger, logging.WARNING, "registration_failed", recipient=mask_email(email), error_type=safe_error(error), error_code="EMAIL_DELIVERY_FAILED")
        raise HTTPException(status_code=503, detail="تعذر إرسال رمز التحقق حاليًا. حاول لاحقًا.") from None
    except HTTPException:
        raise
    except Exception as error:
        log_event(logger, logging.ERROR, "registration_failed", recipient=mask_email(email), error_type=safe_error(error), error_code="INTERNAL_ERROR")
        raise HTTPException(status_code=503, detail="تعذر معالجة الطلب حاليًا. حاول لاحقًا.") from None

    log_event(logger, logging.INFO, "registration_otp_issued", recipient=mask_email(email))
    return {"success": True, "message": "تم إرسال رمز التأكيد. تحقق من بريدك الإلكتروني لإكمال التسجيل."}


_login_limiter = UpstashRateLimiter(
    limit=10,
    window_seconds=900,
    fail_closed=os.getenv("NABEH_LOGIN_RATE_LIMIT_FAIL_CLOSED", os.getenv("NABEH_RATE_LIMIT_FAIL_CLOSED", "true")).lower() in {"1", "true", "yes"},
    namespace="nabeh:auth:login:email",
)


@router.post("/login")
async def login(request: LoginRequest, response: Response, http_request: Request):
    log_event(logger, logging.INFO, "login_started", recipient=mask_email(str(request.email)))
    await _enforce_auth_limits(http_request, str(request.email), (_login_ip_limiter, _login_limiter))
    try:
        user = get_user_by_email(normalize_email(str(request.email)))
        if not user or not user.get("email_verified") or user.get("status", "ACTIVE") != "ACTIVE" or not verify_password(request.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="البريد أو كلمة المرور غير صحيحة")
        token = issue_access_token(user)
    except HTTPException as error:
        log_event(logger, logging.WARNING, "login_failed", recipient=mask_email(str(request.email)), error_code="AUTH_FAILED", status=error.status_code)
        raise
    except Exception as error:
        log_event(logger, logging.WARNING, "login_failed", recipient=mask_email(str(request.email)), error_type=safe_error(error), error_code="AUTH_FAILED")
        raise HTTPException(status_code=401, detail="البريد أو كلمة المرور غير صحيحة") from None
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    log_event(logger, logging.INFO, "login_succeeded", recipient=mask_email(str(request.email)))
    return {"success": True, "data": {"access_token": token, "user_id": user["id"], "email": user["email"]}}


_login_ip_limiter = UpstashRateLimiter(
    limit=30,
    window_seconds=900,
    fail_closed=_AUTH_RATE_LIMIT_FAIL_CLOSED,
    namespace="nabeh:auth:login:ip",
)


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, http_request: Request):
    await _enforce_auth_limits(http_request, str(request.email), (_recovery_ip_limiter, _recovery_email_limiter))
    log_event(logger, logging.INFO, "password_recovery_started", recipient=mask_email(str(request.email)))
    try:
        user = get_user_by_email(normalize_email(str(request.email)))
        if user and user.get("email_verified"):
            await run_in_threadpool(_issue_recovery_otp, user["id"], user["email"])
    except Exception:
        logger.exception("custom_recovery_request_failed")
    log_event(logger, logging.INFO, "password_recovery_finished", recipient=mask_email(str(request.email)))
    return {"success": True, "message": "إذا كان البريد مسجلاً، فستصلك رسالة رمز الاستعادة"}


_resend_limiter = UpstashRateLimiter(
    limit=20,
    window_seconds=3600,
    fail_closed=_AUTH_RATE_LIMIT_FAIL_CLOSED,
    namespace="nabeh:auth:resend:ip",
)
_resend_email_limiter = UpstashRateLimiter(
    limit=5,
    window_seconds=3600,
    fail_closed=_AUTH_RATE_LIMIT_FAIL_CLOSED,
    namespace="nabeh:auth:resend:email",
)
_resend_cooldown_ip_limiter = UpstashRateLimiter(
    limit=5,
    window_seconds=60,
    fail_closed=_AUTH_RATE_LIMIT_FAIL_CLOSED,
    namespace="nabeh:auth:resend:cooldown:ip",
)
_resend_cooldown_email_limiter = UpstashRateLimiter(
    limit=1,
    window_seconds=60,
    fail_closed=_AUTH_RATE_LIMIT_FAIL_CLOSED,
    namespace="nabeh:auth:resend:cooldown:email",
)
_resend_cooldown_limiter = _resend_cooldown_email_limiter


@router.post("/resend-otp")
async def resend_otp(request: ResendOtpRequest, http_request: Request):
    """Resend signup/recovery OTP without revealing account existence or creating unverified accounts."""
    email = normalize_email(str(request.email))
    log_event(logger, logging.INFO, "otp_resend_started", action=request.type, recipient=mask_email(email))
    await _enforce_auth_limits(http_request, email, (_resend_limiter, _resend_email_limiter))
    await _enforce_auth_limits(http_request, email, (_resend_cooldown_ip_limiter, _resend_cooldown_email_limiter))

    try:
        if request.type == "signup":
            user = get_user_by_email(email)
            if user and user.get("email_verified"):
                return {"success": True, "message": _generic_auth_message()}

            result = supabase.table("custom_auth_otps").select(
                "id,code_hash"
            ).eq("email", email).eq("purpose", "signup").is_("consumed_at", "null").order(
                "created_at", desc=True
            ).limit(1).execute()

            otp = result.data[0] if result.data else None
            if otp:
                parts = otp["code_hash"].split("$")
                if len(parts) >= 4 and parts[0] == "signup":
                    _, _, b64_pass, b64_name = parts[0], parts[1], parts[2], parts[3]
                    password_hash = base64.b64decode(b64_pass.encode("utf-8")).decode("utf-8")
                    display_name = base64.b64decode(b64_name.encode("utf-8")).decode("utf-8")
                    await run_in_threadpool(_issue_signup_otp, email, password_hash, display_name)

        else:  # request.type == "recovery"
            user = get_user_by_email(email)
            if user and user.get("email_verified"):
                await run_in_threadpool(_issue_recovery_otp, user["id"], email)

    except EmailDeliveryError as error:
        log_event(logger, logging.WARNING, "otp_resend_email_delivery_failed", recipient=mask_email(email), error_type=safe_error(error), error_code="EMAIL_DELIVERY_FAILED")
        raise HTTPException(status_code=503, detail="تعذر إرسال رمز التحقق حاليًا. حاول لاحقًا.") from None
    except Exception:
        logger.exception("otp_resend_failed")
        raise HTTPException(status_code=503, detail="تعذر إرسال رمز التحقق حاليًا. حاول لاحقًا.") from None

    log_event(logger, logging.INFO, "otp_resend_finished", action=request.type, recipient=mask_email(email))
    return {"success": True, "message": _generic_auth_message()}


@router.post("/verify-otp")
async def verify_otp(request: VerifyOtpRequest, response: Response, http_request: Request):
    """Verify OTP code. Accounts are created in custom_users ONLY when signup OTP is valid!"""
    email = normalize_email(str(request.email))
    purpose = "recovery" if request.type == "recovery" else "signup"
    await _enforce_auth_limits(http_request, email, (_otp_verify_ip_limiter, _otp_verify_email_limiter))
    log_event(logger, logging.INFO, "otp_verification_started", purpose=purpose, recipient=mask_email(email))

    try:
        if purpose == "signup":
            existing_user = get_user_by_email(email)
            if existing_user and existing_user.get("email_verified"):
                raise ValueError("signup is already verified")

            result = supabase.table("custom_auth_otps").select(
                "id,user_id,email,code_hash,expires_at,attempts,consumed_at"
            ).eq("email", email).eq("purpose", "signup").is_("consumed_at", "null").order(
                "created_at", desc=True
            ).limit(1).execute()

            otp = result.data[0] if result.data else None
            if not otp or int(otp.get("attempts", 0)) >= settings.AUTH_OTP_MAX_ATTEMPTS:
                raise ValueError("otp unavailable")
            if datetime.fromisoformat(otp["expires_at"].replace("Z", "+00:00")) <= _now():
                raise ValueError("otp expired")

            parts = otp["code_hash"].split("$")
            create_user = len(parts) >= 4 and parts[0] == "signup"
            if create_user:
                stored_hash = parts[1]
                if not hmac.compare_digest(hash_otp(request.token), stored_hash):
                    _increment_otp_attempts(otp)
                    raise ValueError("otp mismatch")
                password_hash = base64.b64decode(parts[2].encode("utf-8")).decode("utf-8")
                display_name = base64.b64decode(parts[3].encode("utf-8")).decode("utf-8")
                try:
                    default_language = get_system_settings().get("ui.default_language", "ar")
                except SystemSettingsUnavailable:
                    raise HTTPException(status_code=503, detail="تعذر تهيئة تفضيلات الحساب حالياً") from None
            else:
                stored_hash = parts[-1]
                if not hmac.compare_digest(hash_otp(request.token), stored_hash):
                    _increment_otp_attempts(otp)
                    raise ValueError("otp mismatch")
                if not existing_user:
                    raise ValueError("unknown user")
                password_hash = ""
                display_name = ""
                default_language = existing_user.get("preferred_language", "ar")

            completed = supabase.rpc("nabeh_complete_signup_otp", {
                "p_otp_id": otp["id"],
                "p_user_id": existing_user["id"] if existing_user else str(uuid4()),
                "p_email": email,
                "p_code_hash": otp["code_hash"],
                "p_attempts": int(otp.get("attempts", 0)),
                "p_create_user": create_user,
                "p_display_name": display_name,
                "p_password_hash": password_hash,
                "p_language": default_language,
                "p_verified_at": _now().isoformat(),
            }).execute()
            user = completed.data
            if not isinstance(user, dict) or not user.get("id"):
                raise ValueError("signup verification transaction failed")
            token = issue_access_token(user)

        else:  # purpose == "recovery"
            user = get_user_by_email(email)
            if not user or not user.get("email_verified"):
                raise ValueError("unknown user")

            result = supabase.table("custom_auth_otps").select(
                "id,user_id,code_hash,expires_at,attempts,consumed_at"
            ).eq("user_id", user["id"]).eq("purpose", "recovery").is_("consumed_at", "null").order(
                "created_at", desc=True
            ).limit(1).execute()

            otp = result.data[0] if result.data else None
            if not otp or int(otp.get("attempts", 0)) >= settings.AUTH_OTP_MAX_ATTEMPTS:
                raise ValueError("otp unavailable")
            if datetime.fromisoformat(otp["expires_at"].replace("Z", "+00:00")) <= _now():
                raise ValueError("otp expired")

            stored_hash = otp["code_hash"].split("$")[-1]
            if not hmac.compare_digest(hash_otp(request.token), stored_hash):
                _increment_otp_attempts(otp)
                raise ValueError("otp mismatch")

            _consume_otp(otp)
            token = issue_access_token(user, purpose="password_reset")

    except ValueError:
        raise HTTPException(status_code=400, detail="رمز التحقق غير صالح أو منتهي الصلاحية") from None
    except Exception:
        logger.exception("otp_verification_failed")
        raise HTTPException(status_code=400, detail="رمز التحقق غير صالح أو منتهي الصلاحية") from None

    response.headers["Cache-Control"] = "no-store, private"
    log_event(logger, logging.INFO, "otp_verification_succeeded", purpose=purpose, recipient=mask_email(email))
    return {"success": True, "data": {"access_token": token, "purpose": purpose}}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, response: Response, authorization: Optional[str] = Header(None)):
    log_event(logger, logging.INFO, "password_reset_started")
    try:
        user = get_reset_user(_bearer_token(authorization))
        updated = supabase.table("custom_users").update({
            "password_hash": hash_password(request.new_password),
            "auth_token_version": int(user.get("auth_token_version", 0) or 0) + 1,
            "updated_at": _now().isoformat(),
        }).eq("id", user["id"]).eq("auth_token_version", int(user.get("auth_token_version", 0) or 0)).select("id").execute()
        if not updated.data:
            raise ValueError("account state changed")
    except AuthSecurityError:
        raise HTTPException(status_code=401, detail="جلسة الاستعادة غير صالحة") from None
    except Exception:
        raise HTTPException(status_code=400, detail="تعذر تحديث كلمة المرور") from None
    response.headers["Cache-Control"] = "no-store, private"
    log_event(logger, logging.INFO, "password_reset_succeeded")
    return {"success": True, "message": "تم تحديث كلمة المرور بنجاح"}


@router.get("/me")
async def get_current_user_profile(response: Response, authorization: Optional[str] = Header(None)):
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    try:
        user = get_authenticated_user(_bearer_token(authorization))
    except (AuthSecurityError, HTTPException):
        raise HTTPException(status_code=401, detail="جلسة غير صالحة") from None
    return {"success": True, "data": {
        "user_id": user["id"],
        "email": user["email"],
        "display_name": user.get("display_name") or user["email"].split("@", 1)[0],
        "preferred_language": user.get("preferred_language", "ar"),
        "role": user.get("role", "USER"),
        "status": user.get("status", "ACTIVE"),
        "email_verified": bool(user.get("email_verified")),
    }}


@router.post("/logout")
async def logout(response: Response, authorization: Optional[str] = Header(None)):
    response.headers["Cache-Control"] = "no-store, private"
    try:
        user = get_authenticated_user(_bearer_token(authorization))
    except (AuthSecurityError, HTTPException):
        raise HTTPException(status_code=401, detail="جلسة غير صالحة") from None
    current_version = int(user.get("auth_token_version", 0) or 0)
    result = supabase.table("custom_users").update({
        "auth_token_version": current_version + 1,
        "updated_at": _now().isoformat(),
    }).eq("id", user["id"]).eq("auth_token_version", current_version).select("id").execute()
    if not result.data:
        raise HTTPException(status_code=409, detail="تغيرت الجلسة؛ أعد المحاولة")
    return {"success": True}
