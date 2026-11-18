"""Centralized, allow-listed runtime settings backed by ``system_settings``.

The browser only receives the explicitly mapped public subset.  Operational
checks use the same short-lived cache but fail closed when persistence is
unavailable.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

from app.db.supabase_client import supabase

logger = logging.getLogger(__name__)



SETTING_DEFAULTS: dict[str, Any] = {
    "ui.default_theme": "light",
    "ui.default_language": "ar",
    "ui.allow_theme_override": True,
    "ui.allow_language_override": True,
    "system.maintenance_mode": False,
    "features.registration_enabled": True,
    "features.guest_scans_enabled": True,
    "features.public_metrics_enabled": True,
    "features.ai_explanations_enabled": True,
    "legal.require_latest_terms": False,
}

PUBLIC_RUNTIME_KEYS = {
    "ui.default_theme",
    "ui.default_language",
    "ui.allow_theme_override",
    "ui.allow_language_override",
    "system.maintenance_mode",
    "features.registration_enabled",
    "features.guest_scans_enabled",
    "features.public_metrics_enabled",
    "features.ai_explanations_enabled",
    "legal.require_latest_terms",
}

_RUNTIME_FIELD_MAP = {
    "default_theme": "ui.default_theme",
    "default_language": "ui.default_language",
    "allow_theme_override": "ui.allow_theme_override",
    "allow_language_override": "ui.allow_language_override",
    "maintenance_mode": "system.maintenance_mode",
    "registration_enabled": "features.registration_enabled",
    "guest_scanning_enabled": "features.guest_scans_enabled",
    "public_metrics_enabled": "features.public_metrics_enabled",
    "ai_explanations_enabled": "features.ai_explanations_enabled",
    "require_latest_terms": "legal.require_latest_terms",
}

_CACHE_TTL_SECONDS = 5.0
_cache_lock = threading.RLock()
_cache_values: dict[str, Any] | None = None
_cache_expires_at = 0.0


class SystemSettingsUnavailable(RuntimeError):
    """Raised when the central settings table cannot be read or validated."""


class SettingsPatchError(ValueError):
    """Raised when a requested setting key or value is not allow-listed."""


def _valid_value(key: str, value: Any) -> bool:
    if key == "ui.default_theme":
        return isinstance(value, str) and value in {"light", "dark"}
    if key == "ui.default_language":
        return isinstance(value, str) and value in {"ar", "en"}
    return type(value) is bool


def validate_settings_patch(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or not payload:
        raise SettingsPatchError("يجب إرسال كائن إعدادات غير فارغ")
    updates: dict[str, Any] = {}
    for key, value in payload.items():
        if key not in SETTING_DEFAULTS:
            raise SettingsPatchError(f"إعداد غير مسموح: {key}")
        if not _valid_value(key, value):
            raise SettingsPatchError(f"قيمة غير صالحة للإعداد: {key}")
        updates[key] = value
    return updates


def _load_values_from_database() -> dict[str, Any]:
    values = dict(SETTING_DEFAULTS)
    try:
        result = (
            supabase.table("system_settings")
            .select("key,value_json")
            .in_("key", list(SETTING_DEFAULTS))
            .execute()
        )
        for row in result.data or []:
            key = row.get("key")
            value = row.get("value_json")
            if key in values and _valid_value(key, value):
                values[key] = value
    except Exception as exc:
        logger.warning("system_settings_read_failed error=%s", type(exc).__name__)
        raise SystemSettingsUnavailable("Central system settings could not be read") from exc
    return values



def get_system_settings(*, force_refresh: bool = False) -> dict[str, Any]:
    """Return a validated snapshot; refresh at most every five seconds."""
    global _cache_values, _cache_expires_at
    now = time.monotonic()
    with _cache_lock:
        if not force_refresh and _cache_values is not None and now < _cache_expires_at:
            return dict(_cache_values)
        values = _load_values_from_database()
        _cache_values = values
        _cache_expires_at = now + _CACHE_TTL_SECONDS
        return dict(values)


def invalidate_settings_cache() -> None:
    global _cache_values, _cache_expires_at
    with _cache_lock:
        _cache_values = None
        _cache_expires_at = 0.0


def get_runtime_config() -> dict[str, Any]:
    """Return public settings and distinguish storage failure from admin maintenance."""
    service_available = True
    try:
        settings = get_system_settings()
    except SystemSettingsUnavailable:
        settings = dict(SETTING_DEFAULTS)
        settings.update({
            # Maintenance is an explicit admin decision, never an outage fallback.
            "system.maintenance_mode": False,
            "features.registration_enabled": False,
            "features.guest_scans_enabled": False,
            "features.public_metrics_enabled": False,
            "features.ai_explanations_enabled": False,
            "legal.require_latest_terms": True,
        })
        service_available = False
    runtime_config = {
        field: settings[key]
        for field, key in _RUNTIME_FIELD_MAP.items()
        if key in PUBLIC_RUNTIME_KEYS
    }
    runtime_config["service_available"] = service_available
    return runtime_config


def setting_enabled(key: str) -> bool:
    """Read a boolean flag strictly; callers decide how to handle failures."""
    if key not in SETTING_DEFAULTS or type(SETTING_DEFAULTS[key]) is not bool:
        raise SettingsPatchError(f"Not a boolean feature flag: {key}")
    return bool(get_system_settings().get(key, SETTING_DEFAULTS[key]))


def setting_enabled_fail_closed(key: str) -> bool:
    """Convenience for optional integrations; storage failures disable the feature."""
    try:
        return setting_enabled(key)
    except SystemSettingsUnavailable:
        return False
