"""
Async VirusTotal API client with explicit provider states.
No provider result is synthesized: unavailable evidence is UNKNOWN.
"""
import asyncio
import base64
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict

import httpx

from app.observability import elapsed_ms, log_event, resource_id, safe_error

VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")
VIRUSTOTAL_BASE_URL = "https://www.virustotal.com/api/v3"
logger = logging.getLogger(__name__)


def _evidence(status: str, *, error: str | None = None, provider_status: str | None = None) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "status": status,
        "provider": "VIRUSTOTAL",
        "provider_status": provider_status or ("SUCCESS" if status in {"SAFE", "SUSPICIOUS", "DANGEROUS"} else "UNKNOWN"),
        "evidence_timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if error:
        result["error"] = error
    return result


def _unknown(error: str, provider_status: str) -> Dict[str, Any]:
    result = _evidence("UNKNOWN", error=error, provider_status=provider_status)
    result["confidence"] = 0.0
    return result


def _get_api_key() -> str:
    return os.getenv("VIRUSTOTAL_API_KEY", VIRUSTOTAL_API_KEY).strip()


def get_provider_readiness() -> Dict[str, Any]:
    return {
        "status": "configured" if _get_api_key() else "not_configured",
        "base_url": VIRUSTOTAL_BASE_URL,
    }


def _get_headers() -> Dict[str, str]:
    return {"x-apikey": _get_api_key(), "Accept": "application/json"}


def _url_id(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode("utf-8")).decode("utf-8").rstrip("=")


async def check_url_virustotal(url: str) -> Dict[str, Any]:
    started = time.perf_counter()
    target_id = resource_id(url)
    log_event(logger, logging.INFO, "virustotal_check_started", target_id=target_id)
    if not _get_api_key():
        log_event(logger, logging.WARNING, "virustotal_not_configured", target_id=target_id)
        return _unknown("VIRUSTOTAL_NOT_CONFIGURED", "NOT_CONFIGURED")

    endpoint = f"{VIRUSTOTAL_BASE_URL}/urls/{_url_id(url)}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(endpoint, headers=_get_headers())
            status_code = response.status_code
            log_event(logger, logging.DEBUG, "virustotal_lookup_response", target_id=target_id, status=status_code)
            if status_code == 404:
                log_event(logger, logging.INFO, "scan_virustotal_lookup_not_found", target_id=target_id, provider="VIRUSTOTAL", status=404, duration_ms=elapsed_ms(started))
                return await _submit_url(url, client)
            if status_code == 401:
                return _unknown("VIRUSTOTAL_AUTH_ERROR", "AUTH_ERROR")
            if status_code == 403:
                return _unknown("VIRUSTOTAL_ACCESS_DENIED", "ACCESS_DENIED")
            if status_code == 429:
                result = _unknown("VIRUSTOTAL_RATE_LIMITED", "RATE_LIMITED")
                result["retry_after"] = response.headers.get("retry-after")
                return result
            if 500 <= status_code < 600:
                return _unknown("VIRUSTOTAL_PROVIDER_ERROR", "PROVIDER_ERROR")
            if status_code != 200:
                return _unknown("VIRUSTOTAL_PROVIDER_ERROR", "PROVIDER_ERROR")
            result = _parse_response(response.json())
            log_event(logger, logging.INFO, "virustotal_check_succeeded", target_id=target_id, status=result.get("status"), duration_ms=elapsed_ms(started))
            return result
        except httpx.TimeoutException:
            log_event(logger, logging.ERROR, "virustotal_timeout", target_id=target_id, duration_ms=elapsed_ms(started))
            return _unknown("VIRUSTOTAL_TIMEOUT", "TIMEOUT")
        except httpx.RequestError as error:
            log_event(logger, logging.ERROR, "virustotal_connection_failed", target_id=target_id, error_type=safe_error(error), duration_ms=elapsed_ms(started))
            return _unknown("VIRUSTOTAL_NETWORK_ERROR", "NETWORK_ERROR")
        except Exception as error:
            log_event(logger, logging.ERROR, "virustotal_check_failed", target_id=target_id, error_type=safe_error(error), duration_ms=elapsed_ms(started))
            return _unknown("VIRUSTOTAL_PROVIDER_ERROR", "PROVIDER_ERROR")


