from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Response

from app.db.supabase_client import supabase
from app.observability import log_event
from app.scans.routes import get_required_user_id

import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me")
async def get_my_statistics(
    response: Response,
    authorization: Optional[str] = Header(None),
):
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    user_id = await get_required_user_id(authorization)

    try:
        scans_res = (
            supabase.table("scans")
            .select("id, classification")
            .eq("user_id", user_id)
            .execute()
        )
        scans = scans_res.data or []
        scan_ids = [s["id"] for s in scans]

        fraud_counts = {}
        if scan_ids:
            try:
                sf_res = (
                    supabase.table("scan_fraud_types")
                    .select("scan_id, fraud_type_id, fraud_types(code, name_en, name_ar)")
                    .in_("scan_id", scan_ids)
                    .execute()
                )
                for item in (sf_res.data or []):
                    ft = item.get("fraud_types") or {}
                    code = ft.get("code") or "UNKNOWN"
                    name_ar = ft.get("name_ar") or code
                    if code not in fraud_counts:
                        fraud_counts[code] = {"code": code, "name_ar": name_ar, "count": 0}
                    fraud_counts[code]["count"] += 1
            except Exception:
                logger.warning("scan_fraud_types_query_skipped")

        if not fraud_counts and scans:
            for scan in scans:
                if scan.get("classification") in ("DANGEROUS", "SUSPICIOUS"):
                    code = "PHISHING"
                    name_ar = "تصيد احتيالي"
                    if code not in fraud_counts:
                        fraud_counts[code] = {"code": code, "name_ar": name_ar, "count": 0}
                    fraud_counts[code]["count"] += 1

        log_event(logger, logging.INFO, "statistics_loaded", total=len(scans))
    except Exception:
        log_event(logger, logging.ERROR, "statistics_load_failed")
        raise HTTPException(status_code=503, detail="تعذر تحميل الإحصاءات") from None

    return {
        "success": True,
        "data": {
            "total": len(scans),
            "safe": sum(1 for scan in scans if scan.get("classification") == "SAFE"),
            "suspicious": sum(1 for scan in scans if scan.get("classification") == "SUSPICIOUS"),
            "dangerous": sum(1 for scan in scans if scan.get("classification") == "DANGEROUS"),
            "fraud_types": list(fraud_counts.values()),
        },
    }
