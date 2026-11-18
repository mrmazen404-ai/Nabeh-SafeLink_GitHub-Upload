import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.legal import routes as legal_routes


class FakeQuery:
    def __init__(self, result=None, error=None):
        self.result = result if result is not None else SimpleNamespace(data=[])
        self.error = error

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self.error:
            raise self.error
        return self.result


class FakeSupabase:
    def __init__(self, *, result=None, error=None):
        self.query = FakeQuery(result=result, error=error)

    def table(self, _table_name):
        return self.query


def run(coro):
    return asyncio.run(coro)


def test_production_policy_query_exception_returns_503(monkeypatch):
    monkeypatch.setattr(legal_routes.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(legal_routes, "supabase", FakeSupabase(error=RuntimeError("database unavailable")))

    with pytest.raises(HTTPException) as exc:
        legal_routes._get_policy("TERMS", "ar")

    assert exc.value.status_code == 503


def test_production_policy_missing_row_returns_503(monkeypatch):
    monkeypatch.setattr(legal_routes.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(legal_routes, "supabase", FakeSupabase(result=SimpleNamespace(data=[])))

    with pytest.raises(HTTPException) as exc:
        run(legal_routes.get_policy("TERMS", "ar"))

    assert exc.value.status_code == 503


def test_development_policy_fallback_is_explicit_in_metadata(monkeypatch):
    monkeypatch.setattr(legal_routes.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(legal_routes, "supabase", FakeSupabase(error=RuntimeError("database unavailable")))

    result = run(legal_routes.get_policy("TERMS", "ar"))

    assert result["success"] is True
    assert result["meta"]["source"] == "EMBEDDED_DEVELOPMENT_FALLBACK"
    assert result["data"]["id"].startswith("default-")


def test_production_active_policies_requires_all_published_types(monkeypatch):
    monkeypatch.setattr(legal_routes.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(
        legal_routes,
        "supabase",
        FakeSupabase(result=SimpleNamespace(data=[{"policy_type": "TERMS", "language": "ar"}])),
    )

    with pytest.raises(HTTPException) as exc:
        run(legal_routes.get_active_policies("ar"))

    assert exc.value.status_code == 503


def test_development_active_policy_partial_fallback_is_disclosed(monkeypatch):
    monkeypatch.setattr(legal_routes.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(
        legal_routes,
        "supabase",
        FakeSupabase(result=SimpleNamespace(data=[{"policy_type": "TERMS", "language": "ar"}])),
    )

    result = run(legal_routes.get_active_policies("ar"))

    assert result["meta"]["source"] == "MIXED_DEVELOPMENT_FALLBACK"
    assert set(result["meta"]["missing_policies"]) == {"PRIVACY", "DISCLAIMER"}
    assert {doc["policy_type"] for doc in result["data"]} == {"TERMS", "PRIVACY", "DISCLAIMER"}
