import base64
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Request, Response

from app.auth import routes


class _Query:
    def __init__(self, data):
        self.data = data

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def is_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self.data)


class _FakeSupabase:
    def __init__(self, otp, rpc_result=None):
        self.otp = otp
        self.rpc_result = rpc_result or {"id": "00000000-0000-0000-0000-000000000123", "email": "person@example.com", "auth_token_version": 0}
        self.rpc_calls = []

    def table(self, _table):
        return _Query([self.otp])

    def rpc(self, name, args):
        self.rpc_calls.append((name, args))
        return _Query(self.rpc_result)


def _request():
    return Request({
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": "/api/v1/auth/verify-otp",
        "raw_path": b"/api/v1/auth/verify-otp",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 1234),
        "server": ("testserver", 443),
    })


@pytest.mark.anyio
async def test_signup_verification_uses_atomic_database_rpc(monkeypatch):
    encoded_password = base64.b64encode(b"argon2-hashed-password").decode()
    encoded_name = base64.b64encode("مستخدم تجريبي".encode()).decode()
    otp = {
        "id": "00000000-0000-0000-0000-000000000456",
        "email": "person@example.com",
        "code_hash": f"signup$valid-hash${encoded_password}${encoded_name}",
        "attempts": 0,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
    }
    fake = _FakeSupabase(otp)
    monkeypatch.setattr(routes, "supabase", fake)
    monkeypatch.setattr(routes, "_enforce_auth_limits", lambda *_args: _immediate())
    monkeypatch.setattr(routes, "get_user_by_email", lambda _email: None)
    monkeypatch.setattr(routes, "hash_otp", lambda _code: "valid-hash")
    monkeypatch.setattr(routes, "get_system_settings", lambda: {"ui.default_language": "ar"})
    monkeypatch.setattr(routes, "issue_access_token", lambda _user: "signed-test-token")

    result = await routes.verify_otp(
        routes.VerifyOtpRequest(email="person@example.com", token="123456", type="signup"),
        Response(),
        _request(),
    )

    assert result["data"]["access_token"] == "signed-test-token"
    assert len(fake.rpc_calls) == 1
    rpc_name, args = fake.rpc_calls[0]
    assert rpc_name == "nabeh_complete_signup_otp"
    assert args["p_create_user"] is True
    assert args["p_code_hash"] == otp["code_hash"]


async def _immediate():
    return None


@pytest.mark.anyio
async def test_verified_signup_email_never_receives_a_token(monkeypatch):
    async def no_limit(*_args):
        return None

    fake = _FakeSupabase({})
    monkeypatch.setattr(routes, "supabase", fake)
    monkeypatch.setattr(routes, "_enforce_auth_limits", no_limit)
    monkeypatch.setattr(routes, "get_user_by_email", lambda _email: {"id": "u1", "email_verified": True})

    with pytest.raises(HTTPException) as exc:
        await routes.verify_otp(
            routes.VerifyOtpRequest(email="person@example.com", token="123456", type="signup"),
            Response(),
            _request(),
        )
    assert exc.value.status_code == 400
    assert not fake.rpc_calls
