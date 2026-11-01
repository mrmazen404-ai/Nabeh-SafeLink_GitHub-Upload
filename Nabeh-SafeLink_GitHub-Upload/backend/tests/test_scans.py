"""Unit tests for Nabeh SafeLink URL predictor, VirusTotal polling, and ScanService."""

import pytest
from app.ml.predictor import extract_features, predict_url, is_shortener_url
from app.scans.service import ScanService
from app.virustotal.client import _parse_response as parse_vt_response


def test_url_feature_extraction():
    url = "https://paypa1-secure-login.com/account/verify?token=123"
    features = extract_features(url)
    assert features["url_length"] > 0
    assert features["is_https"] == 1
    assert "host_entropy" in features
    assert "url_entropy" in features
    assert features["brand_impersonation"] in (0, 1)


def test_shortener_detection():
    assert is_shortener_url("https://bit.ly/3xyz") is True
    assert is_shortener_url("https://tinyurl.com/abc") is True
    assert is_shortener_url("https://www.google.com") is False


def test_predict_url_inference():
    res = predict_url("http://paypa1-secure-account-verification-login.com/update")
    assert res["classification"] in ("SUSPICIOUS", "DANGEROUS")

    invalid_res = predict_url("not_a_valid_url")
    assert invalid_res["classification"] == "UNKNOWN"


def test_virustotal_response_parser():
    data = {
        "data": {
            "attributes": {
                "last_analysis_stats": {
                    "malicious": 5,
                    "suspicious": 2,
                    "harmless": 80,
                    "undetected": 5,
                }
            }
        }
    }
    parsed = parse_vt_response(data)
    assert parsed["status"] == "DANGEROUS"
    assert parsed["malicious"] == 5
    assert parsed["suspicious"] == 2
    assert parsed["total_engines"] == 92


def test_combine_scan_results_decision_matrix():
    # Tier 1a: VT Strong Consensus (3+ malicious engines) -> DANGEROUS
    res1a = ScanService.combine_scan_results(
        vt_result={"malicious": 4, "suspicious": 1, "status": "DANGEROUS", "total_engines": 90},
        ml_result={"classification": "SUSPICIOUS", "phishing_prob": 0.50},
    )
    assert res1a["classification"] == "DANGEROUS"

    # Tier 2b: ML strong signal alone -> Maximum SUSPICIOUS
    res2b = ScanService.combine_scan_results(
        vt_result={"malicious": 0, "status": "UNKNOWN", "total_engines": 0},
        ml_result={"classification": "DANGEROUS", "phishing_prob": 0.85},
    )
    assert res2b["classification"] == "SUSPICIOUS"
    assert res2b["source"] == "ML_SIGNAL_ONLY"


def test_local_text_phishing_analyzer():
    safe_text = "السلام عليكم كيف حالك يا أخي متى الموعد؟"
    res_safe = ScanService.analyze_text_phishing(safe_text, has_embedded_url=False)
    assert res_safe["classification"] == "UNKNOWN"

    phish_text = "عزيزي العميل تم تجميد حسابك البنك الأهلي يرجى تحديث كلمة المرور فورا عبر الرابط"
    res_phish = ScanService.analyze_text_phishing(phish_text, has_embedded_url=True)
    assert res_phish["classification"] == "SUSPICIOUS"
