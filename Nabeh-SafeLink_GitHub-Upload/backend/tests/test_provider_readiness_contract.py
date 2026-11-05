from fastapi import Response

import app.main as main
from app.virustotal import client as virustotal


def test_health_marks_gemini_failure_as_degraded_but_core_ready(monkeypatch):
    monkeypatch.setattr(main, "get_model_readiness", lambda: {"status": "ready", "code": "MODEL_READY"})
    monkeypatch.setattr(main, "get_virustotal_readiness", lambda: {"status": "configured"})
    monkeypatch.setattr(
        main,
        "get_provider_readiness",
        lambda: {"status": "configured", "last_call": {"status": "rate_limited", "error_code": "429"}},
    )

    result = main.health(Response())

    assert result["status"] == "healthy"
    assert result["readiness"] == "ready"
    assert result["providers_degraded"] is True
    assert result["fallback"] == {"status": "enabled", "provider": "LOCAL_RULES"}


def test_readiness_keeps_accepting_when_optional_gemini_is_degraded(monkeypatch):
    monkeypatch.setattr(main, "get_model_readiness", lambda: {"status": "ready"})
    monkeypatch.setattr(main, "get_virustotal_readiness", lambda: {"status": "configured"})
    monkeypatch.setattr(
        main,
        "get_provider_readiness",
        lambda: {"status": "configured", "last_call": {"status": "failed", "error_code": "PROVIDER_ERROR"}},
    )
    response = Response()

    result = main.readiness(response)

    assert response.status_code == 200
    assert result["status"] == "degraded"
    assert result["fallback"]["provider"] == "LOCAL_RULES"


def test_readiness_rejects_when_required_model_is_unavailable(monkeypatch):
    monkeypatch.setattr(main, "get_model_readiness", lambda: {"status": "unavailable"})
    monkeypatch.setattr(main, "get_virustotal_readiness", lambda: {"status": "configured"})
    monkeypatch.setattr(main, "get_provider_readiness", lambda: {"status": "configured", "last_call": {"status": "ready"}})
    response = Response()

    result = main.readiness(response)

    assert response.status_code == 503
    assert result["status"] == "degraded"


def test_virustotal_readiness_distinguishes_configuration_from_last_call(monkeypatch):
    monkeypatch.setattr(virustotal, "_get_api_key", lambda: "test-only-key")
    monkeypatch.setattr(
        virustotal,
        "_LAST_PROVIDER_CALL",
        {"status": "observed", "provider_status": "RATE_LIMITED", "checked_at": "2026-11-06T00:00:00+00:00"},
    )

    result = virustotal.get_provider_readiness()

    assert result["status"] == "configured"
    assert result["functional_status"] == "last_call_failed"
    assert result["last_call"]["provider_status"] == "RATE_LIMITED"
