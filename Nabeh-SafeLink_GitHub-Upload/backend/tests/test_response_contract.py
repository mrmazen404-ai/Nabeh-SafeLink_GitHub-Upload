from app.scans.response_contract import CONTRACT_VERSION, build_analysis_contract


def test_contract_separates_ml_and_virustotal_evidence_without_changing_meaning():
    result = {
        "classification": "SUSPICIOUS",
        "source": "ML_SUSPICIOUS_SIGNAL",
        "stages": {
            "stage1_ml": {"classification": "SUSPICIOUS", "source": "ML_MODEL"},
            "stage2_virustotal": {
                "status": "UNKNOWN",
                "provider_status": "ANALYSIS_STALE",
            },
            "stage3_gemini": {
                "provider": "LOCAL_RULES",
                "provider_status": "FALLBACK",
                "classification": "SUSPICIOUS",
            },
        },
        "ml_model": {"classification": "SUSPICIOUS", "source": "ML_MODEL"},
        "virustotal": {
            "status": "UNKNOWN",
            "provider_status": "ANALYSIS_STALE",
            "counts": {"malicious": 0, "suspicious": 0, "undetected": 32, "total_engines": 93},
        },
        "explanation": {
            "provider": "LOCAL_RULES",
            "provider_status": "FALLBACK",
            "classification": "SUSPICIOUS",
            "citations": [],
        },
        "evidence_card": {
            "decision": {
                "classification": "SUSPICIOUS",
                "code": "ML_SUSPICIOUS_SIGNAL",
                "policy_id": "NABEH_URL_FUSION",
                "policy_version": "1.1.0",
                "inputs": {"ml_strong_signals": []},
                "thresholds": {"suspicious_min_vt_suspicious_engines": 2},
            },
            "url_observations": {
                "items": [{"code": "URL_LENGTH", "value": 33}]
            },
        },
    }

    contract = build_analysis_contract(result)

    assert contract["contract_version"] == CONTRACT_VERSION
    assert contract["final_decision"]["classification"] == "SUSPICIOUS"
    assert contract["ml_analysis"]["classification"] == "SUSPICIOUS"
    assert contract["ml_analysis"]["observed_facts"] == [{"code": "URL_LENGTH", "value": 33}]
    assert contract["ml_analysis"]["evidence"] == [
        {"code": "URL_LENGTH", "value": 33, "type": "MEASURED_FACT"}
    ]
    assert "ML_NO_EXPLICIT_STRUCTURAL_SIGNALS_REPORTED" in contract["ml_analysis"]["reason_codes"]
    assert contract["ml_analysis"]["model_attribution"]["available"] is False
    assert contract["virustotal_analysis"]["classification"] == "UNKNOWN"
    assert contract["virustotal_analysis"]["provider_status"] == "ANALYSIS_STALE"
    assert contract["virustotal_analysis"]["counts"]["undetected"] == 32
    assert contract["virustotal_analysis"]["evidence"] == [
        {"code": "VT_MALICIOUS_ENGINE_COUNT", "value": 0, "type": "PROVIDER_FACT"},
        {"code": "VT_SUSPICIOUS_ENGINE_COUNT", "value": 0, "type": "PROVIDER_FACT"},
        {"code": "VT_PROVIDER_ANALYSIS_STALE", "type": "PROVIDER_STATUS"},
    ]
    assert "VT_PROVIDER_ANALYSIS_STALE" in contract["virustotal_analysis"]["reason_codes"]
    assert contract["gemini_analysis"]["provider"] == "LOCAL_RULES"
    assert contract["gemini_analysis"]["provider_status"] == "FALLBACK"
    assert contract["fusion_analysis"]["decision_code"] == "ML_SUSPICIOUS_SIGNAL"
    assert contract["fusion_analysis"]["rules_applied"] == ["RULE_ML_SUSPICIOUS_CLASSIFICATION"]
    assert contract["gemini_analysis"]["role"] == "SUPPORTING_EXPLANATION_NOT_DECISION_SOURCE"
    assert "GEMINI_FALLBACK" in contract["gemini_analysis"]["reason_codes"]


def test_contract_does_not_mutate_input_or_invent_missing_evidence():
    result = {
        "classification": "UNKNOWN",
        "source": "INSUFFICIENT_EVIDENCE",
        "ml_model": {"classification": "UNKNOWN", "source": "INVALID_URL"},
        "virustotal": {"status": "UNKNOWN", "provider_status": "SUBMISSION_DISABLED"},
        "explanation": {"provider": "LOCAL_RULES", "provider_status": "FALLBACK"},
    }

    contract = build_analysis_contract(result)

    assert result == {
        "classification": "UNKNOWN",
        "source": "INSUFFICIENT_EVIDENCE",
        "ml_model": {"classification": "UNKNOWN", "source": "INVALID_URL"},
        "virustotal": {"status": "UNKNOWN", "provider_status": "SUBMISSION_DISABLED"},
        "explanation": {"provider": "LOCAL_RULES", "provider_status": "FALLBACK"},
    }
    assert contract["final_decision"]["classification"] == "UNKNOWN"
    assert contract["ml_analysis"]["model_attribution"]["available"] is False
    assert contract["ml_analysis"]["observed_facts"] == []
    assert "ML_INVALID_URL" in contract["ml_analysis"]["reason_codes"]
    assert contract["virustotal_analysis"]["provider_status"] == "SUBMISSION_DISABLED"
    assert contract["virustotal_analysis"]["reason_codes"] == ["VT_PROVIDER_SUBMISSION_DISABLED"]
    assert contract["gemini_analysis"]["citations"] == []
    assert contract["unknown_analysis"]["is_unknown"] is True
    assert "ML_INVALID_URL" in contract["unknown_analysis"]["reason_codes"]
    assert "VT_SUBMISSION_DISABLED" in contract["unknown_analysis"]["reason_codes"]


