"""
Async VirusTotal API Client for Nabeh SafeLink
Uses httpx.AsyncClient to prevent blocking the FastAPI event loop.
"""

import os
import base64
import asyncio
import ipaddress
import logging
import re
import socket
import threading
import time
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlsplit
import httpx
from typing import Dict, Any

from app.observability import elapsed_ms, log_event, resource_id, safe_error


VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")
VIRUSTOTAL_BASE_URL = "https://www.virustotal.com/api/v3"
DEFAULT_MAX_ANALYSIS_AGE_HOURS = 168
SENSITIVE_QUERY_KEYS = {"key", "apikey", "authkey", "authorizationkey", "accesskey", "sessionid", "otp", "verificationcode"}
SENSITIVE_QUERY_SUFFIXES = ("token", "secret", "password", "passwd", "session", "auth", "code", "apikey")
_MAX_CONCURRENT_REQUESTS = max(1, min(32, int(os.getenv("VIRUSTOTAL_MAX_CONCURRENT_REQUESTS", "8"))))
_REQUEST_SLOTS = threading.BoundedSemaphore(_MAX_CONCURRENT_REQUESTS)
_LAST_PROVIDER_CALL = {"status": "not_attempted", "provider_status": None, "checked_at": None}
_PROVIDER_STATUS_ALLOWLIST = {
    "SUCCESS", "NO_VERDICT", "ANALYSIS_STALE", "ANALYSIS_DATE_MISSING", "ANALYSIS_DATE_INVALID",
    "ANALYSIS_PENDING", "SUBMISSION_DISABLED",
    "SUBMISSION_PENDING", "AUTH_ERROR", "RATE_LIMITED", "PROVIDER_ERROR", "NETWORK_ERROR",
    "TIMEOUT", "PARSE_ERROR", "NOT_CONFIGURED", "PRIVACY_BLOCKED", "SUBMISSION_BLOCKED", "BUSY",
}
logger = logging.getLogger(__name__)


def _get_api_key() -> str:
    """Read the current secret so rotations take effect without stale import state."""
    return os.getenv("VIRUSTOTAL_API_KEY", VIRUSTOTAL_API_KEY).strip()


def _submission_enabled() -> bool:
    """Submission is disabled unless explicitly opted in through the environment."""
    return os.getenv("VIRUSTOTAL_ALLOW_SUBMISSION", "").strip().lower() == "true"


def _max_analysis_age_hours() -> float:
    """Read the freshness window, falling back to a conservative seven days."""
    try:
        age = float(os.getenv("VIRUSTOTAL_MAX_ANALYSIS_AGE_HOURS", str(DEFAULT_MAX_ANALYSIS_AGE_HOURS)))
        if age < 0 or not age < float("inf"):
            return float(DEFAULT_MAX_ANALYSIS_AGE_HOURS)
        return age
    except (TypeError, ValueError):
        return float(DEFAULT_MAX_ANALYSIS_AGE_HOURS)


def _submission_block_reason(url: str) -> str | None:
    """Return a safe reason when a URL is not eligible for VirusTotal submission."""
    try:
        parsed = urlsplit(url)
        hostname = parsed.hostname
        if not hostname:
            return "URL has no valid hostname"
        hostname = hostname.rstrip(".").lower()
        if hostname == "localhost" or hostname.endswith((".localhost", ".local", ".internal")):
            return "Local or internal hostnames cannot be submitted"
        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            try:
                # inet_aton also recognizes legacy numeric IPv4 forms such as 127.1.
                address = ipaddress.IPv4Address(socket.inet_aton(hostname))
            except (OSError, ValueError):
                address = None
        if address is not None and not address.is_global:
            return "Non-public IP addresses cannot be submitted"

        query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
        if ";" in parsed.query:
            query_pairs.extend(parse_qsl(parsed.query.replace(";", "&"), keep_blank_values=True))
        for key, _value in query_pairs:
            normalized_key = re.sub(r"[^a-z0-9]", "", key.lower())
            if normalized_key in SENSITIVE_QUERY_KEYS or any(normalized_key.endswith(suffix) for suffix in SENSITIVE_QUERY_SUFFIXES):
                return "Sensitive query parameters cannot be submitted"
        return None
    except (TypeError, ValueError):
        return "URL is invalid and cannot be submitted"


