"""Strict, bounded schemas for untrusted Gemini output."""

from __future__ import annotations

import html
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_NUMERIC_PERCENTAGE = re.compile(r"(?<!\w)\d+(?:[.,]\d+)?\s*(?:%|٪)(?!\w)|\b\d+(?:[.,]\d+)?\s*(?:percent|per cent)\b", re.IGNORECASE)


def _clean_text(value: str, max_length: int) -> str:
    value = _CONTROL_CHARS.sub("", html.unescape(value or ""))
    value = re.sub(r"<[^>]*>", "", value)
    return value.strip()[:max_length]


def _clean_citations(values: list[dict[str, str]]) -> list[dict[str, str]]:
    cleaned = []
    for item in values or []:
        if not isinstance(item, dict):
            continue
        url = _clean_text(str(item.get("url", "")), 500)
        title = _clean_text(str(item.get("title", "")), 240)
        if url.startswith(("http://", "https://")):
            cleaned.append({"title": title or url, "url": url})
    return cleaned[:10]


def _contains_numeric_percentage(payload: BaseModel) -> bool:
    fields = ("summary", "recommendation", "reasons", "limitations", "claim_verdict_explanation", "action_plan_steps")
    for field in fields:
        value = getattr(payload, field, None)
        values = value if isinstance(value, list) else [value]
        if any(isinstance(item, str) and _NUMERIC_PERCENTAGE.search(item) for item in values):
            return True
    return False


class GeminiExplanation(BaseModel):
    """Only fields that the UI is allowed to receive from the model."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    classification: Literal["SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN"] = "UNKNOWN"
    summary: str = Field(min_length=1, max_length=600)
    reasons: list[str] = Field(default_factory=list, max_length=5)
    recommendation: str = Field(min_length=1, max_length=500)
    limitations: list[str] = Field(default_factory=list, max_length=5)
    claimed_sender: str = Field(default="غير محددة", max_length=160)
    official_domain: str = Field(default="غير متاح", max_length=253)
    official_portal_url: str = Field(default="غير متاح", max_length=253)
    claim_verdict_explanation: str = Field(default="", max_length=300)
    action_plan_steps: list[str] = Field(default_factory=list, max_length=5)
    lure_type: str = Field(default="غير محدد", max_length=160)
    authenticity_status: str = Field(default="UNKNOWN", max_length=80)
    citations: list[dict[str, str]] = Field(default_factory=list, max_length=10)

    @field_validator("summary", "recommendation", "claimed_sender", "official_domain", "official_portal_url", "claim_verdict_explanation", "lure_type", "authenticity_status")
    @classmethod
    def clean_scalar(cls, value: str) -> str:
        return _clean_text(value, 600)

    @field_validator("reasons", "limitations", "action_plan_steps")
    @classmethod
    def clean_lists(cls, values: list[str]) -> list[str]:
        return [_clean_text(item, 300) for item in values if _clean_text(item, 300)]

    @field_validator("citations")
    @classmethod
    def clean_citation_list(cls, values: list[dict[str, str]]) -> list[dict[str, str]]:
        return _clean_citations(values)


class GeminiSMSAnalysis(BaseModel):
    """Allow-listed SMS fields; self-reported model scores are not accepted."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    classification: Literal["SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN"]
    summary: str = Field(min_length=1, max_length=600)
    reasons: list[str] = Field(default_factory=list, max_length=5)
    recommendation: str = Field(min_length=1, max_length=500)
    limitations: list[str] = Field(default_factory=list, max_length=5)
    claimed_sender: str = Field(default="غير محددة", max_length=160)
    official_domain: str = Field(default="غير متاح", max_length=253)
    official_portal_url: str = Field(default="غير متاح", max_length=253)
    claim_verdict_explanation: str = Field(default="", max_length=300)
    action_plan_steps: list[str] = Field(default_factory=list, max_length=5)
    lure_type: str = Field(default="غير محدد", max_length=160)
    authenticity_status: str = Field(default="UNKNOWN", max_length=80)
    citations: list[dict[str, str]] = Field(default_factory=list, max_length=10)

    @field_validator("summary", "recommendation", "claimed_sender", "official_domain", "official_portal_url", "claim_verdict_explanation", "lure_type", "authenticity_status")
    @classmethod
    def clean_sms_scalar(cls, value: str) -> str:
        return _clean_text(value, 600)

    @field_validator("reasons", "limitations", "action_plan_steps")
    @classmethod
    def clean_sms_lists(cls, values: list[str]) -> list[str]:
        return [_clean_text(item, 300) for item in values if _clean_text(item, 300)]

    @field_validator("citations")
    @classmethod
    def clean_sms_citation_list(cls, values: list[dict[str, str]]) -> list[dict[str, str]]:
        return _clean_citations(values)


