import json
import os

import app.ml.predictor as predictor
from app.ml.predictor import extract_features, predict_url


def test_invalid_url_is_unknown_not_dangerous():
    for value in ("not a url", "javascript:alert(1)", "", "   "):
        result = predict_url(value)
        assert result["classification"] == "UNKNOWN"
        assert result["source"] in {"EMPTY_INPUT", "INVALID_URL"}


def test_malformed_ports_are_unknown():
    for value in ("https://example.com:99999/path", "https://example.com:abc/path"):
        result = predict_url(value)
        assert result["classification"] == "UNKNOWN"
        assert result["source"] == "INVALID_URL"


def test_encoded_structural_delimiters_are_unknown():
    for value in (
        "https://example.com/a%2fb",
        "https://example.com/a%3fb=1",
        "https://example.com/a%23fragment",
    ):
        result = predict_url(value)
        assert result["classification"] == "UNKNOWN"
        assert result["source"] == "AMBIGUOUS_URL_ENCODING"


def test_encoded_question_mark_does_not_change_raw_query_boundary():
    features = extract_features("https://example.com/a%3fb=1")
    assert features["query_length"] == 0


def test_feature_contract_matches_retrained_report():
    report_path = os.path.join(os.path.dirname(__file__), "../app/ml/nabeh_model_retrained_report.json")
    if not os.path.exists(report_path):
        report_path = "backend/app/ml/nabeh_model_retrained_report.json"
    with open(report_path, encoding="utf-8") as handle:
        report = json.load(handle)
    actual = list(extract_features("https://example.com/login?verify=1"))
    assert len(actual) == 42
    assert actual == report["feature_names"]


def test_model_readiness_reports_disabled_artifact_without_sensitive_details(monkeypatch):
    monkeypatch.setattr(predictor, "model_bundle", None)
    monkeypatch.setattr(predictor, "_model_load_attempted", False)
    monkeypatch.setattr(predictor, "_model_load_status", "NOT_CHECKED")
    monkeypatch.delenv("NABEH_TRUST_MODEL_ARTIFACT", raising=False)

    result = predictor.get_model_readiness()

    assert result == {"status": "unavailable", "code": "MODEL_TRUST_DISABLED"}
    assert "path" not in result


def test_model_readiness_reports_missing_artifact(monkeypatch, tmp_path):
    monkeypatch.setattr(predictor, "model_bundle", None)
    monkeypatch.setattr(predictor, "_model_load_attempted", False)
    monkeypatch.setattr(predictor, "_model_load_status", "NOT_CHECKED")
    monkeypatch.setattr(predictor, "MODEL_PATH", str(tmp_path / "missing.joblib"))
    monkeypatch.setenv("NABEH_TRUST_MODEL_ARTIFACT", "1")

    assert predictor.get_model_readiness() == {
        "status": "unavailable",
        "code": "MODEL_ARTIFACT_MISSING",
    }


def test_model_readiness_sanitizes_artifact_load_failure(monkeypatch, tmp_path):
    artifact = tmp_path / "broken.joblib"
    artifact.write_bytes(b"invalid")
    monkeypatch.setattr(predictor, "model_bundle", None)
    monkeypatch.setattr(predictor, "_model_load_attempted", False)
    monkeypatch.setattr(predictor, "_model_load_status", "NOT_CHECKED")
    monkeypatch.setattr(predictor, "MODEL_PATH", str(artifact))
    monkeypatch.setattr(predictor.joblib, "load", lambda _: (_ for _ in ()).throw(ValueError("private detail")))
    monkeypatch.setenv("NABEH_TRUST_MODEL_ARTIFACT", "1")

    result = predictor.get_model_readiness()

    assert result == {"status": "unavailable", "code": "MODEL_ARTIFACT_LOAD_FAILED"}
    assert "private detail" not in str(result)
