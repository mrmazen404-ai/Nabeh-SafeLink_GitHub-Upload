"""Regression contracts for database writes that must not report unconfirmed success.

These tests assert that mutations either return a row confirmed by a subsequent
database read or fail without a synthetic success response.
"""

import asyncio
from collections import defaultdict, deque
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request

from app.admin import routes as admin_routes
from app.dashboard import routes as dashboard_routes
from app.scans.service import ScanPersistenceError, ScanService
from app.support import routes as support_routes


USER = {"id": "user-123", "email": "person@example.com", "status": "ACTIVE"}


class FakeQuery:
    """Small Supabase query double; no network/database calls are possible."""

    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self.operation = "select"
        self.payload = None

    def select(self, *_args, **_kwargs):
        self.operation = "select"
        return self

    def insert(self, payload, *_args, **_kwargs):
        self.operation = "insert"
        self.payload = payload
        return self

    def upsert(self, payload, *_args, **_kwargs):
        self.operation = "upsert"
        self.payload = payload
        return self

    def update(self, payload, *_args, **_kwargs):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def in_(self, *_args, **_kwargs):
        return self

    def is_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        key = (self.table_name, self.operation)
        self.db.calls.append({"key": key, "payload": self.payload})
        if self.db.exceptions[key]:
            raise self.db.exceptions[key].popleft()
        if self.db.responses[key]:
            return self.db.responses[key].popleft()
        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self, *, responses=None, exceptions=None):
        self.responses = defaultdict(deque)
        self.exceptions = defaultdict(deque)
        self.calls = []
        for key, values in (responses or {}).items():
            self.responses[key].extend(values if isinstance(values, list) else [values])
        for key, values in (exceptions or {}).items():
            self.exceptions[key].extend(values if isinstance(values, list) else [values])

    def table(self, table_name):
        return FakeQuery(self, table_name)


def result(data):
    return SimpleNamespace(data=data)


def run(coro):
    return asyncio.run(coro)


def request_for_admin():
    return Request(
        {
            "type": "http",
            "method": "PATCH",
            "scheme": "https",
            "server": ("testserver", 443),
            "client": ("127.0.0.1", 12345),
            "path": "/api/v1/admin/users/00000000-0000-0000-0000-000000000001/status",
            "query_string": b"",
            "headers": [],
        }
    )


@pytest.mark.parametrize("missing_data", [[], None], ids=["empty-list", "none"])
def test_support_request_requires_returned_database_row(monkeypatch, missing_data):
    db = FakeSupabase(responses={("support_requests", "insert"): result(missing_data)})
    monkeypatch.setattr(support_routes, "supabase", db)
    monkeypatch.setattr(support_routes, "_get_required_user_id", lambda _authorization: USER["id"])
    events = []
    monkeypatch.setattr(
        support_routes,
        "log_event",
        lambda *_args, **kwargs: events.append(_args[2] if len(_args) > 2 else kwargs.get("event")),
    )
    payload = support_routes.SupportContactRequest(
        email="person@example.com",
        subject="Scan result review",
        details="Please review this result.",
    )

    with pytest.raises(HTTPException) as exc:
        run(support_routes.create_support_request(payload, authorization="Bearer test"))

    assert exc.value.status_code == 503
    assert "support_request_persisted" not in events


def test_support_database_exception_returns_service_unavailable(monkeypatch):
    db = FakeSupabase(exceptions={("support_requests", "insert"): RuntimeError("database unavailable")})
    monkeypatch.setattr(support_routes, "supabase", db)
    monkeypatch.setattr(support_routes, "_get_required_user_id", lambda _authorization: USER["id"])
    payload = support_routes.SupportContactRequest(
        email="person@example.com",
        subject="Scan result review",
        details="Please review this result.",
    )

    with pytest.raises(HTTPException) as exc:
        run(support_routes.create_support_request(payload, authorization="Bearer test"))

    assert exc.value.status_code == 503


