"""Security-conscious structured observability for Nabeh SafeLink.

The logger deliberately sanitizes before formatting so callers never need to
remember how to redact nested provider payloads. Raw inputs, credentials and
provider responses must not be passed to log_event.
"""
from __future__ import annotations

import contextvars
import hashlib
import json
import logging
import os
import re
import time
from datetime import UTC, date, datetime
from typing import Any

_REQUEST_ID: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
_OPERATION_ID: contextvars.ContextVar[str] = contextvars.ContextVar("operation_id", default="-")
_MAX_TEXT = 240
_MAX_ITEMS = 32
_SAFE_KEY = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
_SECRET_KEY_RE = re.compile(
    r"(token|secret|password|passwd|api[_-]?key|authorization|cookie|jwt|otp|code_hash|cipher|nonce|private[_-]?key)", re.I
)
_CONTENT_KEY_RE = re.compile(r"(^|_)(input|message|prompt|response|body|query|fragment|raw|content|url|email|phone|address)(_|$)", re.I)


def set_request_id(value: str):
    return _REQUEST_ID.set(value or "-")


def reset_request_id(token: contextvars.Token) -> None:
    _REQUEST_ID.reset(token)


def request_id() -> str:
    return _REQUEST_ID.get()


def set_operation_id(value: str):
    return _OPERATION_ID.set(value or "-")


def reset_operation_id(token: contextvars.Token) -> None:
    _OPERATION_ID.reset(token)


def operation_id() -> str:
    return _OPERATION_ID.get()


def configure_logging() -> None:
    level_name = os.getenv("NABEH_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        root.addHandler(handler)
    root.setLevel(level)
    for noisy in ("httpx", "httpcore", "hpack", "urllib3", "google", "google.genai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id()
        return True


def install_request_id_filter() -> None:
    for handler in logging.getLogger().handlers:
        if not any(isinstance(item, _RequestIdFilter) for item in handler.filters):
            handler.addFilter(_RequestIdFilter())


def _safe_value(key: str, value: Any, *, depth: int = 0) -> Any:
    key_text = str(key)
    if _SECRET_KEY_RE.search(key_text):
        return "[REDACTED]"
    if key_text.lower() in {"input_type", "input_kind", "scan_mode", "mode", "route", "method", "status", "event", "provider", "model", "error_code", "error_type", "operation_name"}:
        if isinstance(value, str):
            return value[:_MAX_TEXT]
        return value
    if _CONTENT_KEY_RE.search(key_text):
        # Keep only explicitly safe identifiers under content-like keys.
        if key_text.lower().endswith(("_id", "_hash", "_count")):
            return _safe_value(key_text, value, depth=depth + 1)
        return "[REDACTED]"
    if depth > 3:
        return "[TRUNCATED]"
    if isinstance(value, dict):
        result = {}
        for index, (nested_key, nested_value) in enumerate(value.items()):
            if index >= _MAX_ITEMS:
                result["_truncated"] = True
                break
            safe_key = nested_key if _SAFE_KEY.fullmatch(str(nested_key)) else "field"
            result[safe_key] = _safe_value(str(nested_key), nested_value, depth=depth + 1)
        return result
    if isinstance(value, (list, tuple, set)):
        return [_safe_value(key_text, item, depth=depth + 1) for item in list(value)[:_MAX_ITEMS]]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        if isinstance(value, str) and len(value) > _MAX_TEXT:
            return value[:_MAX_TEXT] + "…"
        return value
    return str(value)[:_MAX_TEXT]


def sanitize_fields(fields: dict[str, Any]) -> dict[str, Any]:
    return {str(key): _safe_value(str(key), value) for key, value in fields.items()}


def log_event(logger: logging.Logger, level: int, event: str, **fields: Any) -> None:
    """Emit searchable JSON with mandatory correlation and environment fields."""
    safe = sanitize_fields(fields)
    safe.setdefault("timestamp", datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"))
    safe.setdefault("service", os.getenv("NABEH_SERVICE_NAME", "nabeh-safelink"))
    safe.setdefault("environment", os.getenv("NABEH_ENVIRONMENT", os.getenv("ENVIRONMENT", "development")))
    safe.setdefault("event", event)
    safe.setdefault("request_id", request_id())
    safe.setdefault("operation_id", operation_id())
    safe.setdefault("level", logging.getLevelName(level))
    logger.log(level, json.dumps(safe, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def safe_error(error: BaseException) -> str:
    return type(error).__name__


def safe_error_code(error: BaseException | None) -> str | None:
    if error is None:
        return None
    for attribute in ("status_code", "code", "status"):
        value = getattr(error, attribute, None)
        if isinstance(value, (str, int)) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,40}", str(value)):
            return str(value)
    return None


def mask_email(email: str) -> str:
    value = (email or "").strip().lower()
    if "@" not in value:
        return "[invalid-email]"
    local, domain = value.split("@", 1)
    return f"{local[:1] or '*'}***@{domain[:80]}"


def resource_id(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8", "ignore")).hexdigest()[:12]


def elapsed_ms(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)