def validate_gemini_payload(payload: Any, *, fallback: dict[str, Any]) -> dict[str, Any]:
    """Validate model data and return only the allow-listed schema fields."""
    try:
        parsed = GeminiExplanation.model_validate(payload)
        if _contains_numeric_percentage(parsed):
            raise ValueError("uncalibrated numeric percentage in explanation")
        return parsed.model_dump()
    except Exception:
        safe_fallback = {
            "classification": fallback.get("classification", "UNKNOWN"),
            "summary": fallback.get("summary", "تعذر التحقق من تفسير الذكاء الاصطناعي."),
            "reasons": fallback.get("reasons", []),
            "recommendation": fallback.get("recommendation", "توخ الحذر وتحقق من المصدر."),
            "limitations": ["تم استخدام التفسير المحلي لأن مخرجات مزود الذكاء الاصطناعي غير صالحة."],
            "claimed_sender": "غير محددة",
            "official_domain": "غير متاح",
            "official_portal_url": "غير متاح",
            "lure_type": "غير محدد",
            "authenticity_status": "UNKNOWN",
            "citations": [],
            "provider": "LOCAL_SCHEMA_FALLBACK",
            "provider_status": "FALLBACK",
            "fallback_reason": "SCHEMA_INVALID",
        }
        result = GeminiExplanation.model_validate(safe_fallback).model_dump()
        result.update({key: safe_fallback[key] for key in ("provider", "provider_status", "fallback_reason")})
        return result


def validate_gemini_sms_payload(payload: Any, *, fallback: dict[str, Any]) -> dict[str, Any]:
    """Validate SMS output; invalid provider output falls back without raw text."""
    try:
        parsed = GeminiSMSAnalysis.model_validate(payload)
        if _contains_numeric_percentage(parsed):
            raise ValueError("uncalibrated numeric percentage in SMS analysis")
        return parsed.model_dump()
    except Exception:
        safe_fallback = {
            "classification": fallback.get("classification", "UNKNOWN"),
            "summary": fallback.get("summary", "تعذر التحقق من تحليل الرسالة."),
            "reasons": fallback.get("reasons", []),
            "recommendation": fallback.get("recommendation", "تحقق من المصدر عبر قناة رسمية مستقلة."),
            "limitations": ["استخدم النظام نتيجة احتياطية لأن مخرجات مزود الذكاء الاصطناعي لم تجتز التحقق."],
            "claimed_sender": fallback.get("claimed_sender", "غير محددة"),
            "official_domain": fallback.get("official_domain", "غير متاح"),
            "official_portal_url": fallback.get("official_portal_url", "غير متاح"),
            "claim_verdict_explanation": fallback.get("claim_verdict_explanation", ""),
            "action_plan_steps": fallback.get("action_plan_steps", []),
            "lure_type": fallback.get("lure_type", "غير محدد"),
            "authenticity_status": fallback.get("authenticity_status", "UNKNOWN"),
            "citations": [],
        }
        result = GeminiSMSAnalysis.model_validate(safe_fallback).model_dump()
        result["provider"] = "LOCAL_SCHEMA_FALLBACK"
        result["provider_status"] = "FALLBACK"
        result["fallback_reason"] = "SCHEMA_INVALID"
        return result
