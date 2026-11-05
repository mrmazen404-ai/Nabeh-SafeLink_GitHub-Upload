import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.virustotal import client


class FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class FakeClient:
    def __init__(self, get_responses=(), post_response=None, post_error=None):
        self.get_responses = list(get_responses)
        self.post_response = post_response or FakeResponse(201)
        self.post_error = post_error
        self.get_calls = []
        self.post_calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def get(self, url, **kwargs):
        self.get_calls.append((url, kwargs))
        if not self.get_responses:
            raise AssertionError("Unexpected GET; test attempted an unconfigured network request")
        response = self.get_responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    async def post(self, url, **kwargs):
        self.post_calls.append((url, kwargs))
        if self.post_error:
            raise self.post_error
        return self.post_response


def _payload(last_analysis_date="recent"):
    attributes = {"last_analysis_stats": {"malicious": 0, "harmless": 8, "undetected": 2}}
    if last_analysis_date is not None:
        attributes["last_analysis_date"] = last_analysis_date
    elif last_analysis_date is None:
        attributes["last_analysis_date"] = None
    return {"data": {"attributes": attributes}}


def _mock_httpx(monkeypatch, fake):
    monkeypatch.setattr(client, "_get_api_key", lambda: "test-api-key")
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_kwargs: fake)


def test_404_does_not_submit_by_default(monkeypatch):
    monkeypatch.delenv("VIRUSTOTAL_ALLOW_SUBMISSION", raising=False)
    fake = FakeClient(get_responses=[FakeResponse(404)])
    _mock_httpx(monkeypatch, fake)

    result = asyncio.run(client.check_url_virustotal("https://example.com/path"))

    assert result["status"] == "UNKNOWN"
    assert result["provider_status"] == "SUBMISSION_DISABLED"
    assert result["error"] == "VIRUSTOTAL_SUBMISSION_DISABLED"
    assert not fake.post_calls


@pytest.mark.parametrize("url", [
    "https://example.com/?access_token=do-not-send",
    "https://example.com/?api_key=do-not-send",
    "https://example.com/?password=do-not-send",
    "https://example.com/?client_secret=do-not-send",
    "https://example.com/?session_id=do-not-send",
    "https://example.com/?auth_code=do-not-send",
    "https://127.0.0.1/path",
    "https://10.0.0.4/path",
    "https://127.1/path",
    "https://2130706433/path",
    "https://[::1]/path",
    "http://localhost/path",
    "http://service.local/path",
    "http://service.internal/path",
])
def test_opt_in_still_blocks_sensitive_or_nonpublic_targets(monkeypatch, url):
    monkeypatch.setenv("VIRUSTOTAL_ALLOW_SUBMISSION", "true")
    fake = FakeClient(get_responses=[FakeResponse(404)])
    _mock_httpx(monkeypatch, fake)

    result = asyncio.run(client.check_url_virustotal(url))

    assert result["status"] == "UNKNOWN"
    assert result["provider_status"] == "PRIVACY_BLOCKED"
    assert result["error"] == "VIRUSTOTAL_TARGET_NOT_SHARED"
    assert not fake.post_calls
    assert not fake.get_calls
    assert "do-not-send" not in str(result)


def test_sensitive_word_in_non_sensitive_query_key_is_not_overblocked(monkeypatch):
    monkeypatch.setenv("VIRUSTOTAL_ALLOW_SUBMISSION", "true")
    recent_date = int(datetime.now(timezone.utc).timestamp())
    fake = FakeClient(get_responses=[FakeResponse(404), FakeResponse(200, _payload(recent_date))])
    _mock_httpx(monkeypatch, fake)
    async def no_wait(_seconds):
        return None
    monkeypatch.setattr(client.asyncio, "sleep", no_wait)

    result = asyncio.run(client.check_url_virustotal("https://example.com/?monkey=tree"))

    assert result["provider_status"] == "SUCCESS"
    assert len(fake.get_calls) == 2
    assert len(fake.post_calls) == 1


