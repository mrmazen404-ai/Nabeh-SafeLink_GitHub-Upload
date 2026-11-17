from app.gemini.schemas import validate_gemini_sms_payload


def test_sms_contract_v2_has_stable_verification_keys_and_defaults():
    result = validate_gemini_sms_payload(
        {
            "classification": "SUSPICIOUS",
            "summary": "توجد مؤشرات تستدعي التحقق.",
            "recommendation": "تحقق عبر القناة الرسمية.",
            "reasons": ["يوجد رابط مضمّن."],
            "unknown_model_field": "must be ignored",
        },
        fallback={"classification": "UNKNOWN"},
    )

    expected_keys = {
        "classification", "summary", "reasons", "recommendation", "limitations",
        "claimed_sender", "claimed_entity", "claim_status", "observed_url", "observed_host",
        "domain_match", "impersonation_signals", "official_domain", "official_portal_url",
        "portal_source", "search_status", "source_quality", "source_conflict",
        "claim_verdict_explanation", "action_plan_steps", "lure_type", "authenticity_status", "citations",
    }
    assert set(result) == expected_keys
    assert result["claim_status"] == "UNKNOWN"
    assert result["search_status"] == "NOT_USED"
    assert result["source_quality"] == "UNKNOWN"
    assert "unknown_model_field" not in result


def test_sms_contract_v2_rejects_numeric_probability_language():
    result = validate_gemini_sms_payload(
        {
            "classification": "UNKNOWN",
            "summary": "توجد ثقة 95%.",
            "recommendation": "تحقق.",
        },
        fallback={"classification": "UNKNOWN"},
    )
    assert result["classification"] == "UNKNOWN"
    assert result["provider"] == "LOCAL_SCHEMA_FALLBACK"
    assert result["fallback_reason"] == "SCHEMA_INVALID"
