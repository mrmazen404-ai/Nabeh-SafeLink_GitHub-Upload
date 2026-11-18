import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.scans import service as scan_service_module
from app.scans.service import (
    ScanIdempotencyConflictError,
    ScanPersistenceError,
    ScanService,
    _scan_digest,
)


USER_ID = "00000000-0000-0000-0000-000000000001"
KEY = "request-12345678"
INPUT = "https://example.org/path"


class FakeQuery:
    def __init__(self, row):
        self.row = row

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=[self.row] if self.row else [])


class FakeSupabase:
    def __init__(self, row):
        self.row = row

    def table(self, _table_name):
        return FakeQuery(self.row)


def saved_row(*, input_hash=None, response=None):
    return {
        "id": "00000000-0000-0000-0000-000000000099",
        "status": "COMPLETED",
        "input_hash": input_hash or _scan_digest(USER_ID, "URL", INPUT),
        "classification": "SUSPICIOUS",
        "analysis_snapshot": {
            "idempotency": {
                "response": response or {
                    "classification": "SUSPICIOUS",
                    "explanation": {"summary": "Persisted explanation", "provider": "LOCAL_RULES"},
                    "stages": {"ml": {"status": "COMPLETED"}},
                    "scan_id": "old-id",
                    "is_guest": False,
                }
            }
        },
    }


def test_same_key_same_input_replays_persisted_result_without_scanning(monkeypatch):
    row = saved_row()
    monkeypatch.setattr(scan_service_module, "supabase", FakeSupabase(row))
    monkeypatch.setattr(ScanService, "process_url_scan", AsyncMock(side_effect=AssertionError("scan should not rerun")))

    result = asyncio.run(ScanService.process_authenticated_scan(
        "URL", INPUT, USER_ID, language="ar", idempotency_key=KEY
    ))

    assert result["classification"] == "SUSPICIOUS"
    assert result["scan_id"] == row["id"]
    assert result["idempotent_replay"] is True
    assert result["is_guest"] is False


def test_same_key_different_input_is_conflict(monkeypatch):
    row = saved_row()
    monkeypatch.setattr(scan_service_module, "supabase", FakeSupabase(row))
    monkeypatch.setattr(ScanService, "process_url_scan", AsyncMock(side_effect=AssertionError("scan should not rerun")))

    with pytest.raises(ScanIdempotencyConflictError):
        asyncio.run(ScanService.process_authenticated_scan(
            "URL", "https://different.example", USER_ID, language="ar", idempotency_key=KEY
        ))


def test_existing_idempotency_row_without_snapshot_fails_closed(monkeypatch):
    row = saved_row()
    row["analysis_snapshot"] = None
    monkeypatch.setattr(scan_service_module, "supabase", FakeSupabase(row))

    with pytest.raises(ScanPersistenceError):
        asyncio.run(ScanService.process_authenticated_scan(
            "URL", INPUT, USER_ID, language="ar", idempotency_key=KEY
        ))


class WriteQuery(FakeQuery):
    def __init__(self, db, table_name):
        super().__init__(None)
        self.db = db
        self.table_name = table_name
        self.operation = "select"
        self.filters = {}

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def execute(self):
        if self.operation == "insert":
            if self.table_name == "scans":
                self.db.inserted = dict(self.payload)
            return SimpleNamespace(data=[])
        if self.table_name == "scans" and self.filters.get("idempotency_key_hash"):
            return SimpleNamespace(data=[])
        if self.table_name == "scans" and self.filters.get("id") == (self.db.inserted or {}).get("id"):
            return SimpleNamespace(data=[dict(self.db.inserted)])
        return SimpleNamespace(data=[])


class WriteSupabase:
    def __init__(self):
        self.inserted = None

    def table(self, table_name):
        return WriteQuery(self, table_name)



def test_first_idempotent_scan_persists_hashed_key_and_replay_snapshot(monkeypatch):
    db = WriteSupabase()
    monkeypatch.setattr(scan_service_module, "supabase", db)

    async def fake_scan(_cls, raw_input, language="ar"):
        return {
            "classification": "SAFE",
            "explanation": {"summary": "No indicators detected", "recommendation": "Use caution", "provider": "LOCAL_RULES"},
            "stages": {"ml": {"status": "COMPLETED"}},
            "evidence_card": {"decision": {"classification": "SAFE"}},
        }

    monkeypatch.setattr(ScanService, "process_url_scan", classmethod(fake_scan))
    monkeypatch.setattr(scan_service_module, "_record_scan_metric_best_effort", AsyncMock())
    monkeypatch.setattr(scan_service_module.manager, "broadcast", AsyncMock())

    response = asyncio.run(ScanService.process_authenticated_scan(
        "URL", INPUT, USER_ID, language="ar", idempotency_key=KEY
    ))

    payload = db.inserted
    assert payload["idempotency_key_hash"] == _scan_digest(USER_ID, "IDEMPOTENCY", KEY)
    assert payload["idempotency_key_hash"] != KEY
    assert payload["input_hash"] == _scan_digest(USER_ID, "URL", INPUT)
    assert payload["analysis_snapshot"]["idempotency"]["response"]["classification"] == "SAFE"
    assert "input_value" not in payload["analysis_snapshot"]["idempotency"]["response"]
    assert response["scan_id"] == payload["id"]
    assert response["evidence_card"]["scan_id"] == payload["id"]
