import pytest
from fastapi import HTTPException

from app.scans.routes import ScanRequest, _redact_uncalibrated_scores, _validate_input


@pytest.mark.parametrize(
    "value",
    [
        "ordinary text",
        "javascript:alert(1)",
        "https://example.com:99999/path",
        "https://example.com:abc/path",
        "http:///missing-host",
        "https://bad host.example/path",
        "https://example.com\\@evil.test/path",
        "افحص https://example.com/path الآن",
        "https://one.example/path https://two.example/path",
        "https://user@example.com/path",
        "https://a..b/path",
        "https://999.999.999.999/path",
        "ftp://example.com/file",
    ],
)
def test_url_input_rejects_malformed_targets(value):
    with pytest.raises(HTTPException) as exc:
        _validate_input(ScanRequest(input_type="URL", input_value=value))
    assert exc.value.status_code == 422


def test_url_input_accepts_and_normalizes_one_web_url():
    assert _validate_input(ScanRequest(input_type="URL", input_value="example.photography/path")) == "https://example.photography/path"
    assert _validate_input(ScanRequest(input_type="URL", input_value="example.com:8443/path")) == "https://example.com:8443/path"
    assert _validate_input(ScanRequest(input_type="URL", input_value="HTTPS://EXAMPLE.COM/a?x=1#part")) == "https://example.com/a?x=1#part"
    assert _validate_input(ScanRequest(input_type="URL", input_value="https://[2001:0db8::1]:8443/path")) == "https://[2001:db8::1]:8443/path"
    unicode_host = "مثال.إختبار".encode("idna").decode("ascii")
    assert _validate_input(ScanRequest(input_type="URL", input_value="مثال.إختبار/مسار")) == f"https://{unicode_host}/مسار"


def test_text_input_is_not_misvalidated_as_a_url():
    value = "يرجى مراجعة الرسالة العادية"
    assert _validate_input(ScanRequest(input_type="TEXT", input_value=value)) == value


def test_api_redaction_hides_scores_but_preserves_engine_counts():
    result = _redact_uncalibrated_scores({
        "confidence_score": 0.95,
        "analysis_snapshot": {"stage1_ml": {"phishing_prob": 0.04}},
        "virustotal": {"malicious": 2, "total_engines": 70},
    })
    assert result["confidence_score"] is None
    assert result["analysis_snapshot"]["stage1_ml"]["phishing_prob"] is None
    assert result["virustotal"] == {"malicious": 2, "total_engines": 70}