@pytest.mark.parametrize("missing_data", [[], None], ids=["empty-list", "none"])
def test_notification_preferences_upsert_requires_database_confirmation(monkeypatch, missing_data):
    db = FakeSupabase(responses={("notification_preferences", "upsert"): result(missing_data)})
    monkeypatch.setattr(dashboard_routes, "supabase", db)
    monkeypatch.setattr(dashboard_routes, "_require_user", lambda _authorization: USER)
    payload = dashboard_routes.PreferenceUpdate(email_enabled=True)

    with pytest.raises(HTTPException) as exc:
        run(dashboard_routes.update_notification_preferences(payload, Response(), authorization=None))

    assert exc.value.status_code == 503


def test_privacy_consent_database_exception_is_not_reported_as_success(monkeypatch):
    db = FakeSupabase(exceptions={("privacy_consents", "upsert"): RuntimeError("database unavailable")})
    monkeypatch.setattr(dashboard_routes, "supabase", db)
    monkeypatch.setattr(dashboard_routes, "_require_user", lambda _authorization: USER)
    payload = dashboard_routes.ConsentUpdate(
        consent_type="PRIVACY_POLICY",
        version="2026-01",
        granted=True,
    )

    with pytest.raises(HTTPException) as exc:
        run(dashboard_routes.update_privacy_consent(payload, Response(), authorization=None))

    assert exc.value.status_code == 503


def test_feedback_insert_without_returned_row_is_not_success(monkeypatch):
    db = FakeSupabase(
        responses={
            ("scans", "select"): result([{"id": "scan-1"}]),
            ("feedback", "insert"): result([]),
        }
    )
    monkeypatch.setattr(dashboard_routes, "supabase", db)
    monkeypatch.setattr(dashboard_routes, "_require_user", lambda _authorization: USER)
    payload = dashboard_routes.FeedbackCreate(
        scan_id="scan-1",
        reported_classification="SUSPICIOUS",
        comment="Please review",
    )

    with pytest.raises(HTTPException) as exc:
        run(dashboard_routes.create_feedback(payload, Response(), authorization=None))

    assert exc.value.status_code == 503


def test_admin_status_change_without_updated_row_does_not_audit_or_claim_change(monkeypatch):
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    db = FakeSupabase(
        responses={
            ("custom_users", "select"): result(
                [{"id": str(user_id), "status": "ACTIVE", "email": "person@example.com"}]
            ),
            ("custom_users", "update"): result([]),
        }
    )
    monkeypatch.setattr(admin_routes, "supabase", db)
    audit_calls = []
    monkeypatch.setattr(admin_routes, "_audit", lambda *args, **kwargs: audit_calls.append((args, kwargs)))

    with pytest.raises(HTTPException) as exc:
        admin_routes.update_user_status(
            user_id,
            admin_routes.UserStatusRequest(status="SUSPENDED", reason="Security review"),
            request_for_admin(),
            admin={"id": "admin-1"},
        )

    assert exc.value.status_code in {409, 503}
    assert audit_calls == []


def test_admin_status_database_exception_does_not_audit(monkeypatch):
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    db = FakeSupabase(
        responses={
            ("custom_users", "select"): result(
                [{"id": str(user_id), "status": "ACTIVE", "email": "person@example.com"}]
            )
        },
        exceptions={("custom_users", "update"): RuntimeError("database unavailable")},
    )
    monkeypatch.setattr(admin_routes, "supabase", db)
    audit_calls = []
    monkeypatch.setattr(admin_routes, "_audit", lambda *args, **kwargs: audit_calls.append((args, kwargs)))

    with pytest.raises(HTTPException) as exc:
        admin_routes.update_user_status(
            user_id,
            admin_routes.UserStatusRequest(status="SUSPENDED", reason="Security review"),
            request_for_admin(),
            admin={"id": "admin-1"},
        )

    assert exc.value.status_code == 503
    assert audit_calls == []


@pytest.mark.parametrize("missing_data", [[], None], ids=["empty-list", "none"])
def test_authenticated_scan_requires_persisted_row(monkeypatch, missing_data):
    db = FakeSupabase(responses={("scans", "insert"): result(missing_data)})
    monkeypatch.setattr("app.scans.service.supabase", db)

    async def fake_scan(cls, raw_input, language="ar"):
        return {
            "classification": "SUSPICIOUS",
            "explanation": {"summary": "test", "recommendation": "review"},
            "stages": {},
        }

    monkeypatch.setattr(ScanService, "process_url_scan", classmethod(fake_scan))

    with pytest.raises(ScanPersistenceError):
        run(ScanService.process_authenticated_scan("URL", "https://example.test/", USER["id"]))


