import asyncio

from app.gemini.client import SMS_SYSTEM_INSTRUCTION, _local_sms_analysis
from app.gemini.schemas import validate_gemini_sms_payload
from app.scans.service import ScanService
from app.scans.text_rules import analyze_message_indicators


def test_absence_of_indicators_is_unknown_not_safe():
    for text in ("السلام عليكم", "موعد الاجتماع غداً", "تحديث التطبيق متاح"):
        result = analyze_message_indicators(text)
        assert result["classification"] == "UNKNOWN"
        assert result["confidence"] is None
        assert result["fraud_probability"] is None


def test_explicit_credential_request_is_suspicious_not_dangerous():
    result = analyze_message_indicators("أدخل رمز التحقق وكلمة المرور الآن")
    assert result["classification"] == "SUSPICIOUS"
    assert "credential_request" in result["indicators"]
    assert result["fraud_probability"] is None


def test_security_advice_not_misread_as_credential_collection():
    result = analyze_message_indicators("لا تشارك رمز التحقق أو كلمة المرور مع أي شخص")
    assert result["classification"] == "UNKNOWN"


def test_single_brand_or_url_does_not_establish_a_sms_verdict():
    result = analyze_message_indicators("مصرف الراجحي https://example.com")
    assert result["classification"] == "UNKNOWN"


def test_local_sms_fallback_uses_link_evidence_but_never_fabricates_probability():
    neutral = _local_sms_analysis("السلام عليكم", "", "ar")
    assert neutral["classification"] == "UNKNOWN"
    assert neutral["fraud_probability"] is None

    strong_link = _local_sms_analysis(
        "رسالة إشعار", "https://example.invalid", "ar",
        {"url_combined_verdict": {"classification": "DANGEROUS"}},
    )
    assert strong_link["classification"] == "DANGEROUS"


def test_sms_gemini_schema_drops_unapproved_fields_and_rejects_invalid_enum():
    fallback = {
        "classification": "UNKNOWN",
        "summary": "غير حاسم",
        "recommendation": "تحقق من المصدر مستقلاً.",
    }
    result = validate_gemini_sms_payload({
        "classification": "SAFE",
        "summary": "No risk indicators found.",
        "recommendation": "Verify independently.",
        "fraud_probability": 0.0,
        "api_key": "must-not-pass",
    }, fallback=fallback)
    assert result["classification"] == "SAFE"
    assert "fraud_probability" not in result
    assert "api_key" not in result

    invalid = validate_gemini_sms_payload({
        "classification": "CERTAINLY_SAFE",
        "summary": "unsafe invalid result",
        "recommendation": "trust it",
    }, fallback=fallback)
    assert invalid["classification"] == "UNKNOWN"
    assert invalid["provider"] == "LOCAL_SCHEMA_FALLBACK"
    assert "unsafe invalid result" not in repr(invalid)


def test_sms_prompt_treats_message_as_untrusted_and_allows_abstention():
    prompt = SMS_SYSTEM_INSTRUCTION.lower()
    assert "untrusted data" in prompt
    assert "unknown" in prompt
    assert "100% safe" in prompt
    assert "do not return confidence/probability" in prompt


def test_llm_dangerous_label_is_capped_without_dangerous_link_evidence():
    result = ScanService._enforce_text_safety_floor(
        {"classification": "UNKNOWN", "confidence": None},
        {"classification": "UNKNOWN", "confidence": None},
        {"classification": "SUSPICIOUS", "confidence": None},
    )
    assert result["classification"] == "SUSPICIOUS"


