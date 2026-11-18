"""Privacy-preserving aggregate platform metrics."""
from __future__ import annotations

import logging

from app.db.supabase_client import supabase

logger = logging.getLogger(__name__)

_ALLOWED_CLASSIFICATIONS = {"SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN"}


def record_platform_scan_metric(classification: str) -> None:
    """Increment only an aggregate counter; never store URL, text, or user identity."""
    normalized = str(classification or "UNKNOWN").upper()
    if normalized not in _ALLOWED_CLASSIFICATIONS:
        normalized = "UNKNOWN"
    supabase.rpc(
        "record_platform_scan_metric",
        {"p_classification": normalized},
    ).execute()


def read_platform_scan_metrics() -> dict[str, int]:
    """Read aggregate scan counters from the daily rollup table."""
    result = supabase.table("platform_daily_metrics").select(
        "total_scans,safe_scans,suspicious_scans,dangerous_scans,unknown_scans"
    ).execute()
    totals = {
        "scans": 0,
        "safe_scans": 0,
        "suspicious_scans": 0,
        "dangerous_scans": 0,
        "unknown_scans": 0,
    }
    for row in result.data or []:
        totals["scans"] += int(row.get("total_scans") or 0)
        totals["safe_scans"] += int(row.get("safe_scans") or 0)
        totals["suspicious_scans"] += int(row.get("suspicious_scans") or 0)
        totals["dangerous_scans"] += int(row.get("dangerous_scans") or 0)
        totals["unknown_scans"] += int(row.get("unknown_scans") or 0)
    return totals
