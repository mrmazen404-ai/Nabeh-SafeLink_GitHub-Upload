"""Distributed rate limiting for the public guest scan endpoint.

Uses Upstash Redis REST directly, so it works in async FastAPI/Vercel
without a persistent Redis connection or a blocking Redis client.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException, Request

from app.observability import elapsed_ms, log_event, resource_id, safe_error

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    retry_after: int
    unavailable: bool = False


class UpstashRateLimiter:
    """Atomic fixed-window limiter backed by an Upstash Redis REST command."""

    LUA_SCRIPT = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
""".strip()

    def __init__(
        self,
        url: str | None = None,
        token: str | None = None,
        limit: int = 10,
        window_seconds: int = 60,
        timeout_seconds: float = 2.5,
        fail_closed: bool = False,
        namespace: str = "nabeh:guest:scan",
    ) -> None:
        self.url = (url or os.getenv("UPSTASH_REDIS_REST_URL", "")).rstrip("/")
        self.token = token or os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
        self.limit = max(1, int(limit))
        self.window_seconds = max(1, int(window_seconds))
        self.timeout_seconds = max(0.5, float(timeout_seconds))
        self.fail_closed = fail_closed
        self.namespace = namespace

    @property
    def configured(self) -> bool:
        if not (self.url and self.token):
            return False
        if os.getenv("NABEH_ENVIRONMENT", "development").lower() in {"production", "staging"}:
            salt = os.getenv("NABEH_RATE_LIMIT_SALT", "")
            return self.fail_closed and len(salt) >= 32
        return True

    async def check(self, identity: str) -> RateLimitDecision:
        started = time.perf_counter()
        identity_id = resource_id(identity)
        if not self.configured:
            log_event(
                logger,
                logging.ERROR if self.fail_closed else logging.WARNING,
                "rate_limit_unconfigured",
                identity_id=identity_id,
                fail_closed=self.fail_closed,
            )
            if self.fail_closed:
                return RateLimitDecision(False, self.limit, 0, self.window_seconds, unavailable=True)
            return RateLimitDecision(True, self.limit, self.limit, 0)

        window_id = int(time.time()) // self.window_seconds
        key = f"{self.namespace}:{self._hash_identity(identity)}:{window_id}"
        payload = ["EVAL", self.LUA_SCRIPT, "1", key, str(self.window_seconds)]

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    self.url,
                    headers={"Authorization": f"Bearer {self.token}"},
                    json=payload,
                )
                response.raise_for_status()
                body: Any = response.json()
                result = body.get("result") if isinstance(body, dict) else None
                current = int(result[0])
                ttl = max(1, int(result[1]))
        except Exception as error:
            log_event(logger, logging.ERROR, "rate_limit_provider_failed", identity_id=identity_id, error_type=safe_error(error), duration_ms=elapsed_ms(started))
            if self.fail_closed and os.getenv("NABEH_ENVIRONMENT", "development").lower() in {"production", "staging"}:
                return RateLimitDecision(False, self.limit, 0, self.window_seconds, unavailable=True)
            # In local development, fail open if Upstash Redis REST endpoint is unreachable or times out
            return RateLimitDecision(True, self.limit, self.limit, 0)


        remaining = max(0, self.limit - current)
        decision = RateLimitDecision(
            allowed=current <= self.limit,
            limit=self.limit,
            remaining=remaining,
            retry_after=ttl if current >= self.limit else 0,
        )
        log_event(logger, logging.INFO, "rate_limit_checked", identity_id=identity_id, allowed=decision.allowed, remaining=decision.remaining, duration_ms=elapsed_ms(started))
        return decision

    @staticmethod
    def _hash_identity(identity: str) -> str:
        # Never place a raw IP address in Redis keys or logs.
        salt_value = os.getenv("NABEH_RATE_LIMIT_SALT", "")
        if os.getenv("NABEH_ENVIRONMENT", "development").lower() in {"production", "staging"} and len(salt_value) < 32:
            raise RuntimeError("NABEH_RATE_LIMIT_SALT is required for production rate limiting")
        salt = (salt_value or "development-only-change-me").encode()
        return hmac.new(salt, identity.encode("utf-8", "ignore"), hashlib.sha256).hexdigest()[:32]


def client_identity(request: Request) -> str:
    """Return a stable client identity.

    X-Forwarded-For is used only when explicitly enabled because clients can
    forge it outside a trusted reverse proxy.
    """
    trust_headers = os.getenv("NABEH_TRUST_PROXY_HEADERS", "false").lower() in {"1", "true", "yes"}
    trusted_proxy_cidrs = [
        value.strip() for value in os.getenv("NABEH_TRUSTED_PROXY_CIDRS", "").split(",") if value.strip()
    ]
    remote = request.client.host if request.client else "unknown"
    if trust_headers and trusted_proxy_cidrs and remote != "unknown":
        try:
            remote_ip = ipaddress.ip_address(remote)
            trusted = any(remote_ip in ipaddress.ip_network(cidr, strict=False) for cidr in trusted_proxy_cidrs)
        except ValueError:
            trusted = False
        if trusted:
            forwarded = request.headers.get("x-forwarded-for", "")
            candidate = forwarded.split(",", 1)[0].strip()
            try:
                return str(ipaddress.ip_address(candidate))
            except ValueError:
                pass
    return remote


_guest_limiter = UpstashRateLimiter(
    limit=int(os.getenv("NABEH_GUEST_RATE_LIMIT", "10")),
    window_seconds=int(os.getenv("NABEH_GUEST_RATE_WINDOW_SECONDS", "60")),
    fail_closed=os.getenv("NABEH_RATE_LIMIT_FAIL_CLOSED", "true").lower() in {"1", "true", "yes"},
)


async def enforce_guest_rate_limit(request: Request) -> None:
    decision = await _guest_limiter.check(client_identity(request))
    if not decision.allowed:
        log_event(logger, logging.WARNING, "guest_rate_limit_blocked", remaining=decision.remaining, retry_after=decision.retry_after)
        raise HTTPException(
            status_code=503 if decision.unavailable else 429,
            detail=("خدمة تحديد معدل الطلبات غير متاحة مؤقتاً." if decision.unavailable else "عدد محاولات فحص الضيف مرتفع مؤقتاً. حاول لاحقاً."),
            headers={
                "Retry-After": str(decision.retry_after or 60),
                "X-RateLimit-Limit": str(decision.limit),
                "X-RateLimit-Remaining": "0",
                "Cache-Control": "no-store",
            },
        )
