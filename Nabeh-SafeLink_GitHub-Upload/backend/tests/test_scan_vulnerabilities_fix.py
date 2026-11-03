import pytest
from app.scans.service import ScanService
from app.gemini.client import _local_sms_analysis


def test_extract_url_from_text_naked_domains_and_explicit_urls():
    # 1. Explicit http/https
    assert ScanService.extract_url_from_text("رابط الفحص https://example.com/test") == "https://example.com/test"
    assert ScanService.extract_url_from_text("زر موقعنا http://my-site.org") == "http://my-site.org"

    # 2. www. prefix
    assert ScanService.extract_url_from_text("زوروا موقعنا www.alrajhibank.com.sa") == "https://www.alrajhibank.com.sa"

    # Public suffixes are not restricted to a hand-maintained TLD list.
    assert ScanService.extract_url_from_text("راجع example.photography/path، ثم تابع") == "https://example.photography/path"
    assert ScanService.extract_url_from_text("افتح https://example.com/path؟") == "https://example.com/path"

    # 3. Naked domains without http/https or www
    assert ScanService.extract_url_from_text("تحديث البيانات عبر bank-alrajhi-update.com/login الآن") == "https://bank-alrajhi-update.com/login"
    assert ScanService.extract_url_from_text("سدد الغرامة من خلال stc-pay-portal.sa فوراً") == "https://stc-pay-portal.sa"

    # 4. Text without any URL or domain
    assert ScanService.extract_url_from_text("السلام عليكم ورحمة الله وبركاته كيف حالك اليوم؟") == ""


def test_analyze_text_phishing_does_not_claim_safe_from_missing_indicators():
    # Ordinary text without risk indicators is inconclusive, not verified safe.
    res = ScanService.analyze_text_phishing("مرحباً بك، تذكرة الطيران الخاصة برحلتك القادمة جاهزة ويمكنك استلامها في أي وقت.", has_embedded_url=False)
    assert res["classification"] == "UNKNOWN"
    assert res["confidence"] is None
    assert res["fraud_probability"] is None

    # Text with phishing keywords and embedded URL should be DANGEROUS/SUSPICIOUS
    phishing_res = ScanService.analyze_text_phishing("حسابك البنكي موقوف يرجى تحديث كلمة المرور عبر البطاقة", has_embedded_url=True)
    assert phishing_res["classification"] in {"DANGEROUS", "SUSPICIOUS"}


def test_local_sms_analysis_normal_text_is_inconclusive():
    normal_text = "رسالة تذكير بموعد الاجتماع الدوري لمجلس الإدارة غداً الساعة العاشرة صباحاً في القاعة الرئيسية."
    res = _local_sms_analysis(text_content=normal_text, extracted_url="", language="ar")
    assert res["classification"] == "UNKNOWN"
    assert res["fraud_probability"] is None
    assert "غير متحقق" in res["authenticity_status"]
    assert "رسمية" not in res["authenticity_status"]
    # When no known brand is mentioned, official_portal_url MUST be "غير متاح"
    assert res["official_portal_url"] == "غير متاح"


def test_safe_default_recommendation_does_not_guarantee_safety():
    from app.gemini.client import _default_rec

    assert "بأمان" not in _default_rec("SAFE", "ar")
    assert "proceed safely" not in _default_rec("SAFE", "en").lower()


def test_local_sms_analysis_known_brand_does_not_verify_official_portal():
    kuraimi_text = "جائزة من بنك الكريمي ادخل https://kuraimi-fake.com/login"
    res = _local_sms_analysis(text_content=kuraimi_text, extracted_url="https://kuraimi-fake.com/login", language="ar")
    # A brand mention is not deterministic proof of sender identity.
    assert res["official_portal_url"] == "غير متاح"


def test_dynamic_social_engineering_risk_scores():
    # Numeric heuristic scores are not calibrated and must not be exposed.
    benign_res = _local_sms_analysis(text_content="مرحباً أهلاً وسهلاً بك", extracted_url="", language="ar")
    assert benign_res["classification"] == "UNKNOWN"
    assert benign_res["urgency_pressure_score"] is None
    assert benign_res["credential_theft_score"] is None
    assert benign_res["identity_spoofing_score"] is None

    # 2. Text with urgency pressure ("مهلة ساعة فوري")
    urgency_res = _local_sms_analysis(text_content="عاجل فوري مهلة ساعة واحدة لإتمام الإجراء", extracted_url="", language="ar")
    assert urgency_res["urgency_pressure_score"] is None

    # 3. Text with OTP & credential theft ("رمز OTP كلمة المرور")
    otp_res = _local_sms_analysis(text_content="أدخل رمز OTP وكلمة المرور لتأكيد الحساب", extracted_url="", language="ar")
    assert otp_res["credential_theft_score"] is None
    assert otp_res["classification"] == "SUSPICIOUS"

    # 4. Text with brand spoofing ("مصرف الراجحي")
    brand_res = _local_sms_analysis(text_content="تنبيه من مصرف الراجحي بخصوص بطاقتك", extracted_url="", language="ar")
    assert brand_res["identity_spoofing_score"] is None


