import asyncio
from collections import defaultdict, deque
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.scans import routes as scan_routes


USER_ID = "00000000-0000-0000-0000-000000000001"
SCAN_ID = "00000000-0000-0000-0000-000000000099"


def result(data=None):
    return SimpleNamespace(data=data or [])


class FakeQuery:
    def __init__(self, db, table):
        self.db = db
        self.table_name = table
        self.operation = "select"
        self.payload = None

    def select(self, *_args, **_kwargs):
        self.operation = "select"
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def is_(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        self.db.calls.append((self.table_name, self.operation, self.payload))
        queue = self.db.responses[(self.table_name, self.operation)]
        return queue.popleft() if queue else result([])


class FakeSupabase:
    def __init__(self, responses=None, rpc_results=None):
        self.responses = defaultdict(deque)
        for key, values in (responses or {}).items():
            self.responses[key].extend(values if isinstance(values, list) else [values])
        self.rpc_results = deque(rpc_results or [])
        self.calls = []

    def table(self, table_name):
        return FakeQuery(self, table_name)

    def rpc(self, name, _payload):
        return FakeQuery(self, f"rpc:{name}")


async def _user_id(_authorization):
    return USER_ID


def test_hide_scan_succeeds_only_after_readback(monkeypatch):
    saved = {"id": SCAN_ID, "user_hidden_at": "2026-11-06T00:00:00+00:00"}
    db = FakeSupabase(responses={("scans", "select"): [result([{"id": SCAN_ID}]), result([saved])]})
    monkeypatch.setattr(scan_routes, "supabase", db)
    monkeypatch.setattr(scan_routes, "get_required_user_id", _user_id)

    response = asyncio.run(scan_routes.hide_scan(SCAN_ID, authorization=None))

    assert response["data"] == saved
    assert response["meta"]["source"] == "SUPABASE_CONFIRMED"


def test_hide_scan_empty_readback_returns_503(monkeypatch):
    db = FakeSupabase(responses={("scans", "select"): [result([{"id": SCAN_ID}]), result([])]})
    monkeypatch.setattr(scan_routes, "supabase", db)
    monkeypatch.setattr(scan_routes, "get_required_user_id", _user_id)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(scan_routes.hide_scan(SCAN_ID, authorization=None))

    assert exc.value.status_code == 503


def test_unhide_scan_confirms_null_value_from_database(monkeypatch):
    saved = {"id": SCAN_ID, "user_hidden_at": None}
    db = FakeSupabase(responses={("scans", "select"): [result([{"id": SCAN_ID}]), result([saved])]})
    monkeypatch.setattr(scan_routes, "supabase", db)
    monkeypatch.setattr(scan_routes, "get_required_user_id", _user_id)

    response = asyncio.run(scan_routes.unhide_scan(SCAN_ID, authorization=None))

    assert response["data"] == saved
    assert response["meta"]["source"] == "SUPABASE_CONFIRMED"
