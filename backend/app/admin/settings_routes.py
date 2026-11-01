"""Super-admin API for allow-listed system-wide settings."""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from app.admin.dependencies import client_ip, require_permissions
from app.admin.security import hash_value
from app.db.supabase_client import supabase
from app.system_settings import (
    SettingsPatchError,
    SystemSettingsUnavailable,
    get_system_settings,
    invalidate_settings_cache,
    validate_settings_patch,
)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin settings"])


@router.get("/settings")
def read_settings(_: dict = Depends(require_permissions("settings.read"))):
    try:
        values = get_system_settings()
    except SystemSettingsUnavailable:
        raise HTTPException(status_code=503, detail="تعذر تحميل إعدادات النظام") from None
    return {"success": True, "data": values}


@router.patch("/settings")
def update_settings(
    request: Request,
    payload: dict = Body(...),
    admin: dict = Depends(require_permissions("settings.manage")),
):
    try:
        updates = validate_settings_patch(payload)
    except SettingsPatchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None

    raw_request_id = str(getattr(request.state, "request_id", "") or request.headers.get("x-request-id") or "").strip()
    try:
        request_id = str(UUID(raw_request_id)) if raw_request_id else str(uuid4())
    except ValueError:
        request_id = str(uuid4())

    args = {
        "p_admin_id": str(admin["id"]),
        "p_settings": updates,
        "p_ip_hash": hash_value(client_ip(request)),
        "p_user_agent_hash": hash_value(request.headers.get("user-agent", "")),
        "p_request_id": request_id,
    }
    try:
        supabase.rpc("admin_update_system_settings", args).execute()
        invalidate_settings_cache()
    except Exception:
        raise HTTPException(status_code=503, detail="تعذر حفظ إعدادات النظام؛ لم يُعتمد التغيير") from None

    return {"success": True, "data": updates}