def test_sanitize_official_portal_url_removes_generic_hallucinations():
    from app.gemini.client import _sanitize_official_portal_url

    # 1. Hallucinated portal in a message without a known brand -> forced to "غير متاح"
    hallucinated_payload = {"official_portal_url": "https://www.my.gov.sa", "summary": "Test"}
    cleaned_1 = _sanitize_official_portal_url(hallucinated_payload, "رسالة عادية لا تنتمي لأي جهة", "")
    assert cleaned_1["official_portal_url"] == "غير متاح"

    # 2. Known brand mentioned is still not proof of an official portal.
    kuraimi_payload = {"official_portal_url": "https://fake.com", "summary": "Test"}
    cleaned_2 = _sanitize_official_portal_url(kuraimi_payload, "تحديث حسابك في بنك الكريمي", "https://fake-link.com")
    assert cleaned_2["official_portal_url"] == "غير متاح"





def test_url_explanation_cannot_return_generic_hallucinated_portal_or_domain():
    from app.gemini.client import _validated_model_result

    result = _validated_model_result(
        {
            "summary": "Test result",
            "reasons": [],
            "recommendation": "Be cautious",
            "official_portal_url": "https://www.my.gov.sa/login",
            "official_domain": "my.gov.sa",
        },
        model_name="test-model",
        provider="GEMINI",
        classification="SUSPICIOUS",
        language="en",
        input_value="https://example.net/verify",
        evidence={},
    )
    assert result["official_portal_url"] == "غير متاح"
    assert result["official_domain"] == "غير متاح"


def test_sanitizer_recognizes_brand_tokens_but_not_substrings():
    from app.gemini.client import _sanitize_official_portal_url

    unrelated = _sanitize_official_portal_url(
        {"official_portal_url": "https://www.stc.com.sa", "official_domain": "stc.com.sa"},
        "Bestchoice update: your weekly summary is ready",
        "",
    )
    assert unrelated["official_portal_url"] == "غير متاح"

    branded = _sanitize_official_portal_url(
        {"official_portal_url": "https://fake.example", "official_domain": "fake.example"},
        "Your PayPal account needs verification",
        "https://paypal-login.example/verify",
    )
    assert branded["official_portal_url"] == "غير متاح"
    assert branded["official_domain"] == "غير متاح"


def test_extract_urls_from_text_returns_distinct_links_in_message_order():
    text = "افحص https://one.example/login، ثم www.two.example/path وبعدها one.example/login"

    assert ScanService.extract_urls_from_text(text) == [
        "https://one.example/login",
        "https://www.two.example/path",
    ]


@pytest.mark.anyio
async def test_sms_scan_routes_each_embedded_url_and_reports_unscanned_links(monkeypatch):
    ml_urls = []
    vt_urls = []

    def fake_predict(url):
        ml_urls.append(url)
        return {"classification": "UNKNOWN", "confidence": None, "source": "MODEL_UNAVAILABLE"}

    async def fake_virustotal(url):
        vt_urls.append(url)
        return {"status": "UNKNOWN", "total_engines": 0}

    monkeypatch.setattr("app.scans.service.predict_url", fake_predict)
    monkeypatch.setattr("app.scans.service.check_url_virustotal", fake_virustotal)
    monkeypatch.setattr("app.scans.service.setting_enabled_fail_closed", lambda *_: False)
    urls = [f"https://domain{index}.example/path" for index in range(6)]

    result = await ScanService.process_text_scan("رسالة تحتوي على: " + " ".join(urls))

    expected_scanned = urls[:5]
    assert sorted(ml_urls) == sorted(expected_scanned)
    assert sorted(vt_urls) == sorted(expected_scanned)
    assert result["extracted_urls"] == urls
    assert result["unscanned_urls"] == urls[5:]
    assert result["links_scanned_count"] == 5
    assert result["links_not_scanned_count"] == 1
    assert result["classification"] == "UNKNOWN"


@pytest.mark.anyio
async def test_sms_scan_reports_defanged_urls_without_sending_them_to_providers(monkeypatch):
    monkeypatch.setattr("app.scans.service.setting_enabled_fail_closed", lambda *_: False)

    result = await ScanService.process_text_scan(
        "تحقق من hxxps://evil.example/path أو example[.]org/login"
    )

    assert result["extracted_urls"] == []
    assert result["unscanned_url_candidates"] == [
        "hxxps://evil.example/path",
        "example[.]org/login",
    ]
    assert result["links_scanned_count"] == 0