def test_sms_pipeline_never_returns_safe_without_sender_authentication(monkeypatch):
    from app.scans import service as scan_service
    from app.config import settings

    async def model_says_safe(**_kwargs):
        return {
            "classification": "SAFE",
            "summary": "No indicators found.",
            "recommendation": "You may trust it.",
            "provider": "GEMINI_AI",
        }

    monkeypatch.setattr(scan_service, "analyze_sms_message", model_says_safe)
    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: True)
    monkeypatch.setattr(settings, "SCAN_TOTAL_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(settings, "SCAN_AI_TIMEOUT_SECONDS", 4)
    result = asyncio.run(ScanService.process_text_scan("السلام عليكم", language="ar"))
    assert result["classification"] == "UNKNOWN"
    assert result["confidence"] is None
    assert result["fraud_probability"] is None
    assert result["explanation"]["authenticity_status"] == "غير متحقق"


def test_clean_link_reputation_does_not_make_sms_safe(monkeypatch):
    from app.scans import service as scan_service
    from app.config import settings

    async def model_says_safe(**_kwargs):
        return {
            "classification": "SAFE",
            "summary": "No indicators found.",
            "recommendation": "You may trust it.",
            "provider": "GEMINI_AI",
        }

    async def clean_link(**_kwargs):
        return {"status": "SAFE", "harmless": 80, "malicious": 0, "suspicious": 0, "total_engines": 80}

    monkeypatch.setattr(scan_service, "predict_url", lambda _url: {"classification": "SAFE", "phishing_prob": 0.0, "confidence": 0.99})
    monkeypatch.setattr(scan_service, "check_url_virustotal", clean_link)
    monkeypatch.setattr(scan_service, "analyze_sms_message", model_says_safe)
    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: True)
    monkeypatch.setattr(settings, "SCAN_TOTAL_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(settings, "SCAN_AI_TIMEOUT_SECONDS", 4)
    result = asyncio.run(ScanService.process_text_scan("إشعار: https://example.com", language="ar"))
    assert result["classification"] == "UNKNOWN"
    assert result["confidence"] is None


def test_gemini_alone_cannot_set_dangerous_sms_verdict(monkeypatch):
    from app.scans import service as scan_service
    from app.config import settings

    async def model_says_dangerous(**_kwargs):
        return {
            "classification": "DANGEROUS",
            "summary": "Potential fraud.",
            "recommendation": "Do not click.",
            "provider": "GEMINI_AI",
        }

    monkeypatch.setattr(scan_service, "analyze_sms_message", model_says_dangerous)
    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: True)
    monkeypatch.setattr(settings, "SCAN_TOTAL_TIMEOUT_SECONDS", 5)
    monkeypatch.setattr(settings, "SCAN_AI_TIMEOUT_SECONDS", 4)
    result = asyncio.run(ScanService.process_text_scan("السلام عليكم", language="ar"))
    assert result["classification"] == "SUSPICIOUS"
    assert result["fraud_probability"] is None


def test_text_scan_timeout_does_not_mark_greeting_safe(monkeypatch):
    from app.scans import service as scan_service
    from app.config import settings

    async def hanging_analysis(**_kwargs):
        await asyncio.sleep(0.02)

    monkeypatch.setattr(scan_service, "analyze_sms_message", hanging_analysis)
    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: True)
    monkeypatch.setattr(settings, "SCAN_AI_TIMEOUT_SECONDS", 0.001)
    result = asyncio.run(ScanService.process_text_scan("السلام عليكم", language="ar"))
    assert result["classification"] == "UNKNOWN"
    assert result["fraud_probability"] is None


def test_gemini_429_retries_once_then_uses_local_fallback(monkeypatch):
    from app.gemini import client as gemini_client
    from app.config import settings

    class RateLimitedError(Exception):
        status_code = 429

    class Models:
        def __init__(self):
            self.calls = 0

        async def generate_content(self, **_kwargs):
            self.calls += 1
            raise RateLimitedError("rate limited")

    models = Models()
    fake_client = SimpleNamespace(aio=SimpleNamespace(models=models))
    monkeypatch.setattr(gemini_client, "_get_api_key", lambda: "test-key")
    monkeypatch.setattr(gemini_client, "_get_client", lambda: fake_client)
    monkeypatch.setattr(settings, "GEMINI_RATE_LIMIT_BACKOFF_SECONDS", 0.0)
    monkeypatch.setattr(settings, "GEMINI_RATE_LIMIT_MAX_WAIT_SECONDS", 0.0)

    result = asyncio.run(gemini_client.analyze_sms_message("السلام عليكم", language="ar"))

    assert models.calls in (2, 3)
    assert result["provider"] == "LOCAL_AI_RULES"

    assert result["classification"] == "UNKNOWN"