def _analysis_timestamp(value: Any) -> datetime | None:
    """Convert VirusTotal Unix timestamps or ISO timestamps to UTC."""
    if isinstance(value, bool) or value is None:
        return None
    try:
        if isinstance(value, (int, float)) or (isinstance(value, str) and value.strip().replace(".", "", 1).isdigit()):
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        if isinstance(value, str):
            normalized = value.strip()
            if normalized.endswith("Z"):
                normalized = normalized[:-1] + "+00:00"
            parsed = datetime.fromisoformat(normalized)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
    except (OverflowError, OSError, TypeError, ValueError):
        return None
    return None


def _apply_freshness(result: Dict[str, Any], now: datetime | None = None) -> Dict[str, Any]:
    """Prevent stale or undated analysis from producing a verdict; retain all evidence."""
    timestamp = _analysis_timestamp(result.get("last_analysis_date"))
    if timestamp is None:
        result.update({
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "ANALYSIS_DATE_MISSING",
            "analysis_freshness_reason": "VirusTotal analysis timestamp is missing or invalid",
            "error": "VIRUSTOTAL_ANALYSIS_DATE_MISSING",
        })
        return result
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    age_hours = (current_time.astimezone(timezone.utc) - timestamp).total_seconds() / 3600
    if age_hours < -0.0833:
        result.update({
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "ANALYSIS_DATE_INVALID",
            "analysis_freshness_reason": "VirusTotal analysis timestamp is unexpectedly in the future",
            "error": "VIRUSTOTAL_ANALYSIS_DATE_INVALID",
        })
        return result
    max_age_hours = _max_analysis_age_hours()
    if age_hours > max_age_hours:
        result.update({
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "ANALYSIS_STALE",
            "analysis_freshness_reason": f"VirusTotal analysis is older than the configured {max_age_hours:g}-hour freshness window",
            "error": "VIRUSTOTAL_ANALYSIS_STALE",
        })
    else:
        result["analysis_freshness_reason"] = "Analysis timestamp is within the configured freshness window"
    return result


def get_provider_readiness() -> Dict[str, Any]:
    """Return configuration and the last observed call; never make a live probe here."""
    configured = bool(_get_api_key())
    last_call = dict(_LAST_PROVIDER_CALL)
    status_code = last_call.get("provider_status")
    if not configured:
        functional_status = "not_configured"
    elif last_call.get("status") == "not_attempted":
        functional_status = "unknown"
    elif status_code in {"SUCCESS", "NO_VERDICT", "ANALYSIS_STALE", "ANALYSIS_DATE_MISSING", "ANALYSIS_DATE_INVALID", "ANALYSIS_PENDING", "SUBMISSION_DISABLED", "SUBMISSION_PENDING"}:
        functional_status = "responding"
    elif status_code in {"PRIVACY_BLOCKED", "SUBMISSION_BLOCKED"}:
        functional_status = "not_probed"
    elif status_code == "BUSY":
        functional_status = "capacity_limited"
    else:
        functional_status = "last_call_failed"
    return {
        "status": "configured" if configured else "not_configured",
        "functional_status": functional_status,
        "last_call": last_call,
        "base_url": VIRUSTOTAL_BASE_URL,
    }


def _record_provider_call(result: Dict[str, Any]) -> None:
    raw_status = result.get("provider_status")
    provider_status = raw_status if isinstance(raw_status, str) and raw_status in _PROVIDER_STATUS_ALLOWLIST else "PROVIDER_ERROR"
    _LAST_PROVIDER_CALL.update({
        "status": "observed",
        "provider_status": provider_status,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    })


def _get_headers() -> Dict[str, str]:
    return {
        "x-apikey": _get_api_key(),
        "Accept": "application/json",
    }


def _url_id(url: str) -> str:
    url_bytes = url.encode("utf-8")
    url_base64 = base64.urlsafe_b64encode(url_bytes).decode("utf-8")
    return url_base64.rstrip("=")


async def check_url_virustotal(url: str) -> Dict[str, Any]:
    """Bound concurrent provider calls; overloaded scans report UNKNOWN explicitly."""
    if not _REQUEST_SLOTS.acquire(blocking=False):
        result = {
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "BUSY",
            "error": "VIRUSTOTAL_CAPACITY_LIMITED",
        }
        _record_provider_call(result)
        return result
    try:
        try:
            result = await _check_url_virustotal(url)
        except Exception:
            _record_provider_call({"provider_status": "PROVIDER_ERROR"})
            raise
        _record_provider_call(result)
        return result
    finally:
        _REQUEST_SLOTS.release()