def test_ml_evidence_keeps_structural_signals_separate_from_measured_facts_and_attribution():
    result = {
        "classification": "DANGEROUS",
        "ml_model": {
            "classification": "DANGEROUS",
            "raw_classification": "DANGEROUS",
            "source": "ML_MODEL",
            "confidence": 0.91,
            "calibrated_phishing_prob": 0.91,
            "probability_status": "CALIBRATED",
            "calibration_method": "SIGMOID",
            "calibration_version": "v1",
            "context_gated": False,
        },
        "evidence_card": {
            "decision": {"inputs": {"ml_strong_signals": ["PUNYCODE_HOST", "CREDENTIAL_TERM"]}},
            "url_observations": {"items": [{"code": "URL_LENGTH", "value": 120}]},
        },
    }

    ml = build_analysis_contract(result)["ml_analysis"]

    assert ml["status"] == "COMPLETED"
    assert ml["phishing_probability"] == 0.91
    assert ml["probability_status"] == "CALIBRATED"
    assert {item["type"] for item in ml["evidence"]} == {"MEASURED_FACT", "EXPLICIT_STRUCTURAL_SIGNAL"}
    assert ml["model_attribution"] == {
        "available": False,
        "reason_code": "MODEL_ATTRIBUTION_NOT_AVAILABLE",
        "message": "Measured URL properties are not proof of individual LightGBM feature contributions.",
    }


def test_contract_withholds_raw_probability_when_artifact_is_uncalibrated():
    result = {
        "classification": "SUSPICIOUS",
        "ml_model": {
            "classification": "SUSPICIOUS",
            "source": "ML_MODEL",
            "phishing_prob": 0.91,
            "probability_status": "UNCALIBRATED",
        },
    }

    ml = build_analysis_contract(result)["ml_analysis"]

    assert ml["phishing_probability"] is None
    assert ml["probability_status"] == "UNCALIBRATED"
    assert "CALIBRATED_PROBABILITY_UNAVAILABLE" in ml["limitations"]


def test_virustotal_success_has_provider_facts_but_not_ml_evidence():
    result = {
        "virustotal": {
            "status": "SAFE",
            "provider_status": "SUCCESS",
            "counts": {"malicious": 0, "suspicious": 0, "harmless": 70, "undetected": 20},
        },
        "evidence_card": {"decision": {"inputs": {"ml_strong_signals": ["IPV4_HOST"]}}},
    }

    contract = build_analysis_contract(result)
    vt = contract["virustotal_analysis"]

    assert "VT_NO_MALICIOUS_OR_SUSPICIOUS_VERDICT" in vt["reason_codes"]
    assert all(item["type"] == "PROVIDER_FACT" for item in vt["evidence"])
    assert contract["ml_analysis"]["evidence"] == [
        {"code": "IPV4_HOST", "type": "EXPLICIT_STRUCTURAL_SIGNAL"}
    ]


def test_gemini_fallback_is_explanation_metadata_not_security_evidence():
    result = {
        "classification": "UNKNOWN",
        "source": "INSUFFICIENT_EVIDENCE",
        "explanation": {
            "provider": "LOCAL_TIMEOUT_FALLBACK",
            "provider_status": "FALLBACK",
            "fallback_reason": "GEMINI_TIMEOUT",
            "input_truncated": True,
            "citations": [],
            "domain_verification": {"status": "NOT_REPORTED"},
        },
    }

    contract = build_analysis_contract(result)
    gemini = contract["gemini_analysis"]

    assert gemini["status"] == "FALLBACK"
    assert gemini["role"] == "SUPPORTING_EXPLANATION_NOT_DECISION_SOURCE"
    assert gemini["fallback_reason"] == "GEMINI_TIMEOUT"
    assert gemini["input_truncated"] is True
    assert "GEMINI_FALLBACK_GEMINI_TIMEOUT" in gemini["reason_codes"]
    assert gemini["evidence"] == []


def test_fusion_audit_maps_dangerous_rule_without_claiming_unobserved_rules():
    result = {
        "classification": "DANGEROUS",
        "source": "ML_PLUS_URL_SIGNALS",
        "ml_model": {"classification": "DANGEROUS", "source": "ML_MODEL"},
        "evidence_card": {
            "decision": {
                "code": "ML_HIGH_CONFIDENCE_STRUCTURAL",
                "policy_id": "NABEH_URL_FUSION",
                "policy_version": "1.1.0",
                "inputs": {"ml_strong_signals": ["PUNYCODE_HOST", "CREDENTIAL_TERM"]},
                "thresholds": {"ml_standalone_dangerous_min_probability": 0.98},
            }
        },
    }

    fusion = build_analysis_contract(result)["fusion_analysis"]

    assert fusion["audit_status"] == "EXACT_RULE_MAPPED"
    assert fusion["rules_applied"] == ["RULE_ML_HIGH_CONFIDENCE_PLUS_TWO_STRUCTURAL_SIGNALS"]
    assert fusion["rules_rejected"] == []
    assert fusion["decision_reasons"] == ["ML_HIGH_CONFIDENCE_STRUCTURAL"]
