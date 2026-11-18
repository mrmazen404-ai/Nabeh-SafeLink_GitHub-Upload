"""Privacy-preserving public metrics used by the Welcome page."""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.config import settings
from app.db.supabase_client import supabase
from app.public.metrics import read_platform_scan_metrics
from app.security.guest_rate_limit import UpstashRateLimiter, client_identity
from app.system_settings import get_runtime_config, setting_enabled_fail_closed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["Public metrics"])
_metrics_limiter = UpstashRateLimiter(
    limit=int(os.getenv("NABEH_PUBLIC_METRICS_RATE_LIMIT", "30")),
    window_seconds=int(os.getenv("NABEH_PUBLIC_METRICS_RATE_WINDOW_SECONDS", "60")),
    # Public aggregate metrics remain available if Redis is not configured;
    # guest scanning keeps its stricter fail-closed policy separately.
    fail_closed=os.getenv("NABEH_PUBLIC_METRICS_FAIL_CLOSED", "false").lower() in {"1", "true", "yes"},
    namespace="nabeh:public:metrics",
)


async def enforce_metrics_rate_limit(request: Request) -> None:
    decision = await _metrics_limiter.check(client_identity(request))
    if not decision.allowed:
        raise HTTPException(status_code=429, detail="طلبات الإحصائيات مرتفعة مؤقتاً. حاول لاحقاً.", headers={"Retry-After": str(decision.retry_after or 60), "Cache-Control": "no-store"})


class VisitEvent(BaseModel):
    visitor_id: str = Field(min_length=16, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    page: str = Field(default="welcome", min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_/-]+$")


def _visitor_hash(visitor_id: str) -> str:
    salt = settings.VISITOR_HASH_SALT
    if not salt or len(salt) < 32:
        raise HTTPException(status_code=503, detail="Visitor metrics are not configured")
    return hashlib.sha256(f"{salt}:{visitor_id}".encode()).hexdigest()


def _count(table: str, filters: list[tuple[str, str]] | None = None) -> int:
    query = supabase.table(table).select("id", count="exact", head=True)
    for column, value in filters or []:
        query = query.eq(column, value)
    result = query.execute()
    return int(result.count or 0)


@router.get("/runtime-config")
def public_runtime_config(response: Response):
    """Expose only the explicit public allow-list; never return DB rows or secrets."""
    response.headers["Cache-Control"] = "no-store, private"
    return {"success": True, "data": get_runtime_config()}


@router.post("/visit", status_code=202)
def record_visit(event: VisitEvent, _: None = Depends(enforce_metrics_rate_limit)):
    """Record a unique visitor event; never claim success if storage failed."""
    if not setting_enabled_fail_closed("features.public_metrics_enabled"):
        return {"success": True, "disabled": True}
    now = datetime.now(timezone.utc).isoformat()
    visitor_hash = _visitor_hash(event.visitor_id)
    supabase.table("site_visitors").upsert(
        {"visitor_hash": visitor_hash, "last_seen_at": now, "last_page": event.page},
        on_conflict="visitor_hash",
    ).execute()
    return {"success": True}


@router.get("/overview")
def public_overview(_: None = Depends(enforce_metrics_rate_limit)):
    """Return platform metrics or a clear 503; never substitute fake zeroes."""
    if not setting_enabled_fail_closed("features.public_metrics_enabled"):
        return {"success": True, "data": {"enabled": False}}
    try:
        total_visitors = _count("site_visitors")
        recent = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        active_res = supabase.table("site_visitors").select("id", count="exact", head=True).gte("last_seen_at", recent).execute()
        active_visitors = int(active_res.count or 0)
        users = _count("custom_users", [("status", "ACTIVE")])
        scan_metrics = read_platform_scan_metrics()

        return {
            "success": True,
            "data": {
                "visitors": total_visitors,
                "active_visitors_30d": active_visitors,
                "registered_users": users,
                "scans": scan_metrics["scans"],
                "safe_scans": scan_metrics["safe_scans"],
                "suspicious_scans": scan_metrics["suspicious_scans"],
                "dangerous_scans": scan_metrics["dangerous_scans"],
                "unknown_scans": scan_metrics["unknown_scans"],
                "enabled": True,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        }
    except Exception:
        logger.exception("public_overview_failed")
        raise HTTPException(status_code=503, detail="تعذر تحميل إحصائيات المنصة") from None
