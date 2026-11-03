import asyncio
import json

import pytest

from app.scans import service as scan_service
from app.scans.service import ScanService, _build_url_evidence_card, _build_url_observations
from app.virustotal.client import _parse_response


def test_url_observations_are_measured_and_not_model_attributions():
    observations = _build_url_observations("https://example.com/login?next=paypal")
    values = {item["code"]: item["value"] for item in observations}

    assert values["URL_SCHEME"] == "https"
    assert values["SUSPICIOUS_TERMS"] == ["login"]
    assert values["BRAND_TERMS_IN_PATH_QUERY"] == ["paypal"]
    assert values["QUERY_PARAMETER_COUNT"] == 1


def test_virustotal_parser_preserves_bounded_engine_evidence_and_timeouts():
    result = _parse_response({
        "data": {
            "attributes": {
                "last_analysis_date": 1793750400,
                "last_analysis_stats": {
                    "malicious": 1,
                    "suspicious": 2,
                    "harmless": 4,
                    "undetected": 5,
                    "timeout": 3,
                    "type-unsupported": 1,
                },
                "last_analysis_results": {
                    "Engine A": {
                        "engine_name": "Engine A",
                        "method": "blacklist",
                        "category": "malicious",
                        "result": "Phishing URL",
                    }
                },
            }
        }
    })

    assert result["status"] == "SUSPICIOUS"
    assert result["total_engines"] == 16
    assert result["timeout"] == 3
    assert result["analysis_data_available"] is True
    assert result["last_analysis_date"] == 1793750400
    assert result["scanner_results"] == [{
        "engine_name": "Engine A",
        "method": "blacklist",
        "category": "malicious",
        "result": "Phishing URL",
    }]


def test_virustotal_engine_details_are_bounded_and_truncation_is_reported():
    engines = {
        f"Engine {index}": {"category": "undetected", "result": ""}
        for index in range(101)
    }
    result = _parse_response({
        "data": {
            "attributes": {
                "last_analysis_stats": {"undetected": 101},
                "last_analysis_results": engines,
            }
        }
    })

    assert len(result["scanner_results"]) == 100
    assert result["scanner_results_total"] == 101
    assert result["scanner_results_truncated"] is True


def test_virustotal_missing_analysis_does_not_become_zero_detection_evidence():
    responses = [
        {"data": {"attributes": {}}},
        {"data": {"attributes": {"last_analysis_stats": {"malicious": 0, "suspicious": 0, "harmless": 0, "undetected": 0}}}},
    ]
    parsed = [_parse_response(response) for response in responses]
    assert all(result["status"] == "UNKNOWN" for result in parsed)
    assert all(result["analysis_data_available"] is False for result in parsed)

    card = _build_url_evidence_card(
        "https://example.com",
        {"classification": "UNKNOWN", "decision_code": "INSUFFICIENT_EVIDENCE"},
        {"classification": "UNKNOWN", "source": "MODEL_UNAVAILABLE"},
        parsed[1],
        {"provider": "LOCAL_RULES"},
    )
    assert card["sources"]["virustotal"]["counts"] == {}
    assert card["sources"]["virustotal"]["scanner_results"] == []


def test_evidence_card_uses_same_fusion_rule_and_withholds_model_probability():
    vt = {
        "status": "DANGEROUS",
        "provider_status": "SUCCESS",
        "malicious": 3,
        "suspicious": 1,
        "harmless": 5,
        "undetected": 2,
        "timeout": 0,
        "total_engines": 11,
        "analysis_data_available": True,
        "scanner_results": [{
            "engine_name": "Engine A",
            "method": "blacklist",
            "category": "malicious",
            "result": "Phishing",
        }],
    }
    ml = {"classification": "SAFE", "phishing_prob": 0.1, "source": "ML_MODEL"}
    combined = ScanService.combine_scan_results(vt, ml)
    card = _build_url_evidence_card(
        "https://example.com/login",
        combined,
        ml,
        vt,
        {"provider": "LOCAL_RULES"},
    )

    assert card["decision"]["classification"] == "DANGEROUS"
    assert card["decision"]["code"] == "VT_STRONG_CONSENSUS"
    assert card["decision"]["inputs"]["virustotal_counts"]["malicious"] == 3
    assert card["sources"]["virustotal"]["scanner_results"][0]["result"] == "Phishing"
    assert card["sources"]["ml_model"]["feature_attribution"] == "NOT_AVAILABLE"
    assert card["decision"]["thresholds"]["dangerous_min_malicious_engines"] == 3
    assert card["decision"]["thresholds"]["suspicious_min_vt_suspicious_engines"] == 2
    assert "phishing_prob" not in str(card)
    assert "0.1" not in str(card)
    assert json.loads(json.dumps(card))["schema_version"] == "1.0"