def test_gemini_explanations_with_uncalibrated_percentages_use_fallback():
    from app.gemini.schemas import validate_gemini_payload, validate_gemini_sms_payload

    fallback = {
        "classification": "UNKNOWN",
        "summary": "الأدلة المتاحة غير كافية لتحديد الحالة.",
        "reasons": [],
        "recommendation": "تحقق من الجهة عبر قناة مستقلة.",
        "limitations": [],
    }
    url_result = validate_gemini_payload(
        {"summary": "الرابط آمن بنسبة 99%", "recommendation": "تابع الاستخدام", "reasons": []},
        fallback=fallback,
    )
    sms_result = validate_gemini_sms_payload(
        {
            "classification": "SAFE",
            "summary": "الرسالة موثوقة بنسبة 95%",
            "recommendation": "تابع الاستخدام",
            "reasons": [],
        },
        fallback=fallback,
    )

    assert url_result["summary"] == fallback["summary"]
    assert sms_result["summary"] == fallback["summary"]
    assert sms_result["classification"] == "UNKNOWN"


def test_url_gemini_system_instruction_marks_input_as_untrusted():
    from app.gemini.client import SYSTEM_INSTRUCTION

    assert "untrusted data" in SYSTEM_INSTRUCTION.lower()
    assert "never instructions" in SYSTEM_INSTRUCTION.lower()


def test_gemini_runtime_key_is_used_when_settings_snapshot_is_empty(monkeypatch):
    from app.gemini import client as gemini_client
    from app.config import settings

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEY", "runtime-test-key")

    assert gemini_client._get_api_key() == "runtime-test-key"


def test_multi_link_scan_public_evidence_matches_strongest_link(monkeypatch):
    from app.scans import service as scan_service
    from app.config import settings

    def fake_predict(url):
        if "danger.example" in url:
            return {"classification": "DANGEROUS", "phishing_prob": 0.95, "confidence": 0.95, "source": "FAKE_ML"}
        return {"classification": "SAFE", "phishing_prob": 0.01, "confidence": 0.99, "source": "FAKE_ML"}

    async def fake_virustotal(url):
        if "danger.example" in url:
            return {"status": "DANGEROUS", "malicious": 5, "suspicious": 0, "harmless": 85, "total_engines": 90}
        return {"status": "SAFE", "malicious": 0, "suspicious": 0, "harmless": 90, "total_engines": 90}

    monkeypatch.setattr(scan_service, "predict_url", fake_predict)
    monkeypatch.setattr(scan_service, "check_url_virustotal", fake_virustotal)
    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: False)
    monkeypatch.setattr(settings, "SCAN_TOTAL_TIMEOUT_SECONDS", 5)

    result = asyncio.run(ScanService.process_text_scan(
        "افتح https://safe.example/ ثم https://danger.example/login",
        language="ar",
    ))

    assert result["classification"] == "DANGEROUS"
    assert result["selected_url"] == "https://danger.example/login"
    assert result["virustotal"]["status"] == "DANGEROUS"
    assert result["ml_model"]["classification"] == "DANGEROUS"
    assert result["stages"]["stage2_link_audit"]["status"] == "DANGEROUS"
    assert result["stages"]["stage2_link_audit"]["results"][0]["classification"] == "SAFE"
    assert result["stages"]["stage2_link_audit"]["results"][1]["classification"] == "DANGEROUS"


def test_sms_reports_partial_coverage_for_defanged_links(monkeypatch):
    from app.scans import service as scan_service
    from app.config import settings

    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: False)
    monkeypatch.setattr(settings, "SCAN_TOTAL_TIMEOUT_SECONDS", 5)

    result = asyncio.run(ScanService.process_text_scan(
        "تحذير: افتح hxxps://example[.]com فوراً",
        language="ar",
    ))

    assert result["analysis_coverage"] == "PARTIAL"
    assert "DEFANGED_URL_NOT_SCANNED" in result["coverage_reasons"]
    assert result["unscanned_url_candidates"]
    assert result["links_not_scanned_count"] >= 1


def test_sms_reports_message_truncation_and_gemini_coverage(monkeypatch):
    from app.scans import service as scan_service
    from app.config import settings

    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: False)
    monkeypatch.setattr(settings, "SCAN_TOTAL_TIMEOUT_SECONDS", 5)

    message = ("رسالة طويلة " * 80) + " أدخل رمز التحقق الآن"
    result = asyncio.run(ScanService.process_text_scan(message, language="ar"))

    assert result["analysis_coverage"] == "PARTIAL"
    assert "MESSAGE_TRUNCATED_FOR_GEMINI" in result["coverage_reasons"]
    assert result["message_characters"] == len(message)
    assert result["gemini_characters_analyzed"] == 600
    assert result["explanation"]["input_truncated"] is True
from types import SimpleNamespace
