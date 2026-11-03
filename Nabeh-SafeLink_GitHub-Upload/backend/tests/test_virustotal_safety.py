import asyncio

import httpx

from app.virustotal import client


def test_parse_response_counts_additional_engine_statuses():
    result = client._parse_response({
        "data": {
            "attributes": {
                "last_analysis_stats": {
                    "malicious": 1,
                    "suspicious": 2,
                    "harmless": 4,
                    "undetected": 5,
                    "timeout": 3,
                    "type-unsupported": 1,
                }
            }
        }
    })
    assert result["total_engines"] == 16
    assert result["unclassified_engines"] == 4
    assert result["additional_engine_statuses"] == {"timeout": 3, "type-unsupported": 1}


def test_one_suspicious_engine_is_not_reported_as_clean():
    result = client._parse_response({
        "data": {
            "attributes": {
                "last_analysis_stats": {
                    "malicious": 0,
                    "suspicious": 1,
                    "harmless": 9,
                }
            }
        }
    })

    assert result["status"] == "SUSPICIOUS"
    assert result["suspicious"] == 1
    assert result["malicious"] == 0


def test_network_exception_does_not_return_raw_exception(monkeypatch):
    class FailingClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def get(self, *_args, **_kwargs):
            raise httpx.RequestError("secret-token=should-not-leak")

    monkeypatch.setattr(client, "_get_api_key", lambda: "configured")
    monkeypatch.setattr(client.httpx, "AsyncClient", lambda **_kwargs: FailingClient())
    result = asyncio.run(client.check_url_virustotal("https://example.com"))
    assert result["error"] == "VIRUSTOTAL_NETWORK_ERROR"
    assert "secret-token" not in str(result)