def test_capacity_limit_returns_unknown_without_provider_request(monkeypatch):
    import threading

    fake = FakeClient(get_responses=[FakeResponse(200, _payload(int(datetime.now(timezone.utc).timestamp())))])
    _mock_httpx(monkeypatch, fake)
    monkeypatch.setattr(client, "_REQUEST_SLOTS", threading.BoundedSemaphore(1))
    assert client._REQUEST_SLOTS.acquire(blocking=False)

    result = asyncio.run(client.check_url_virustotal("https://example.com/path"))

    assert result["status"] == "UNKNOWN"
    assert result["provider_status"] == "BUSY"
    assert not fake.get_calls


@pytest.mark.parametrize(("date_offset", "expected_status"), [
    (timedelta(hours=24), "SAFE"),
    (timedelta(hours=169), "UNKNOWN"),
    (None, "UNKNOWN"),
])
def test_lookup_applies_freshness_and_preserves_historical_counts(monkeypatch, date_offset, expected_status):
    monkeypatch.delenv("VIRUSTOTAL_ALLOW_SUBMISSION", raising=False)
    monkeypatch.delenv("VIRUSTOTAL_MAX_ANALYSIS_AGE_HOURS", raising=False)
    now = datetime.now(timezone.utc)
    analysis_date = int((now - date_offset).timestamp()) if date_offset is not None else None
    fake = FakeClient(get_responses=[FakeResponse(200, _payload(analysis_date))])
    _mock_httpx(monkeypatch, fake)

    result = asyncio.run(client.check_url_virustotal("https://example.com"))

    assert result["status"] == expected_status
    assert result["harmless"] == 8
    assert result["undetected"] == 2
    assert result["last_analysis_date"] == analysis_date
    if date_offset is None:
        assert result["provider_status"] == "ANALYSIS_DATE_MISSING"
        assert "timestamp is missing" in result["analysis_freshness_reason"]
    elif date_offset > timedelta(hours=168):
        assert result["provider_status"] == "ANALYSIS_STALE"
        assert "older than" in result["analysis_freshness_reason"]
    else:
        assert result["provider_status"] == "SUCCESS"


def test_submit_poll_applies_freshness_to_old_analysis(monkeypatch):
    monkeypatch.setenv("VIRUSTOTAL_ALLOW_SUBMISSION", "true")
    monkeypatch.setenv("VIRUSTOTAL_MAX_ANALYSIS_AGE_HOURS", "168")
    old_date = int((datetime.now(timezone.utc) - timedelta(days=10)).timestamp())
    fake = FakeClient(
        get_responses=[FakeResponse(404), FakeResponse(200, _payload(old_date))],
        post_response=FakeResponse(201),
    )
    _mock_httpx(monkeypatch, fake)

    async def no_wait(_seconds):
        return None

    monkeypatch.setattr(client.asyncio, "sleep", no_wait)
    result = asyncio.run(client.check_url_virustotal("https://public-example.com"))

    assert len(fake.post_calls) == 1
    assert result["status"] == "UNKNOWN"
    assert result["provider_status"] == "ANALYSIS_STALE"
    assert result["harmless"] == 8
    assert result["last_analysis_date"] == old_date


def test_provider_failures_return_sanitized_output(monkeypatch):
    fake = FakeClient(get_responses=[FakeResponse(500, {"error": "secret-token=provider-detail"})])
    _mock_httpx(monkeypatch, fake)

    result = asyncio.run(client.check_url_virustotal("https://example.com"))

    assert result == {
        "status": "UNKNOWN",
        "confidence": 0.0,
        "provider_status": "PROVIDER_ERROR",
        "error": "VIRUSTOTAL_PROVIDER_ERROR",
    }
    assert "provider-detail" not in str(result)


def test_submission_network_error_does_not_expose_exception(monkeypatch):
    monkeypatch.setenv("VIRUSTOTAL_ALLOW_SUBMISSION", "true")
    fake = FakeClient(get_responses=[FakeResponse(404)], post_error=RuntimeError("secret-token=provider-detail"))
    _mock_httpx(monkeypatch, fake)

    result = asyncio.run(client.check_url_virustotal("https://public-example.com"))

    assert result["provider_status"] == "NETWORK_ERROR"
    assert result["error"] == "VIRUSTOTAL_NETWORK_ERROR"
    assert "secret-token" not in str(result)
    assert "provider-detail" not in str(result)