def test_authenticated_scan_database_exception_raises_persistence_error(monkeypatch):
    db = FakeSupabase(exceptions={("scans", "insert"): RuntimeError("database unavailable")})
    monkeypatch.setattr("app.scans.service.supabase", db)

    async def fake_scan(cls, raw_input, language="ar"):
        return {
            "classification": "SUSPICIOUS",
            "explanation": {"summary": "test", "recommendation": "review"},
            "stages": {},
        }

    monkeypatch.setattr(ScanService, "process_url_scan", classmethod(fake_scan))

    with pytest.raises(ScanPersistenceError):
        run(ScanService.process_authenticated_scan("URL", "https://example.test/", USER["id"]))



def test_support_success_returns_only_row_read_back_from_database(monkeypatch):
    ticket_id = "TK-ABC123"
    saved_row = {"id": "support-row-1", "ticket_id": ticket_id, "email": "person@example.com", "status": "OPEN"}
    db = FakeSupabase(responses={
        ("support_requests", "insert"): result([]),
        ("support_requests", "select"): result([saved_row]),
    })
    monkeypatch.setattr(support_routes, "supabase", db)
    monkeypatch.setattr(support_routes, "_get_required_user_id", lambda _authorization: USER["id"])
    monkeypatch.setattr(support_routes, "uuid4", lambda: SimpleNamespace(hex="ABC123"))
    payload = support_routes.SupportContactRequest(
        email="person@example.com",
        subject="Scan result review",
        details="Please review this result.",
    )

    response = run(support_routes.create_support_request(payload, authorization="Bearer test"))

    assert response["data"] == saved_row
    assert response["meta"]["source"] == "SUPABASE_CONFIRMED"
    assert db.calls[0]["payload"]["ticket_id"] == ticket_id


def test_notification_preferences_success_returns_read_back_row(monkeypatch):
    saved = {
        "user_id": USER["id"],
        "in_app_enabled": True,
        "email_enabled": True,
        "dangerous_scan_enabled": True,
        "weekly_summary_enabled": False,
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    db = FakeSupabase(responses={("notification_preferences", "select"): result([saved])})
    monkeypatch.setattr(dashboard_routes, "supabase", db)
    monkeypatch.setattr(dashboard_routes, "_require_user", lambda _authorization: USER)

    response = run(
        dashboard_routes.update_notification_preferences(
            dashboard_routes.PreferenceUpdate(email_enabled=True), Response(), authorization=None
        )
    )

    assert response["data"] == saved
    assert response["meta"]["source"] == "SUPABASE_CONFIRMED"


def test_notification_preferences_mismatched_read_back_is_not_success(monkeypatch):
    saved = {"user_id": USER["id"], "email_enabled": False}
    db = FakeSupabase(responses={("notification_preferences", "select"): result([saved])})
    monkeypatch.setattr(dashboard_routes, "supabase", db)
    monkeypatch.setattr(dashboard_routes, "_require_user", lambda _authorization: USER)

    with pytest.raises(HTTPException) as exc:
        run(
            dashboard_routes.update_notification_preferences(
                dashboard_routes.PreferenceUpdate(email_enabled=True), Response(), authorization=None
            )
        )

    assert exc.value.status_code == 503


def test_admin_status_audit_runs_only_after_database_read_confirms_change(monkeypatch):
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    original = {"id": str(user_id), "status": "ACTIVE", "email": "person@example.com"}
    changed = {"id": str(user_id), "status": "SUSPENDED", "email": "person@example.com"}
    db = FakeSupabase(responses={
        ("custom_users", "select"): [result([original]), result([changed])],
    })
    monkeypatch.setattr(admin_routes, "supabase", db)
    audit_calls = []
    monkeypatch.setattr(admin_routes, "_audit", lambda *args, **kwargs: audit_calls.append(len(db.calls)))

    response = admin_routes.update_user_status(
        user_id,
        admin_routes.UserStatusRequest(status="SUSPENDED", reason="Security review"),
        request_for_admin(),
        admin={"id": "admin-1"},
    )

    assert response["data"] == changed
    assert response["meta"]["source"] == "SUPABASE_CONFIRMED"
    assert audit_calls == [3]
