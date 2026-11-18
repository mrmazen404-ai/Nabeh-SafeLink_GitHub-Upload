import asyncio
import json
from types import SimpleNamespace


def _fake_client(payload):
    class Models:
        async def generate_content(self, **_kwargs):
            return SimpleNamespace(text=json.dumps(payload, ensure_ascii=False))

    return SimpleNamespace(aio=SimpleNamespace(models=Models()))


def test_url_gemini_contract_returns_provider_and_classification(monkeypatch):
    from app.gemini import client as gemini_client

    fake = _fake_client({
        "classification": "SUSPICIOUS",
        "summary": "يظهر الرابط مؤشرات تستدعي التحقق من النطاق والوجهة.",
        "reasons": ["الدليل المقدم يتضمن مؤشرات تحتاج إلى مراجعة."],
        "recommendation": "تحقق من المصدر الرسمي قبل إدخال أي بيانات.",
        "limitations": ["لم يتم إثبات هوية الجهة المالكة للرابط."],
    })
    monkeypatch.setattr(gemini_client, "_get_api_key", lambda: "test-key")
    monkeypatch.setattr(gemini_client, "_get_client", lambda: fake)

    result = asyncio.run(gemini_client.generate_explanation(
        "https://example.com/login",
        "SUSPICIOUS",
        language="ar",
        evidence={"ml": {"classification": "SUSPICIOUS", "source": "ML_MODEL"}},
    ))

    assert result["provider"].startswith("GEMINI")
    assert result["classification"] == "SUSPICIOUS"
    assert result["summary"]


def test_sms_gemini_contract_returns_provider_and_classification(monkeypatch):
    from app.gemini import client as gemini_client

    fake = _fake_client({
        "classification": "DANGEROUS",
        "summary": "الرسالة تطلب إجراءً حساسًا عبر رابط غير موثق.",
        "reasons": ["طلب بيانات حساسة مع رابط مضمّن."],
        "recommendation": "لا تفتح الرابط ولا تشارك بيانات الدخول.",
        "limitations": ["لم يتم التحقق المستقل من هوية المرسل."],
        "claimed_sender": "جهة غير متحققة",
        "official_domain": "fake.example",
        "official_portal_url": "https://fake.example",
        "claim_verdict_explanation": "لا يوجد دليل موثوق يثبت الادعاء.",
        "action_plan_steps": ["تحقق عبر التطبيق الرسمي."],
        "lure_type": "طلب بيانات دخول",
        "authenticity_status": "رسالة رسمية موثقة",
    })
    monkeypatch.setattr(gemini_client, "_get_api_key", lambda: "test-key")
    monkeypatch.setattr(gemini_client, "_get_client", lambda: fake)

    result = asyncio.run(gemini_client.analyze_sms_message(
        "تحقق من حسابك عبر https://example.com/login",
        extracted_url="https://example.com/login",
        evidence={"url_combined_verdict": {"classification": "SUSPICIOUS"}},
        language="ar",
    ))

    assert result["provider"].startswith("GEMINI")
    assert result["classification"] == "DANGEROUS"
    assert result["official_domain"] == "غير متاح"
    assert result["official_portal_url"] == "غير متاح"
    assert result["authenticity_status"] == "غير متحقق"


def test_local_url_explanation_does_not_publish_uncalibrated_probability():
    from app.gemini.client import _local_explanation

    result = _local_explanation(
        "SUSPICIOUS",
        "ar",
        input_value="https://paypa1-secure-login-verify.com/secure",
        evidence={"ml": {"classification": "DANGEROUS", "phishing_prob": 0.999}, "virustotal": {}},
    )
    joined = " ".join(result.get("reasons", []))
    assert "%" not in joined
    assert "99.9" not in joined


def test_local_url_fallback_describes_heuristics_as_weak_signals():
    from app.gemini.client import _local_explanation

    result = _local_explanation(
        "SUSPICIOUS",
        "ar",
        input_value="https://example.xyz/login",
        evidence={},
    )
    joined = " ".join(result.get("reasons", []))
    assert "الامتداد وحده لا يثبت الاحتيال" in joined
    assert result["authenticity_status"] == "غير متحقق"
    assert result["lure_type"] == "غير محدد"