async def _check_url_virustotal(url: str) -> Dict[str, Any]:
    """Check a URL against VirusTotal asynchronously using httpx."""
    started = time.perf_counter()
    target_id = resource_id(url)
    log_event(logger, logging.INFO, "virustotal_check_started", target_id=target_id)
    block_reason = _submission_block_reason(url)
    if block_reason:
        log_event(logger, logging.WARNING, "virustotal_lookup_blocked", target_id=target_id, reason=block_reason)
        return {
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "PRIVACY_BLOCKED",
            "error": "VIRUSTOTAL_TARGET_NOT_SHARED",
            "reason": block_reason,
        }
    if not _get_api_key():
        log_event(logger, logging.WARNING, "virustotal_not_configured", target_id=target_id)
        return {
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "NOT_CONFIGURED",
            "error": "VIRUSTOTAL_API_KEY not set",
        }

    url_id = _url_id(url)
    endpoint = f"{VIRUSTOTAL_BASE_URL}/urls/{url_id}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(endpoint, headers=_get_headers())
            log_event(logger, logging.DEBUG, "virustotal_lookup_response", target_id=target_id, status=response.status_code)

            if response.status_code == 404:
                log_event(logger, logging.INFO, "scan_virustotal_lookup_not_found", target_id=target_id, provider="VIRUSTOTAL", status=404, duration_ms=elapsed_ms(started))
                if not _submission_enabled():
                    return {
                        "status": "UNKNOWN",
                        "confidence": 0.0,
                        "provider_status": "SUBMISSION_DISABLED",
                        "error": "VIRUSTOTAL_SUBMISSION_DISABLED",
                        "reason": "URL lookup returned 404; submission is disabled unless explicitly enabled",
                    }
                return await _submit_url(url, client)

            if response.status_code == 401:
                log_event(logger, logging.WARNING, "scan_virustotal_failed", target_id=target_id, provider="VIRUSTOTAL", status=401, error_code="VIRUSTOTAL_PROVIDER_ERROR", duration_ms=elapsed_ms(started))
                return {
                    "status": "UNKNOWN",
                    "confidence": 0.0,
                    "provider_status": "AUTH_ERROR",
                    "error": "VIRUSTOTAL_PROVIDER_ERROR",
                }

            if response.status_code == 429:
                log_event(logger, logging.WARNING, "scan_virustotal_rate_limited", target_id=target_id, provider="VIRUSTOTAL", status=429, error_code="RATE_LIMITED", duration_ms=elapsed_ms(started))
                return {
                    "status": "UNKNOWN",
                    "confidence": 0.0,
                    "provider_status": "RATE_LIMITED",
                    "error": "VIRUSTOTAL_RATE_LIMITED",
                }

            if response.status_code != 200:
                log_event(logger, logging.WARNING, "scan_virustotal_failed", target_id=target_id, provider="VIRUSTOTAL", status=response.status_code, error_code="VIRUSTOTAL_PROVIDER_ERROR", duration_ms=elapsed_ms(started))
                return {
                    "status": "UNKNOWN",
                    "confidence": 0.0,
                    "provider_status": "PROVIDER_ERROR",
                    "error": "VIRUSTOTAL_PROVIDER_ERROR",
                }

            data = response.json()
            result = _apply_freshness(_parse_response(data))
            log_event(logger, logging.INFO, "virustotal_check_succeeded", target_id=target_id, status=result.get("status"), duration_ms=elapsed_ms(started))
            return result

        except httpx.TimeoutException:
            log_event(logger, logging.ERROR, "virustotal_timeout", target_id=target_id, duration_ms=elapsed_ms(started))
            return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "TIMEOUT", "error": "Timeout"}
        except httpx.RequestError as e:
            log_event(logger, logging.ERROR, "virustotal_connection_failed", target_id=target_id, error_type=safe_error(e), duration_ms=elapsed_ms(started))
            return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "NETWORK_ERROR", "error": "VIRUSTOTAL_NETWORK_ERROR"}
        except Exception as e:
            log_event(logger, logging.ERROR, "virustotal_check_failed", target_id=target_id, error_type=safe_error(e), duration_ms=elapsed_ms(started))
            return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "PROVIDER_ERROR", "error": "VIRUSTOTAL_PROVIDER_ERROR"}


