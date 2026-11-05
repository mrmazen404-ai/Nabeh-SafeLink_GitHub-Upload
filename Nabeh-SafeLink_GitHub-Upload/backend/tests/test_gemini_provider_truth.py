import asyncio
import json
import threading
from types import SimpleNamespace


def _fake_client(responses):
    class Models:
        def __init__(self):
            self.calls = []
            self.responses = iter(responses)

        async def generate_content(self, **kwargs):
            self.calls.append(kwargs)
            item = next(self.responses)
            if isinstance(item, Exception):
                raise item
            return SimpleNamespace(text=item if isinstance(item, str) else json.dumps(item, ensure_ascii=False))

    models = Models()
    return SimpleNamespace(aio=SimpleNamespace(models=models)), models


def _url_payload(classification="SUSPICIOUS"):
    return {
        "classification": classification,
        "summary": "تفسير داعم يستند إلى الأدلة المقدمة دون إثبات جهة رسمية.",
        "reasons": ["مؤشر وصفي فقط."],
        "recommendation": "تحقق من المصدر عبر قناة مستقلة.",
        "limitations": ["لم يتم التحقق من ملكية النطاق."],
    }


def _sms_payload(classification="UNKNOWN"):
    return {
        "classification": classification,
        "summary": "لا تكفي الأدلة المتاحة للتحقق من هوية المرسل.",
        "reasons": ["لا توجد أدلة مستقلة على هوية المرسل."],
        "recommendation": "تحقق من المصدر عبر قناة مستقلة.",
        "limitations": ["لم يتم التحقق من هوية المرسل."],
    }


def _configure(monkeypatch, fake, models=("unit-test-model",)):
    from app.gemini import client as gemini

    monkeypatch.setattr(gemini, "_get_api_key", lambda: "fake-test-key")
    monkeypatch.setattr(gemini, "_get_client", lambda: fake)
    monkeypatch.setattr(gemini, "PRIMARY_MODELS", list(models))
    return gemini


def test_url_gemini_cannot_override_fusion_classification(monkeypatch):
    fake, _ = _fake_client([_url_payload("DANGEROUS")])
    gemini = _configure(monkeypatch, fake)

    result = asyncio.run(gemini.generate_explanation("https://example.test/", "SAFE", evidence={}))

    assert result["classification"] == "SAFE"
    assert result["provider_status"] == "SUCCESS"
    assert result["provider"].startswith("GEMINI")


def test_url_non_json_advances_to_json_mode_and_valid_json_succeeds(monkeypatch):
    fake, models = _fake_client(["Here is a plain-text answer", _url_payload("SAFE")])
    gemini = _configure(monkeypatch, fake)

    result = asyncio.run(gemini.generate_explanation("https://example.test/", "SUSPICIOUS"))

    assert len(models.calls) == 2
    assert models.calls[0]["config"].response_mime_type is None
    assert models.calls[1]["config"].response_mime_type == "application/json"
    assert result["classification"] == "SUSPICIOUS"
    assert result["provider_status"] == "SUCCESS"


def test_url_non_json_exhaustion_uses_local_fallback_without_gemini_success(monkeypatch, caplog):
    fake, models = _fake_client(["not JSON", "still not JSON"])
    gemini = _configure(monkeypatch, fake, models=("only-model",))

    result = asyncio.run(gemini.generate_explanation("https://example.test/", "SUSPICIOUS"))

    assert len(models.calls) == 2
    assert result["provider"] == "LOCAL_RULES"
    assert result["provider_status"] == "FALLBACK"
    assert result["fallback_reason"] == "NON_JSON_RESPONSE"
    assert gemini._last_provider_status["status"] == "fallback"
    assert "scan_gemini_attempt_succeeded" not in caplog.text


def test_invalid_url_schema_falls_back_locally_and_is_not_attributed_to_gemini(monkeypatch):
    invalid = {**_url_payload(), "classification": "CERTAINLY_SAFE"}
    fake, models = _fake_client([invalid, invalid])
    gemini = _configure(monkeypatch, fake, models=("only-model",))

    result = asyncio.run(gemini.generate_explanation("https://example.test/", "UNKNOWN"))

    assert len(models.calls) == 2
    assert result["provider"] == "LOCAL_RULES"
    assert not result["provider"].startswith("GEMINI")
    assert result["provider_status"] == "FALLBACK"
    assert result["fallback_reason"] == "SCHEMA_INVALID"
    assert gemini._last_provider_status["status"] == "fallback"


def test_url_input_truncation_flag_on_success_and_local_fallback(monkeypatch):
    fake, _ = _fake_client([_url_payload()])
    gemini = _configure(monkeypatch, fake)
    success = asyncio.run(gemini.generate_explanation("https://example.test/" + "a" * 400, "SAFE"))
    assert success["input_truncated"] is True

    monkeypatch.setattr(gemini, "_get_api_key", lambda: "")
    fallback = asyncio.run(gemini.generate_explanation("https://example.test/" + "a" * 400, "SAFE"))
    assert fallback["provider"] == "LOCAL_RULES"
    assert fallback["provider_status"] == "FALLBACK"
    assert fallback["fallback_reason"] == "GEMINI_API_KEY_MISSING"
    assert fallback["input_truncated"] is True


def test_sms_truncation_flag_is_reported_without_changing_model_verdict(monkeypatch):
    fake, _ = _fake_client([_sms_payload("DANGEROUS")])
    gemini = _configure(monkeypatch, fake)

    result = asyncio.run(gemini.analyze_sms_message("x" * 601, extracted_url="", language="en"))

    assert result["classification"] == "DANGEROUS"
    assert result["provider_status"] == "SUCCESS"
    assert result["input_truncated"] is True


def test_sms_local_fallback_reports_truncation_and_reason(monkeypatch):
    from app.gemini import client as gemini

    monkeypatch.setattr(gemini, "_get_api_key", lambda: "")
    result = asyncio.run(gemini.analyze_sms_message("x" * 601, language="en"))

    assert result["provider"] == "LOCAL_AI_RULES"
    assert result["provider_status"] == "FALLBACK"
    assert result["fallback_reason"] == "GEMINI_API_KEY_MISSING"
    assert result["input_truncated"] is True


def test_gemini_capacity_limit_returns_explicit_local_fallback(monkeypatch):
    from app.gemini import client as gemini

    slots = threading.BoundedSemaphore(1)
    monkeypatch.setattr(gemini, "_GEMINI_REQUEST_SLOTS", slots)
    assert slots.acquire(blocking=False)
    try:
        result = asyncio.run(gemini.generate_explanation("https://example.test", "UNKNOWN"))
    finally:
        slots.release()

    assert result["provider"] == "LOCAL_RULES"
    assert result["provider_status"] == "FALLBACK"
    assert result["fallback_reason"] == "GEMINI_CAPACITY_LIMITED"
