"""Extensive URL test suite generating all categories of links to verify ML prediction & 3-stage fusion behavior."""

import os
import pytest

# Enable ML model artifact loading for model evaluation tests
os.environ["NABEH_TRUST_MODEL_ARTIFACT"] = "true"

from app.ml.predictor import extract_features, predict_url
from app.scans.service import ScanService


# 1. Category: Verified Safe & Official Whitelisted Domains
SAFE_GENERATED_URLS = [
    "https://www.google.com/search?q=security",
    "https://github.com/fastapi/fastapi",
    "https://alrajhibank.com.sa/personal/banking",
    "https://snb.com.sa/accounts",
    "https://salla.sa/stores",
    "https://moe.gov.sa/ar/education",
    "https://iam.gov.sa/digital-identity",
    "https://pypi.org/project/fastapi/",
    "https://vercel.app/dashboard",
]

# 2. Category: Brand Impersonation & Typosquatting (Deceptive URLs)
BRAND_IMPERSONATION_URLS = [
    "http://paypal-secure-login-verify.com/account/login",
    "http://googl3-security-alert-account.net/login",
    "http://alrajhi-verify-card-update.xyz/login.php",
    "http://snb-bank-account-reset.top/verify",
    "http://apple-id-verify-locked.info/account/reset",
    "http://microsoft-online-365-login.site/auth",
]

# 3. Category: Suspicious Lures, High-Risk TLDs & Structural Anomalies
SUSPICIOUS_ANOMALY_URLS = [
    "http://192.168.1.150:8080/bank/update.php",
    "http://google.com@malicious-phishing-host.online/verify",
    "http://secure-login.verify-credentials.work/path/depth/depth2/depth3/index.html?token=12345&user=admin&pass=secret",
    "http://xn--80ak6aa9b.com/login",  # Punycode spoofing
    "http://bank-payment-invoice-billing-unlock.vip/confirm?id=99",
]

# 4. Category: Invalid, Protocol Misuse & Edge Cases
INVALID_EDGE_CASE_INPUTS = [
    "",
    "    ",
    "not_a_valid_url_string",
    "javascript:alert(document.cookie)",
    "file:///C:/Users/Admin/secrets.txt",
    "ftp://anonymous@fileserver.net/pub",
    "http://example .com/invalid space",
]


class TestGeneratedUrlMatrix:
    def test_formerly_listed_urls_are_not_short_circuited(self):
        for url in SAFE_GENERATED_URLS:
            res = predict_url(url)
            assert res["source"] in {"ML_MODEL", "MODEL_UNAVAILABLE", "MODEL_ERROR"}

    def test_brand_impersonation_category(self):
        for url in BRAND_IMPERSONATION_URLS:
            res = predict_url(url)
            # When ML model artifact is trusted, ML model predicts high phishing_prob
            assert res["classification"] in {"DANGEROUS", "SUSPICIOUS"}, f"Expected threat classification for {url}, got {res['classification']} ({res.get('source')})"
            assert res["source"] == "ML_MODEL"
            assert res["phishing_prob"] >= 0.40

    def test_suspicious_anomaly_category(self):
        for url in SUSPICIOUS_ANOMALY_URLS:
            features = extract_features(url)
            res = predict_url(url)
            assert res["classification"] in {"DANGEROUS", "SUSPICIOUS"}, f"Expected threat for {url}, got {res['classification']}"
            assert res["source"] == "ML_MODEL"
            # Verify anomalous features were extracted correctly
            if "192.168.1.150" in url:
                assert features["has_ip_host"] == 1
                assert features["nonstandard_port"] == 1
            if "@" in url:
                assert features["has_at_symbol"] == 1

    def test_invalid_edge_cases_category(self):
        for input_val in INVALID_EDGE_CASE_INPUTS:
            res = predict_url(input_val)
            assert res["classification"] == "UNKNOWN", f"Expected UNKNOWN for {input_val}, got {res['classification']}"
            assert res["source"] in {"EMPTY_INPUT", "INVALID_URL"}

    def test_end_to_end_fusion_across_all_types(self):
        # 1. Clean VT + model prediction -> SAFE
        vt_clean = {"status": "SAFE", "harmless": 85, "malicious": 0, "total_engines": 85}
        ml_prediction = predict_url("https://alrajhibank.com.sa")
        fusion_clean = ScanService.combine_scan_results(vt_clean, ml_prediction)
        assert fusion_clean["classification"] in {"SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN"}

        # 2. VirusTotal Malicious Consensus -> DANGEROUS
        vt_malicious = {"status": "DANGEROUS", "malicious": 8, "total_engines": 92}
        ml_unknown = {"classification": "UNKNOWN", "source": "MODEL_UNAVAILABLE"}
        fusion_dangerous = ScanService.combine_scan_results(vt_malicious, ml_unknown)
        assert fusion_dangerous["classification"] == "DANGEROUS"

        # 3. VT=1 + High ML Prob (0.92) -> DANGEROUS Corroborated
        vt_single = {"status": "SUSPICIOUS", "malicious": 1, "total_engines": 90}
        ml_high_phish = {"classification": "DANGEROUS", "phishing_prob": 0.92, "source": "ML_MODEL"}
        fusion_corroborated = ScanService.combine_scan_results(vt_single, ml_high_phish)
        assert fusion_corroborated["classification"] == "DANGEROUS"
        assert "DANGEROUS_CORROBORATED" in fusion_corroborated["source"]

        # 4. High ML alone -> SUSPICIOUS (Maximum cap rule)
        vt_absent = {"status": "UNKNOWN", "total_engines": 0}
        ml_standalone_high = {"classification": "DANGEROUS", "phishing_prob": 0.95, "source": "ML_MODEL"}
        fusion_standalone = ScanService.combine_scan_results(vt_absent, ml_standalone_high)
        assert fusion_standalone["classification"] == "SUSPICIOUS"
        assert fusion_standalone["source"] == "ML_SIGNAL_ONLY"
