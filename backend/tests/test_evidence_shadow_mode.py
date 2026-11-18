"""Offline shadow-mode checks for the internal evidence contract.

The shadow projection runs beside representative existing scan results. It is
intentionally not connected to a public route or provider call.
"""

from copy import deepcopy

from app.scans.response_contract import build_analysis_contract
from app.scans.service import ScanService


def _url_result(classification="SUSPICIOUS"):
    vt = {
        "status": "SUSPICIOUS",
        "provider_status": "SUCCESS",
        "malicious": 0,
        "suspicious": 2,
        "harmless": 8,
        "undetected": 5,
        "total_engines": 15,
    }
    ml = {
        "classification": "SAFE",
        "phishing_prob": 0.10,
        "source": "ML_MODEL",
        "strong_signals": [],
    }
    combined = ScanService.combine_scan_results(vt, ml)
    assert combined["classification"] == classification
    return {
        **combined,
        "ml_model": ml,
        "virustotal": vt,
        "stages": {
            "stage1_ml": ml,
            "stage2_virustotal": vt,
        },
        "evidence_card": {
            "decision": {
                "classification": combined["classification"],
                "code": combined["decision_code"],
                "policy_id": "NABEH_URL_FUSION",
                "policy_version": "1.1.0",
                "inputs": {"ml_strong_signals": []},
                "thresholds": {},
            },
            "url_observations": {"items": [{"code": "URL_LENGTH", "value": 28}]},
        },
    }


def test_shadow_projection_preserves_url_decision_and_input():
    result = _url_result()
    before = deepcopy(result)

    shadow = build_analysis_contract(result)

    assert shadow["final_decision"]["classification"] == result["classification"]
    assert shadow["fusion_analysis"]["decision_code"] == result["decision_code"]
    assert shadow["virustotal_analysis"]["provider_status"] == "SUCCESS"
    assert shadow["ml_analysis"]["source"] == "ML_MODEL"
    assert result == before


def test_shadow_projection_preserves_sms_unknown_coverage_and_provider_separation():
    result = {
        "scan_kind": "SMS_TEXT",
        "classification": "UNKNOWN",
        "source": "LOCAL_TIMEOUT_FALLBACK",
        "analysis_coverage": "PARTIAL",
        "coverage_reasons": ["MESSAGE_TRUNCATED_FOR_GEMINI"],
        "links_scanned_count": 1,
        "links_not_scanned_count": 1,
        "ml_model": {"classification": "UNKNOWN", "source": "MODEL_UNAVAILABLE"},
        "virustotal": {"status": "UNKNOWN", "provider_status": "ANALYSIS_STALE"},
        "explanation": {
            "provider": "LOCAL_TIMEOUT_FALLBACK",
            "provider_status": "FALLBACK",
            "fallback_reason": "GEMINI_TIMEOUT",
            "citations": [],
        },
        "evidence_card": {
            "decision": {"code": "INSUFFICIENT_EVIDENCE", "inputs": {}},
        },
    }
    before = deepcopy(result)

    shadow = build_analysis_contract(result)

    assert shadow["final_decision"]["classification"] == "UNKNOWN"
    assert shadow["unknown_analysis"]["is_unknown"] is True
    assert "ML_MODEL_UNAVAILABLE" in shadow["unknown_analysis"]["reason_codes"]
    assert "VT_ANALYSIS_STALE" in shadow["unknown_analysis"]["reason_codes"]
    assert shadow["gemini_analysis"]["role"] == "SUPPORTING_EXPLANATION_NOT_DECISION_SOURCE"
    assert shadow["coverage"]["status"] == "PARTIAL"
    assert result == before
