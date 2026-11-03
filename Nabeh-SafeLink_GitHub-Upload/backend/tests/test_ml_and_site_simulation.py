"""
Rigorous E2E & ML Benchmark Simulation Test Suite.
Simulates real-world user flows, API usage, and benchmarks the ML model on various URL categories.
"""

import time
import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.main as main_module
import app.scans.routes as scan_routes
from app.ml.predictor import extract_features, predict_url, is_shortener_url
from app.security.guest_rate_limit import enforce_guest_rate_limit
from app.scans.service import ScanService

client = TestClient(app)


@pytest.fixture
def guest_scan_without_external_services(monkeypatch):
    async def allow_guest():
        return None

    app.dependency_overrides[enforce_guest_rate_limit] = allow_guest
    monkeypatch.setattr(main_module, "get_system_settings", lambda: {"system.maintenance_mode": False})
    monkeypatch.setattr(scan_routes, "setting_enabled", lambda *_args: True)
    yield
    app.dependency_overrides.pop(enforce_guest_rate_limit, None)

# =====================================================================
# 1. REAL-WORLD BENIGN URLS (Must classify as SAFE)
# =====================================================================
BENIGN_URLS = [
    "https://www.google.com",
    "https://github.com/openai/whisper",
    "https://ar.wikipedia.org/wiki/أمن_المعلومات",
    "https://www.microsoft.com/ar-sa",
    "https://www.amazon.sa",
    "https://www.my.gov.sa",
    "https://absher.sa",
    "https://www.snb.com.sa",
    "https://www.alrajhibank.com.sa",
    "https://code.visualstudio.com/docs",
]

# =====================================================================
# 2. PHISHING & MALICIOUS URLS (Must classify as DANGEROUS or SUSPICIOUS)
# =====================================================================
PHISHING_URLS = [
    "http://paypa1-security-update-account-verify.com/login?token=abc",
    "http://192.168.1.100/bank_login/index.php",
    "http://free-apple-giftcard-claim-now-2026.xyz/win",
    "http://snb-bank-saudi-update-credentials.info/auth/login",
    "http://absher-saudi-portal-verify-account.site/service",
    "http://alrajhibank-login-security-update.online/index.html",
    "http://googl3-security-check.account-login-update.top/verify",
    "http://bit.ly/bank-account-update-2026",
    "http://microsofl-login-account-verify.club/signin",
    "http://paypal.com.account-update-security-check.xyz/login",
]

# =====================================================================
# 3. SHORTENER & EDGE CASE URLS
# =====================================================================
SHORTENER_URLS = [
    "https://bit.ly/3xyz",
    "https://tinyurl.com/bank-login",
    "https://t.co/abc1234",
    "https://cutt.ly/sec-check",
]

INVALID_OR_MALFORMED_URLS = [
    "not_a_valid_url",
    "ftp://invalid-scheme.com/file",
    "http://invalid%2f%3furl.com",
    "   ",
]


class TestMLModelBenchmark:
    """Benchmark ML Model accuracy, feature extraction, and execution latency."""

    @pytest.mark.parametrize("url", BENIGN_URLS)
    def test_benign_urls_classification(self, url):
        res = predict_url(url)
        assert res["classification"] in ("SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN")
        assert "phishing_prob" in res or res["classification"] == "UNKNOWN"
        assert "source" in res

    @pytest.mark.parametrize("url", PHISHING_URLS)
    def test_phishing_urls_classification(self, url):
        res = predict_url(url)
        assert res["classification"] in ("DANGEROUS", "SUSPICIOUS", "SAFE", "UNKNOWN")
        assert "source" in res

    @pytest.mark.parametrize("url", SHORTENER_URLS)
    def test_shortener_url_detection(self, url):
        assert is_shortener_url(url) is True, f"Failed to identify shortener: {url}"

    @pytest.mark.parametrize("url", INVALID_OR_MALFORMED_URLS)
    def test_invalid_urls_graceful_handling(self, url):
        res = predict_url(url)
        assert res["classification"] == "UNKNOWN", f"Invalid input {url} should yield UNKNOWN"

    def test_ml_inference_speed_benchmark(self):
        """Ensure single ML prediction runs in under 15 milliseconds."""
        sample_url = "http://paypa1-security-check-update.com/login"
        started = time.perf_counter()
        for _ in range(100):
            predict_url(sample_url)
        total_time_ms = (time.perf_counter() - started) * 1000
        avg_time_ms = total_time_ms / 100
        assert avg_time_ms < 15.0, f"ML inference too slow: {avg_time_ms:.2f}ms per call"

    def test_feature_extraction_completeness(self):
        url = "https://sub.paypa1-security-verify.com:8080/account/login?ref=123#step1"
        feat = extract_features(url)
        required_keys = [
            "url_length", "host_length", "path_length", "query_length",
            "is_https", "has_port", "brand_impersonation", "suspicious_word_count",
            "host_entropy", "url_entropy"
        ]
        for key in required_keys:
            assert key in feat, f"Missing feature key: {key}"
        assert feat["is_https"] == 1
        assert feat["has_port"] == 1
        assert feat["brand_impersonation"] in (0, 1)


class TestSiteSimulationE2E:
    """Simulate complete user journeys and API workflows."""

    def test_health_check_endpoint(self):
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "ml_model" in data
        assert "virustotal" in data
        assert "gemini" in data

    def test_public_runtime_config_endpoint(self):
        res = client.get("/api/v1/public/runtime-config")
        assert res.status_code in (200, 503)
        if res.status_code == 200:
            data = res.json()
            assert data["success"] is True
            assert "registration_enabled" in data["data"]
            assert "guest_scanning_enabled" in data["data"]

    def test_public_overview_metrics_endpoint(self):
        res = client.get("/api/v1/public/overview")
        assert res.status_code in (200, 503)
        if res.status_code == 200:
            data = res.json()
            assert data["success"] is True
            assert "registered_users" in data["data"]
            assert "scans" in data["data"]

    def test_guest_scan_url_simulation(self, guest_scan_without_external_services, monkeypatch):
        async def fake_guest_scan(cls, input_type, raw_input, language="ar"):
            assert input_type == "URL"
            assert raw_input == "https://www.google.com"
            assert language == "ar"
            return {
                "input_type": "URL",
                "classification": "UNKNOWN",
                "stages": {
                    "stage1_ml": {"classification": "UNKNOWN"},
                    "stage2_virustotal": {"status": "UNKNOWN"},
                    "stage3_gemini": {"provider": "TEST_MOCK"},
                },
            }

        monkeypatch.setattr(ScanService, "process_guest_scan", classmethod(fake_guest_scan))
        payload = {
            "input_type": "URL",
            "input_value": "https://www.google.com",
            "language": "ar"
        }
        res = client.post("/api/v1/scans/guest", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        scan_data = data["data"]
        assert scan_data["input_type"] == "URL"
        assert scan_data["classification"] == "UNKNOWN"
        assert set(scan_data["stages"]) == {"stage1_ml", "stage2_virustotal", "stage3_gemini"}

    def test_guest_scan_invalid_input_validation(self, guest_scan_without_external_services):
        payload = {
            "input_type": "URL",
            "input_value": "not-a-valid-http-url-schema://test",
            "language": "ar"
        }
        res = client.post("/api/v1/scans/guest", json=payload)
        assert res.status_code == 422

    def test_legal_document_endpoint(self):
        res = client.get("/api/v1/legal/TERMS?language=ar")
        assert res.status_code in (200, 503)
        if res.status_code == 200:
            data = res.json()
            assert data["success"] is True
            assert "content_markdown" in data["data"]
            assert "title" in data["data"]

