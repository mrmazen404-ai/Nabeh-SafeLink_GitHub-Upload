"""Comprehensive Level 1 Algorithm & Detection Engine Test Suite for Nabeh SafeLink."""

import pytest
from app.ml.predictor import extract_features, predict_url
from app.scans.service import ScanService


class TestPredictorAndFeatures:
    def test_domains_are_not_short_circuited_by_static_whitelist(self):
        for url in (
            "https://www.google.com",
            "https://alrajhibank.com.sa/online",
            "https://moe.gov.sa/ar/pages/default.aspx",
        ):
            res = predict_url(url)
            assert res["source"] != "VERIFIED_SAFE_DOMAIN"
            assert res["source"] in {"ML_MODEL", "MODEL_UNAVAILABLE", "MODEL_ERROR"}
    def test_invalid_urls_return_unknown(self):
        invalid_inputs = [
            "",
            "   ",
            "not a url at all",
            "javascript:alert('xss')",
            "ftp://fileserver.local/test",
            "http://example .com/spaces",
        ]
        for val in invalid_inputs:
            res = predict_url(val)
            assert res["classification"] == "UNKNOWN"
            assert res["source"] in {"EMPTY_INPUT", "INVALID_URL"}

    def test_extract_features_structure_and_types(self):
        sample_url = "http://paypal-bank-secure.verify-account.com:8080/path/login.php?user=admin&token=123#ref"
        features = extract_features(sample_url)
        assert isinstance(features, dict)
        assert len(features) == 42
        assert features["url_length"] == len(sample_url)
        assert features["has_port"] == 1
        assert features["nonstandard_port"] == 1
        assert features["brand_impersonation"] == 1
        assert isinstance(features["host_entropy"], float)
        assert features["host_entropy"] > 0.0

    def test_ipv4_and_brand_impersonation_detection(self):
        ip_url = "http://192.168.1.1/login"
        features = extract_features(ip_url)
        assert features["has_ip_host"] == 1

        brand_url = "http://secure-paypal-update.online/signin"
        features_brand = extract_features(brand_url)
        assert features_brand["brand_impersonation"] == 1


class TestTextAndSmishingNLP:
    def test_extract_url_from_text(self):
        text_with_url = "عزيزي العميل، تم إيقاف حسابك الراجحي. يرجى التحديث عبر: https://alrajhi-verify.com/login"
        extracted = ScanService.extract_url_from_text(text_with_url)
        assert extracted == "https://alrajhi-verify.com/login"

        text_without_url = "عزيزي العميل، تواصل مع خدمة العملاء فوراً"
        assert ScanService.extract_url_from_text(text_without_url) == ""

    def test_analyze_text_phishing_keywords(self):
        phishing_text = "مبروك الفوز بالجائزة، تم تجميد حسابك البنك وتحديث كلمة المرور"
        analysis = ScanService.analyze_text_phishing(phishing_text, has_embedded_url=True)
        assert analysis["classification"] == "SUSPICIOUS"
        assert analysis["match_count"] >= 3

        suspicious_text = "عزيزي العميل يرجى تحديث بياناتك"
        analysis_susp = ScanService.analyze_text_phishing(suspicious_text, has_embedded_url=False)
        assert analysis_susp["classification"] == "UNKNOWN"

        clean_text = "السلام عليكم ورحمة الله وبركاته، متى موعد الإجتماع؟"
        analysis_clean = ScanService.analyze_text_phishing(clean_text, has_embedded_url=False)
        assert analysis_clean["classification"] == "UNKNOWN"

    def test_merge_text_signal_elevates_verdict(self):
        combined = {"classification": "SAFE", "confidence": 0.9, "weighted_score": 0.1}
        text_result = {"classification": "DANGEROUS", "confidence": 0.85}
        merged = ScanService._merge_text_signal(combined, text_result)
        assert merged["classification"] == "DANGEROUS"
        assert "LOCAL_TEXT_RULES" in merged["source"]


class TestVerdictFusionRules:
    def test_virustotal_consensus_tier1a(self):
        vt = {"status": "DANGEROUS", "malicious": 6, "total_engines": 92}
        ml = {"classification": "SAFE", "phishing_prob": 0.1}
        res = ScanService.combine_scan_results(vt, ml)
        assert res["classification"] == "DANGEROUS"
        assert "VIRUSTOTAL_CONSENSUS" in res["source"]

    def test_vt_and_ml_corroboration_tier1b(self):
        vt = {"status": "SUSPICIOUS", "malicious": 1, "total_engines": 92}
        ml = {"classification": "DANGEROUS", "phishing_prob": 0.88, "source": "ML_MODEL"}
        res = ScanService.combine_scan_results(vt, ml)
        assert res["classification"] == "DANGEROUS"
        assert "DANGEROUS_CORROBORATED" in res["source"]

    def test_ml_alone_never_dangerous_tier2b(self):
        vt = {"status": "UNKNOWN", "total_engines": 0}
        ml = {"classification": "DANGEROUS", "phishing_prob": 0.95, "source": "ML_MODEL"}
        res = ScanService.combine_scan_results(vt, ml)
        assert res["classification"] == "SUSPICIOUS"
        assert res["source"] == "ML_SIGNAL_ONLY"

    def test_both_safe_tier3a(self):
        vt = {"status": "SAFE", "confidence": 0.90, "malicious": 0, "harmless": 80, "total_engines": 90}
        ml = {"classification": "SAFE", "phishing_prob": 0.05, "source": "ML_MODEL"}
        res = ScanService.combine_scan_results(vt, ml)
        assert res["classification"] == "SAFE"
        assert res["source"] == "HYBRID_CONSENSUS_SAFE"

    def test_no_evidence_returns_unknown_tier5(self):
        vt = {"status": "UNKNOWN", "total_engines": 0}
        ml = {"classification": "UNKNOWN", "source": "MODEL_UNAVAILABLE"}
        res = ScanService.combine_scan_results(vt, ml)
        assert res["classification"] == "UNKNOWN"
        assert res["confidence"] is None
        assert res["source"] == "INSUFFICIENT_EVIDENCE"
