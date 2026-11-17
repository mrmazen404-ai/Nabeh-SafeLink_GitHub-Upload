from app.gemini.client import _sanitize_official_portal_url


def test_sms_reference_portal_comes_only_from_curated_brand_match():
    result = _sanitize_official_portal_url(
        {"official_portal_url": "https://invented.example"},
        "تحديث حساب PayPal مطلوب فورًا",
        "https://paypal-login.example/verify",
        allow_reference=True,
    )

    assert result["official_domain"] == "paypal.com"
    assert result["official_portal_url"] == "https://paypal.com"
    assert result["portal_source"] == "CURATED_ALLOWLIST_REFERENCE"
    assert result["authenticity_status"] == "غير متحقق"
    assert result["domain_verification"]["status"] == "MISMATCH_OR_UNKNOWN"
    assert "CLAIMED_BRAND_DOMAIN_MISMATCH" in result["domain_verification"]["impersonation_signals"]


def test_sms_reference_portal_is_not_returned_for_unknown_claim():
    result = _sanitize_official_portal_url(
        {"official_portal_url": "https://invented.example"},
        "لديك تحديث عاجل لحسابك",
        "https://unknown.example/login",
        allow_reference=True,
    )

    assert result["official_domain"] == "غير متاح"
    assert result["official_portal_url"] == "غير متاح"
    assert result["portal_source"] is None
    assert result["claim_status"] == "UNKNOWN"
