import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, Response

from app.scans import routes as scan_routes


async def authenticated_user(_authorization):
    return "00000000-0000-0000-0000-000000000001"


def test_scan_route_rejects_invalid_idempotency_key(monkeypatch):
    monkeypatch.setattr(scan_routes, "get_required_user_id", authenticated_user)
    scan = AsyncMock()
    monkeypatch.setattr(scan_routes.ScanService, "process_authenticated_scan", scan)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(scan_routes.create_authenticated_scan(
            scan_routes.ScanRequest(input_type="URL", input_value="https://example.org"),
            Response(),
            authorization="Bearer test",
            idempotency_key="short",
        ))

    assert exc.value.status_code == 422
    scan.assert_not_awaited()


def test_scan_route_passes_idempotency_key_to_service(monkeypatch):
    monkeypatch.setattr(scan_routes, "get_required_user_id", authenticated_user)
    monkeypatch.setattr(scan_routes.settings, "SCAN_IDEMPOTENCY_ENABLED", True)
    scan = AsyncMock(return_value={"classification": "SAFE", "scan_id": "scan-1"})
    monkeypatch.setattr(scan_routes.ScanService, "process_authenticated_scan", scan)

    response = asyncio.run(scan_routes.create_authenticated_scan(
        scan_routes.ScanRequest(input_type="URL", input_value="https://example.org"),
        Response(),
        authorization="Bearer test",
        idempotency_key="request-12345678",
    ))

    assert response["success"] is True
    scan.assert_awaited_once()
    assert scan.await_args.kwargs["idempotency_key"] == "request-12345678"


def test_scan_route_fails_closed_if_header_used_before_migration_flag(monkeypatch):
    monkeypatch.setattr(scan_routes, "get_required_user_id", authenticated_user)
    monkeypatch.setattr(scan_routes.settings, "SCAN_IDEMPOTENCY_ENABLED", False)
    scan = AsyncMock()
    monkeypatch.setattr(scan_routes.ScanService, "process_authenticated_scan", scan)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(scan_routes.create_authenticated_scan(
            scan_routes.ScanRequest(input_type="URL", input_value="https://example.org"),
            Response(),
            authorization="Bearer test",
            idempotency_key="request-12345678",
        ))

    assert exc.value.status_code == 503
    scan.assert_not_awaited()