async def _submit_url(url: str, client: httpx.AsyncClient) -> Dict[str, Any]:
    """Submit a URL only with explicit opt-in and after local safety checks."""
    target_id = resource_id(url)
    if not _submission_enabled():
        return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "SUBMISSION_DISABLED", "error": "VIRUSTOTAL_SUBMISSION_DISABLED"}
    block_reason = _submission_block_reason(url)
    if block_reason:
        log_event(logger, logging.WARNING, "virustotal_submit_blocked", target_id=target_id, reason=block_reason)
        return {
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "SUBMISSION_BLOCKED",
            "error": "VIRUSTOTAL_SUBMISSION_BLOCKED",
            "reason": block_reason,
        }
    log_event(logger, logging.INFO, "virustotal_submit_started", target_id=target_id)
    endpoint = f"{VIRUSTOTAL_BASE_URL}/urls"

    try:
        response = await client.post(
            endpoint,
            headers=_get_headers(),
            data={"url": url},
        )

        if response.status_code in (401, 403):
            log_event(logger, logging.ERROR, "virustotal_submit_auth_failed", target_id=target_id, status=response.status_code)
            return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "AUTH_ERROR", "error": "VIRUSTOTAL_PROVIDER_ERROR"}
        if response.status_code == 429:
            log_event(logger, logging.WARNING, "virustotal_submit_rate_limited", target_id=target_id, status=429)
            return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "RATE_LIMITED", "error": "VIRUSTOTAL_RATE_LIMITED"}
        if response.status_code not in (200, 201):
            log_event(logger, logging.ERROR, "virustotal_submit_failed", target_id=target_id, status=response.status_code)
            return {
                "status": "UNKNOWN",
                "confidence": 0.0,
                "provider_status": "PROVIDER_ERROR",
                "error": "VIRUSTOTAL_PROVIDER_ERROR",
            }

        url_id = _url_id(url)
        get_endpoint = f"{VIRUSTOTAL_BASE_URL}/urls/{url_id}"

        # Resilient short-polling loop: poll up to 3 attempts every 1.5 seconds (max 4.5 seconds)
        for attempt in range(3):
            await asyncio.sleep(1.5)
            get_response = await client.get(get_endpoint, headers=_get_headers())
            if get_response.status_code == 200:
                result = _apply_freshness(_parse_response(get_response.json()))
                if (
                    result.get("status") != "UNKNOWN"
                    or result.get("provider_status") in {"ANALYSIS_STALE", "ANALYSIS_DATE_MISSING"}
                    or result.get("analysis_data_available")
                ):
                    log_event(logger, logging.INFO, "virustotal_submit_succeeded", target_id=target_id, status=result.get("status"), attempt=attempt + 1)
                    return result
            elif get_response.status_code in (401, 403):
                return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "AUTH_ERROR", "error": "VIRUSTOTAL_PROVIDER_ERROR"}
            elif get_response.status_code == 429:
                return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "RATE_LIMITED", "error": "VIRUSTOTAL_RATE_LIMITED"}
            elif get_response.status_code >= 500:
                return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "PROVIDER_ERROR", "error": "VIRUSTOTAL_PROVIDER_ERROR"}

        log_event(logger, logging.WARNING, "virustotal_analysis_pending", target_id=target_id)
        return {
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "ANALYSIS_PENDING",
            "error": "Pending analysis after submit",
        }

    except Exception as e:
        log_event(logger, logging.ERROR, "virustotal_submit_connection_failed", target_id=target_id, error_type=safe_error(e))
        return {"status": "UNKNOWN", "confidence": 0.0, "provider_status": "NETWORK_ERROR", "error": "VIRUSTOTAL_NETWORK_ERROR"}


