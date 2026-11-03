"""
Async VirusTotal API Client for Nabeh SafeLink
Uses httpx.AsyncClient to prevent blocking the FastAPI event loop.
"""

import os
import base64
import asyncio
import logging
import time
from datetime import datetime, timezone
import httpx
from typing import Dict, Any

from app.observability import elapsed_ms, log_event, resource_id, safe_error


VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")
VIRUSTOTAL_BASE_URL = "https://www.virustotal.com/api/v3"
logger = logging.getLogger(__name__)


def _get_api_key() -> str:
    """Read the current secret so rotations take effect without stale import state."""
    return os.getenv("VIRUSTOTAL_API_KEY", VIRUSTOTAL_API_KEY).strip()


def get_provider_readiness() -> Dict[str, Any]:
    """Return non-sensitive VirusTotal configuration state for health checks."""
    return {
        "status": "configured" if _get_api_key() else "not_configured",
        "base_url": VIRUSTOTAL_BASE_URL,
    }


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
    """Check a URL against VirusTotal asynchronously using httpx."""
    started = time.perf_counter()
    target_id = resource_id(url)
    log_event(logger, logging.INFO, "virustotal_check_started", target_id=target_id)
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
            result = _parse_response(data)
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
    """Submit a new URL to VirusTotal asynchronously."""
    target_id = resource_id(url)
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
                result = _parse_response(get_response.json())
                if result.get("status") != "UNKNOWN":
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
        stats = attributes.get("last_analysis_stats", {})

        def safe_count(value):
            try:
                return max(0, int(value or 0))
            except (TypeError, ValueError):
                return 0

        malicious = safe_count(stats.get("malicious", 0))
        suspicious = safe_count(stats.get("suspicious", 0))
        harmless = safe_count(stats.get("harmless", 0))
        undetected = safe_count(stats.get("undetected", 0))
        timeout = safe_count(stats.get("timeout", 0))
        additional_statuses = {
            key: safe_count(value) for key, value in stats.items()
            if key not in {"malicious", "suspicious", "harmless", "undetected"}
        }
        total = malicious + suspicious + harmless + undetected + sum(additional_statuses.values())
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
        elif harmless > 0 and malicious == 0:
            status = "SAFE"
            confidence = min(1.0, harmless / max(1, total))
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
            "total_engines": total,
            "analysis_data_available": bool(
                scanner_results
                or any(safe_count(value) > 0 for value in stats.values())
                or attributes.get("last_analysis_date")
            ),
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
