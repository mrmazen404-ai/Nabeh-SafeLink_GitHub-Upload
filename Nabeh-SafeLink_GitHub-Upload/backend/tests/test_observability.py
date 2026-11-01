import json
import logging

from app.observability import log_event, sanitize_fields, set_request_id, reset_request_id


def test_recursive_redaction_removes_secrets_and_content():
    safe = sanitize_fields({
        "api_key": "secret-value",
        "authorization": "Bearer token",
        "payload": {
            "message_text": "sms content",
            "full_url": "https://example.test/login?token=1",
            "status": "SAFE",
            "counts": [1, 2, 3],
        },
        "input_type": "URL",
        "duration_ms": 12,
    })
    assert safe["api_key"] == "[REDACTED]"
    assert safe["authorization"] == "[REDACTED]"
    assert safe["payload"]["message_text"] == "[REDACTED]"
    assert safe["payload"]["full_url"] == "[REDACTED]"
    assert safe["payload"]["status"] == "SAFE"
    assert safe["input_type"] == "URL"
    assert "secret-value" not in json.dumps(safe)
    assert "example.test" not in json.dumps(safe)


def test_log_event_is_json_and_contains_request_correlation(caplog):
    token = set_request_id("request-test-123")
    try:
        with caplog.at_level(logging.INFO):
            log_event(logging.getLogger("test-observability"), logging.INFO, "scan_started", input_type="URL", duration_ms=4)
    finally:
        reset_request_id(token)
    record = next(item for item in caplog.records if item.name == "test-observability")
    payload = json.loads(record.message)
    assert payload["event"] == "scan_started"
    assert payload["request_id"] == "request-test-123"
    assert payload["input_type"] == "URL"
    assert payload["duration_ms"] == 4


def test_long_values_are_bounded():
    safe = sanitize_fields({"note": "x" * 1000})
    assert len(safe["note"]) <= 241
