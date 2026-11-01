import asyncio

import pytest

from app import system_settings
from app.scans.service import ScanService
import app.scans.service as scan_service


def test_settings_patch_accepts_only_known_keys_and_exact_types():
    patch = system_settings.validate_settings_patch({
        "ui.default_theme": "dark",
        "features.guest_scans_enabled": False,
    })
    assert patch == {"ui.default_theme": "dark", "features.guest_scans_enabled": False}

    with pytest.raises(system_settings.SettingsPatchError):
        system_settings.validate_settings_patch({"secrets.gemini_api_key": "leak"})
    with pytest.raises(system_settings.SettingsPatchError):
        system_settings.validate_settings_patch({"features.guest_scans_enabled": "false"})
    with pytest.raises(system_settings.SettingsPatchError):
        system_settings.validate_settings_patch({})


def test_runtime_config_is_explicit_public_allowlist(monkeypatch):
    monkeypatch.setattr(system_settings, "get_system_settings", lambda **_: {
        **system_settings.SETTING_DEFAULTS,
        "secrets.gemini_api_key": "must-never-be-returned",
        "database.password": "must-never-be-returned-either",
    })
    result = system_settings.get_runtime_config()
    assert set(result) == {
        "default_theme", "default_language", "allow_theme_override", "allow_language_override",
        "maintenance_mode", "registration_enabled", "guest_scanning_enabled", "public_metrics_enabled",
        "ai_explanations_enabled", "require_latest_terms",
    }
    assert "must-never-be-returned" not in repr(result)


def test_runtime_config_fails_closed_if_settings_storage_is_unavailable(monkeypatch):
    def unavailable(**_):
        raise system_settings.SystemSettingsUnavailable("offline")

    monkeypatch.setattr(system_settings, "get_system_settings", unavailable)
    config = system_settings.get_runtime_config()
    assert config["maintenance_mode"] is True
    assert config["registration_enabled"] is False
    assert config["guest_scanning_enabled"] is False
    assert config["ai_explanations_enabled"] is False


def test_ai_disabled_keeps_url_scan_local_and_does_not_call_gemini(monkeypatch):
    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: False)
    monkeypatch.setattr(scan_service, "predict_url", lambda _url: {
        "classification": "SAFE", "confidence": 0.6, "phishing_prob": 0.1, "source": "TEST_ML",
    })

    async def vt(_url):
        return {"status": "UNKNOWN", "malicious": 0, "suspicious": 0, "harmless": 0, "total_engines": 0}

    async def forbidden_gemini(**_kwargs):
        raise AssertionError("Gemini must not be called when the setting is disabled")

    monkeypatch.setattr(scan_service, "check_url_virustotal", vt)
    monkeypatch.setattr(scan_service, "generate_explanation", forbidden_gemini)
    result = asyncio.run(ScanService.process_url_scan("https://example.com"))
    assert result["stages"]["stage3_gemini"]["provider"] == "LOCAL_FEATURE_DISABLED"
    assert result["classification"] in {"SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN"}


def test_ai_disabled_keeps_text_scan_local_and_does_not_call_gemini(monkeypatch):
    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: False)

    async def forbidden_gemini(**_kwargs):
        raise AssertionError("Gemini must not be called when the setting is disabled")

    monkeypatch.setattr(scan_service, "analyze_sms_message", forbidden_gemini)
    result = asyncio.run(ScanService.process_text_scan("تذكير بموعد الاجتماع غداً صباحاً"))
    assert result["stages"]["stage3_gemini_sms"]["provider"] == "LOCAL_FEATURE_DISABLED"
    assert result["explanation"]["provider"] == "LOCAL_FEATURE_DISABLED"
