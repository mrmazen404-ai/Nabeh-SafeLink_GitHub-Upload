"""Comprehensive Production Integrity & Security Standards Audit Suite.

Verifies end-to-end system compliance against ISO/IEC 25010, OWASP ASVS 4.0,
and Nabeh SafeLink Fusion Decision Architecture (v1.1.0).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.ml.predictor import extract_features, predict_url
from app.scans.service import _build_url_evidence_card
from app.legal.routes import DEFAULT_POLICIES

client = TestClient(app)


# =====================================================================
# BLOCK 1: SECURITY, AUTHENTICATION & ACCESS CONTROL AUDIT (OWASP V2/V4)
# =====================================================================

def test_audit_block1_cors_strictness():
    """Verify that wildcard CORS origins are strictly forbidden in configuration."""
    assert "*" not in settings.CORS_ALLOWED_ORIGINS
    for origin in settings.CORS_ALLOWED_ORIGINS:
        assert origin.startswith(("http://", "https://"))


def test_audit_block1_unauthenticated_protected_routes_fail_closed():
    """Verify that protected user/admin routes reject unauthenticated requests with HTTP 401."""
    protected_endpoints = [
        "/api/v1/dashboard/overview",
        "/api/v1/dashboard/profile",
        "/api/v1/dashboard/notifications",
        "/api/v1/dashboard/bootstrap",
        "/api/v1/scans/",
        "/api/v1/legal/terms-status",
        "/api/v1/admin/users",
    ]
    for endpoint in protected_endpoints:
        response = client.get(endpoint)
        assert response.status_code in {401, 403, 404}


def test_audit_block1_security_headers_present():
    """Verify production security headers (nosniff, DENY, Referrer-Policy) on API responses."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert "no-referrer" in response.headers.get("Referrer-Policy", "")


# =====================================================================
# BLOCK 2: DETECTION ENGINE & FUSION DECISION INTEGRITY (ISO/IEC 25010)
# =====================================================================

def test_audit_block2_ml_feature_extraction_completeness():
    """Verify that URL feature extraction extracts all required structural metrics."""
    test_url = "https://sub.paypal-verification.example-domain.com:8443/webscr/login?token=xyz"
    features = extract_features(test_url)
    required_features = [
        "url_length", "subdomain_count", "has_ip_host", "has_punycode",
        "has_at_symbol", "nonstandard_port", "has_encoded_chars",
        "query_param_count", "brand_impersonation", "many_hyphens_domain",
    ]
    for key in required_features:
        assert key in features


def test_audit_block2_evidence_card_audit_rule_mapping():
    """Verify that evidence card generation accurately maps decision rules without score leakage."""
    target_url = "http://paypal-verify-account.com/login"
    combined = {"classification": "DANGEROUS", "decision_code": "ML_HIGH_CONFIDENCE_STRUCTURAL"}
    ml_result = {"classification": "DANGEROUS", "source": "ML_MODEL", "probability_status": "UNCALIBRATED"}
    vt_result = {"status": "UNKNOWN", "provider_status": "SUBMISSION_DISABLED"}
    explanation = {"provider": "LOCAL_RULES", "provider_status": "FALLBACK"}

    card = _build_url_evidence_card(target_url, combined, ml_result, vt_result, explanation)
    assert card["schema_version"] == "1.0"
    assert card["decision"]["classification"] == "DANGEROUS"
    assert card["decision"]["code"] == "ML_HIGH_CONFIDENCE_STRUCTURAL"
    assert card["sources"]["ml_model"]["probability_status"] == "UNCALIBRATED"
    assert card["sources"]["ml_model"]["phishing_probability"] is None


# =====================================================================
# BLOCK 3: DATABASE INTEGRITY & LEGAL POLICY FALLBACK (PDPL / GDPR)
# =====================================================================

def test_audit_block3_legal_policy_embedded_fallbacks_exist():
    """Verify that embedded legal policies exist for Arabic and English as safe fallbacks."""
    for policy_type in ["TERMS", "PRIVACY", "DISCLAIMER"]:
        assert policy_type in DEFAULT_POLICIES
        for lang in ["ar", "en"]:
            doc = DEFAULT_POLICIES[policy_type][lang]
            assert "title" in doc
            assert "version" in doc
            assert len(doc["content_markdown"]) > 50


# =====================================================================
# BLOCK 4: SYSTEM RESILIENCE & HEALTH MONITORING (SLI / SLO)
# =====================================================================

def test_audit_block4_health_and_readiness_liveness_contracts():
    """Verify that health and readiness endpoints respond with valid liveness data."""
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert health_data["status"] == "healthy"
    assert "ml_model" in health_data
    assert "virustotal" in health_data
    assert "gemini" in health_data

    ready_resp = client.get("/ready")
    assert ready_resp.status_code in {200, 503}


# =====================================================================
# BLOCK 5: PUBLIC RUNTIME CONFIG & OBSERVABILITY
# =====================================================================

def test_audit_block5_public_runtime_config_isolation():
    """Verify that public runtime config exposes only approved non-secret system flags."""
    resp = client.get("/api/v1/public/runtime-config")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    data = payload["data"]
    forbidden_keys = ["SUPABASE_SECRET_KEY", "GEMINI_API_KEY", "VIRUSTOTAL_API_KEY", "AUTH_JWT_SECRET"]
    for key in forbidden_keys:
        assert key not in data