def _parse_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """Parse VirusTotal response with sanitized output."""
    try:
        attributes = data.get("data", {}).get("attributes", {})
        raw_stats = attributes.get("last_analysis_stats")
        stats = raw_stats if isinstance(raw_stats, dict) else {}

        def safe_count(value):
            if isinstance(value, bool):
                return None
            try:
                parsed = int(value)
                if parsed < 0 or str(parsed) != str(value).strip():
                    return None
                return parsed
            except (TypeError, ValueError):
                return None

        required_stats = ("malicious", "suspicious", "harmless", "undetected")
        valid_stats = {
            key: count for key, value in stats.items()
            if (count := safe_count(value)) is not None
        }
        analysis_stats_complete = bool(
            isinstance(raw_stats, dict)
            and all(key in valid_stats for key in required_stats)
        )
        analysis_stats_available = bool(
            valid_stats and any(count > 0 for count in valid_stats.values())
        )
        malicious = valid_stats.get("malicious", 0)
        suspicious = valid_stats.get("suspicious", 0)
        harmless = valid_stats.get("harmless", 0)
        undetected = valid_stats.get("undetected", 0)
        timeout = valid_stats.get("timeout", 0)
        additional_statuses = {
            key: count for key, count in valid_stats.items()
            if key not in {"malicious", "suspicious", "harmless", "undetected"}
        }
        total = sum(valid_stats.values()) if analysis_stats_complete else None
        report_counts = dict(valid_stats)
        if analysis_stats_complete:
            report_counts["total_engines"] = total
        raw_results = attributes.get("last_analysis_results", {})
        scanner_results = []
        scanner_results_total = len(raw_results) if isinstance(raw_results, dict) else 0
        if isinstance(raw_results, dict):
            for engine_name, engine_result in list(raw_results.items())[:100]:
                if not isinstance(engine_result, dict):
                    continue
                category = str(engine_result.get("category", "unknown") or "unknown").lower()
                if category not in {"harmless", "undetected", "suspicious", "malicious", "timeout"}:
                    category = "unknown"
                scanner_results.append({
                    "engine_name": str(engine_result.get("engine_name") or engine_name)[:100],
                    "method": str(engine_result.get("method") or "")[:80],
                    "category": category,
                    "result": str(engine_result.get("result") or "")[:240],
                })

        reputation = attributes.get("reputation", 0)
        categories = attributes.get("categories", {})

        if malicious >= 3:
            status = "DANGEROUS"
            confidence = min(1.0, malicious / 10.0)
        elif malicious >= 1 or suspicious >= 1:
            status = "SUSPICIOUS"
            confidence = 0.6
        elif analysis_stats_complete and harmless > 0 and malicious == 0 and suspicious == 0:
            status = "SAFE"
            confidence = min(1.0, harmless / max(1, total or 0))
        else:
            status = "UNKNOWN"
            confidence = 0.3

        return {
            "status": status,
            "confidence": round(confidence, 4),
            "provider_status": "SUCCESS" if status != "UNKNOWN" else "NO_VERDICT",
            "malicious": malicious,
            "suspicious": suspicious,
            "harmless": harmless,
            "undetected": undetected,
            "timeout": timeout,
            "total_engines": total or 0,
            "counts": report_counts,
            "analysis_stats_complete": analysis_stats_complete,
            "analysis_data_available": bool(
                scanner_results
                or analysis_stats_available
                or attributes.get("last_analysis_date")
            ),
            "analysis_stats_available": analysis_stats_available,
            "unclassified_engines": sum(additional_statuses.values()),
            "additional_engine_statuses": additional_statuses,
            "scanner_results": scanner_results,
            "scanner_results_total": scanner_results_total,
            "scanner_results_truncated": scanner_results_total > 100,
            "last_analysis_date": attributes.get("last_analysis_date"),
            "evidence_timestamp": datetime.now(timezone.utc).isoformat(),
            "reputation": reputation,
            "categories": categories,
        }

    except Exception:
        return {
            "status": "UNKNOWN",
            "confidence": 0.0,
            "provider_status": "PARSE_ERROR",
            "error": "VIRUSTOTAL_PARSE_ERROR",
        }


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")

    test_urls = [
        "https://www.google.com",
        "https://www.youtube.com",
        "http://paypa1-login-verify.com/secure",
    ]

    async def main():
        print("=" * 70)
        print("Testing Async VirusTotal API")
        print("=" * 70)
        for u in test_urls:
            res = await check_url_virustotal(u)
            print(f"{u:<45} → {res.get('status')} (malicious={res.get('malicious', 0)})")

    asyncio.run(main())
