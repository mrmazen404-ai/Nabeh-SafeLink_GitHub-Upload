import asyncio

import pytest

from app.config import settings
from app.scans import service


@pytest.mark.anyio
async def test_text_scan_uses_local_fallback_when_ai_times_out(monkeypatch):
    async def hanging_analysis(**_kwargs):
        await asyncio.sleep(0.05)

    monkeypatch.setattr(service, "analyze_sms_message", hanging_analysis)
    monkeypatch.setattr(service, "setting_enabled_fail_closed", lambda _key: True)
    monkeypatch.setattr(settings, "SCAN_AI_TIMEOUT_SECONDS", 0.001)

    result = await service.ScanService.process_text_scan("السلام عليكم", language="ar")

    assert result["classification"] == "UNKNOWN"
    assert result["confidence"] is None
    assert result["fraud_probability"] is None
    assert result["source"] == "LOCAL_TIMEOUT_FALLBACK"
    assert result["explanation"]["provider"] == "LOCAL_TIMEOUT_FALLBACK"


def test_gemini_cannot_downgrade_dangerous_evidence():
    result = service.ScanService._enforce_text_safety_floor(
        {"classification": "DANGEROUS", "confidence": 0.91},
        {"classification": "UNKNOWN", "confidence": None},
        {"classification": "SAFE", "confidence": 0.99},
    )
    assert result["classification"] == "DANGEROUS"
    assert result["confidence"] == 0.91
