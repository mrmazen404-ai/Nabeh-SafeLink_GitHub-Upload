"""Support and Contact Requests API router with Supabase persistence."""

import logging
import random
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.auth.security import AuthSecurityError, get_authenticated_user
from app.db.supabase_client import supabase
from app.observability import log_event, mask_email

logger = logging.getLogger(__name__)

router = APIRouter()


class SupportContactRequest(BaseModel):
    request_type: str = Field(default="scan_issue", min_length=1, max_length=64)
    email: EmailStr
    subject: str = Field(min_length=1, max_length=256)
    scan_id: Optional[str] = Field(default=None, max_length=128)
    details: str = Field(min_length=1, max_length=4096)

def _get_required_user_id(authorization: Optional[str]) -> str:
    if not authorization or not isinstance(authorization, str):
        raise HTTPException(
            status_code=401,
            detail="التواصل مع المطور يتطلب تسجيل الدخول وإنشاء حساب مفعّل",
        )
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="جلسة غير صالحة. يرجى تسجيل الدخول مجدداً")
    try:
        user = get_authenticated_user(parts[1])
        if not user or not user.get("id"):
            raise HTTPException(status_code=401, detail="التواصل مع المطور يتطلب حساباً مفعّلاً")
        require_latest_terms(user)
        return str(user["id"])
    except AuthSecurityError:
        raise HTTPException(status_code=401, detail="جلسة منتهية الصلاحية. يرجى إعادة تسجيل الدخول")


@router.post("/contact")
async def create_support_request(
    request: SupportContactRequest,
    authorization: Optional[str] = Header(None),
):
    """Save a user contact/support ticket into Supabase database (Authenticated users only)."""
    user_id = _get_required_user_id(authorization)
    ticket_id = f"TK-{random.randint(10000, 99999)}"
    recipient = mask_email(request.email)

    full_message = f"Request Type: {request.request_type}\nScan ID: {request.scan_id or 'N/A'}\n\nDetails:\n{request.details}"

    support_data = {
        "email": request.email.lower().strip(),
        "subject": f"[{request.request_type.upper()}] {request.subject.strip()} ({ticket_id})",
        "message": full_message,
        "status": "OPEN",
        "priority": "HIGH" if request.request_type == "inaccurate_result" else "NORMAL",
    }
    if user_id:
        support_data["user_id"] = user_id

    log_event(
        logger,
        logging.INFO,
        "support_request_received",
        ticket_id=ticket_id,
        request_type=request.request_type,
        recipient=recipient,
        user_id=user_id,
    )

    try:
        saved = supabase.table("support_requests").insert(support_data).execute()
        saved_record = (saved.data or [support_data])[0]
        log_event(
            logger,
            logging.INFO,
            "support_request_persisted",
            ticket_id=ticket_id,
            request_type=request.request_type,
            recipient=recipient,
        )
        return {
            "success": True,
            "ticket_id": ticket_id,
            "message": "تم استلام رسالتك وحفظها بنجاح في قاعدة البيانات",
            "data": saved_record,
        }
    except Exception as error:
        logger.warning("support_request_persistence_fallback ticket_id=%s error=%s", ticket_id, type(error).__name__)
        # Do not report success when the ticket was not persisted. Returning
        # 200 here creates a false support record and prevents safe retries.
        raise HTTPException(status_code=503, detail="تعذر حفظ طلب الدعم حاليًا. حاول لاحقًا.") from None
from app.legal.terms_consent import require_latest_terms
