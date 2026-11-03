import asyncio

import httpx


def test_health_reports_degraded_after_gemini_rate_limit(monkeypatch):
    from fastapi import Response
    import app.main as main

    monkeypatch.setattr(main, "get_model_readiness", lambda: {"status": "ready", "code": "MODEL_READY"})
    monkeypatch.setattr(main, "get_virustotal_readiness", lambda: {"status": "configured"})
    monkeypatch.setattr(
        main,
        "get_provider_readiness",
        lambda: {
            "status": "configured",
            "model": "configured-model",
            "last_call": {"status": "rate_limited", "error_code": "429"},
        },
    )

    result = main.health(Response())
    assert result["status"] == "degraded"
    assert result["readiness"] == "ready"
    assert result["fallback"] == {"status": "enabled", "provider": "LOCAL_RULES"}


def test_ready_is_degraded_but_accepting_when_gemini_is_down(monkeypatch):
    from fastapi import Response
    import app.main as main

    monkeypatch.setattr(main, "get_model_readiness", lambda: {"status": "ready"})
    monkeypatch.setattr(main, "get_virustotal_readiness", lambda: {"status": "configured"})
    monkeypatch.setattr(
        main,
        "get_provider_readiness",
        lambda: {"status": "configured", "last_call": {"status": "failed", "error_code": "429"}},
    )
    response = Response()
    result = main.readiness(response)
    assert response.status_code == 200
    assert result["status"] == "degraded"


def test_virustotal_auth_error_is_explicit_and_non_sensitive(monkeypatch):
    from app.virustotal import client

    class FakeResponse:
        status_code = 401
        headers = {}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def get(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr(client, "_get_api_key", lambda: "configured")
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    result = asyncio.run(client.check_url_virustotal("https://example.com"))
    assert result["status"] == "UNKNOWN"
    assert result["error"] == "VIRUSTOTAL_AUTH_ERROR"
    assert result["provider_status"] == "AUTH_ERROR"
    assert "configured" not in str(result)


def test_virustotal_rate_limit_preserves_retry_after(monkeypatch):
    from app.virustotal import client

    class FakeResponse:
        status_code = 429
        headers = {"retry-after": "7"}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def get(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr(client, "_get_api_key", lambda: "configured")
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    result = asyncio.run(client.check_url_virustotal("https://example.com"))
    assert result["status"] == "UNKNOWN"
    assert result["error"] == "VIRUSTOTAL_RATE_LIMITED"
    assert result["provider_status"] == "RATE_LIMITED"
    assert result["retry_after"] == "7"