async def _submit_url(url: str, client: httpx.AsyncClient) -> Dict[str, Any]:
    target_id = resource_id(url)
    endpoint = f"{VIRUSTOTAL_BASE_URL}/urls"
    try:
        response = await client.post(endpoint, headers=_get_headers(), data={"url": url})
        if response.status_code == 401:
            return _unknown("VIRUSTOTAL_AUTH_ERROR", "AUTH_ERROR")
        if response.status_code == 429:
            result = _unknown("VIRUSTOTAL_RATE_LIMITED", "RATE_LIMITED")
            result["retry_after"] = response.headers.get("retry-after")
            return result
        if response.status_code not in (200, 201):
            return _unknown("VIRUSTOTAL_PROVIDER_ERROR", "PROVIDER_ERROR")

        get_endpoint = f"{VIRUSTOTAL_BASE_URL}/urls/{_url_id(url)}"
        for attempt in range(3):
            await asyncio.sleep(1.5)
            get_response = await client.get(get_endpoint, headers=_get_headers())
            if get_response.status_code == 429:
                result = _unknown("VIRUSTOTAL_RATE_LIMITED", "RATE_LIMITED")
                result["retry_after"] = get_response.headers.get("retry-after")
                return result
            if get_response.status_code == 200:
                result = _parse_response(get_response.json())
                if result.get("status") != "UNKNOWN":
                    log_event(logger, logging.INFO, "virustotal_submit_succeeded", target_id=target_id, status=result.get("status"), attempt=attempt + 1)
                    return result
        log_event(logger, logging.WARNING, "virustotal_analysis_pending", target_id=target_id)
        return _unknown("VIRUSTOTAL_ANALYSIS_PENDING", "ANALYSIS_PENDING")
    except httpx.TimeoutException:
        return _unknown("VIRUSTOTAL_TIMEOUT", "TIMEOUT")
    except httpx.RequestError as error:
        log_event(logger, logging.ERROR, "virustotal_submit_connection_failed", target_id=target_id, error_type=safe_error(error))
        return _unknown("VIRUSTOTAL_NETWORK_ERROR", "NETWORK_ERROR")
    except Exception as error:
        log_event(logger, logging.ERROR, "virustotal_submit_failed", target_id=target_id, error_type=safe_error(error))
        return _unknown("VIRUSTOTAL_PROVIDER_ERROR", "PROVIDER_ERROR")


def _parse_response(data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        attributes = data.get("data", {}).get("attributes", {})
        stats = attributes.get("last_analysis_stats", {})
        malicious = int(stats.get("malicious", 0) or 0)
        suspicious = int(stats.get("suspicious", 0) or 0)
        harmless = int(stats.get("harmless", 0) or 0)
        undetected = int(stats.get("undetected", 0) or 0)
        additional = {key: value for key, value in stats.items() if key not in {"malicious", "suspicious", "harmless", "undetected"}}
        total = malicious + suspicious + harmless + undetected + sum(int(value or 0) for value in additional.values())
        if malicious >= 3:
            status, confidence = "DANGEROUS", min(1.0, malicious / 10.0)
        elif malicious >= 1 or suspicious >= 1:
            status, confidence = "SUSPICIOUS", 0.6
        elif harmless > 0 and malicious == 0:
            status, confidence = "SAFE", min(1.0, harmless / max(1, total))
        else:
            status, confidence = "UNKNOWN", 0.3
        result = _evidence(status, provider_status="SUCCESS" if status != "UNKNOWN" else "NO_VERDICT")
        result.update({
            "confidence": round(confidence, 4),
            "malicious": malicious,
            "suspicious": suspicious,
            "harmless": harmless,
            "undetected": undetected,
            "total_engines": total,
            "unclassified_engines": sum(int(value or 0) for value in additional.values()),
            "additional_engine_statuses": additional,
            "reputation": attributes.get("reputation", 0),
            "categories": attributes.get("categories", {}),
        })
        return result
    except Exception:
        return _unknown("VIRUSTOTAL_PARSE_ERROR", "PARSE_ERROR")
