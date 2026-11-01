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
    ],
)
def test_url_input_rejects_malformed_targets(value):
    with pytest.raises(HTTPException) as exc:
        _validate_input(ScanRequest(input_type="URL", input_value=value))
    assert exc.value.status_code == 422


def test_url_input_accepts_public_domains_and_extracted_urls():
    assert _validate_input(ScanRequest(input_type="URL", input_value="example.photography/path")) == "example.photography/path"
    assert _validate_input(ScanRequest(input_type="URL", input_value="example.com:8443/path")) == "example.com:8443/path"
    assert _validate_input(ScanRequest(input_type="URL", input_value="افحص https://example.com/path الآن")) == "افحص https://example.com/path الآن"


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