@pytest.mark.parametrize(
    ("vt", "ml", "expected"),
    [
        ({"status": "DANGEROUS", "malicious": 3, "total_engines": 20}, {"classification": "SAFE", "phishing_prob": 0.1}, "VT_STRONG_CONSENSUS"),
        ({"status": "SUSPICIOUS", "malicious": 1, "total_engines": 20}, {"classification": "DANGEROUS", "phishing_prob": 0.9}, "VT_ML_CORROBORATION"),
        ({"status": "SUSPICIOUS", "malicious": 0, "suspicious": 2, "total_engines": 20}, {"classification": "SAFE", "phishing_prob": 0.1}, "VT_SIGNAL"),
        ({"status": "UNKNOWN", "total_engines": 0}, {"classification": "DANGEROUS", "phishing_prob": 0.7}, "ML_STRONG_SIGNAL_ONLY"),
        ({"status": "UNKNOWN", "total_engines": 0}, {"classification": "SUSPICIOUS", "phishing_prob": 0.5}, "ML_SUSPICIOUS_SIGNAL"),
        ({"status": "SAFE", "harmless": 70, "total_engines": 92}, {"classification": "SAFE", "phishing_prob": 0.1}, "SAFE_SOURCE_CONSENSUS"),
        ({"status": "SUSPICIOUS", "suspicious": 1, "total_engines": 1}, {"classification": "SAFE", "phishing_prob": 0.99}, "HYBRID_WEIGHTED_SUSPICIOUS"),
        ({"status": "SUSPICIOUS", "suspicious": 1, "total_engines": 100}, {"classification": "SAFE", "phishing_prob": 0.1}, "HYBRID_WEIGHTED_INCONCLUSIVE"),
        ({"status": "UNKNOWN", "total_engines": 0}, {"classification": "UNKNOWN", "source": "MODEL_UNAVAILABLE"}, "INSUFFICIENT_EVIDENCE"),
    ],
)
def test_every_final_verdict_contains_the_exact_applied_rule(vt, ml, expected):
    assert ScanService.combine_scan_results(vt, ml)["decision_code"] == expected


def test_process_url_scan_returns_real_evidence_card(monkeypatch):
    async def fake_vt(_url):
        return {
            "status": "SUSPICIOUS",
            "provider_status": "SUCCESS",
            "malicious": 0,
            "suspicious": 2,
            "harmless": 3,
            "undetected": 5,
            "timeout": 0,
            "total_engines": 10,
            "analysis_data_available": True,
            "scanner_results": [{"engine_name": "Engine A", "category": "suspicious", "method": "blacklist", "result": "Suspicious URL"}],
        }

    monkeypatch.setattr(scan_service, "predict_url", lambda _url: {"classification": "SAFE", "source": "ML_MODEL", "phishing_prob": 0.1})
    monkeypatch.setattr(scan_service, "check_url_virustotal", fake_vt)
    monkeypatch.setattr(scan_service, "setting_enabled_fail_closed", lambda _key: False)

    result = asyncio.run(ScanService.process_url_scan("https://example.com/login"))

    assert result["classification"] == "SUSPICIOUS"
    assert result["evidence_card"]["decision"]["code"] == "VT_SIGNAL"
    assert result["evidence_card"]["sources"]["virustotal"]["scanner_results"][0]["engine_name"] == "Engine A"
    assert result["evidence_card"]["url_observations"]["status"] == "AVAILABLE"


def test_virustotal_not_configured_status_is_explicit(monkeypatch):
    from app.virustotal import client

    monkeypatch.setattr(client, "_get_api_key", lambda: "")
    result = asyncio.run(client.check_url_virustotal("https://example.com"))

    assert result["status"] == "UNKNOWN"
    assert result["provider_status"] == "NOT_CONFIGURED"
    assert result["error"] == "VIRUSTOTAL_API_KEY not set"
