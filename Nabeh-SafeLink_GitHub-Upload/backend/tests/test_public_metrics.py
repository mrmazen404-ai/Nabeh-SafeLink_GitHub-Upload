import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.public import routes


def test_visitor_hash_requires_a_real_secret(monkeypatch):
    monkeypatch.setattr(routes.settings, "VISITOR_HASH_SALT", "")
    with pytest.raises(HTTPException) as error:
        routes._visitor_hash("visitor-1234567890")
    assert error.value.status_code == 503


def test_visitor_event_rejects_short_or_invalid_identifiers():
    with pytest.raises(ValidationError):
        routes.VisitEvent(visitor_id="short")
    with pytest.raises(ValidationError):
        routes.VisitEvent(visitor_id="visitor-1234567890!", page="welcome")


def test_public_metrics_rate_limiter_is_available_without_redis_by_default():
    assert routes._metrics_limiter.fail_closed is False


def test_public_metrics_rate_limiter_has_an_isolated_namespace():
    assert routes._metrics_limiter.namespace == "nabeh:public:metrics"
