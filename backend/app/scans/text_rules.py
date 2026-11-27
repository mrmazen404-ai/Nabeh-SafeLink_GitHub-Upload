"""Conservative, non-probabilistic indicators for SMS/text fallback analysis.

These rules can raise a message to SUSPICIOUS when concrete risky behavior is
present. Absence of a match is UNKNOWN, never proof of a safe message.
"""

from __future__ import annotations

import re

_CREDENTIAL_REQUEST = re.compile(
    r"(?:أدخل|ادخل|أرسل|ارسل|شارك|زوّد|زود|قدّم|قدم|اكتب|provide|submit|share|send|enter|type)"
    r".{0,45}(?:رمز(?:\s+التحقق)?|otp|one.time.password|verification\s+code|"
    r"كلمة\s+المرور|كلمة\s+السر|الرقم\s+السري|بيانات\s+(?:الدخول|البطاقة|البنك)|"
    r"card\s+(?:number|details)|bank\s+details|credentials)",
    re.IGNORECASE | re.DOTALL,
)
_NEGATED_CREDENTIAL_REQUEST = re.compile(
    r"(?:لا|لن|لا\s+تق[مومي]|never|do\s+not|don't|dont)\s*"
    r"(?:تُ?رسل|ترسل|أرسل|ارسل|تشارك|شارك|تدخل|أدخل|ادخل|تكتب|اكتب|"
    r"share|send|enter|provide|submit|type)"
    r".{0,45}(?:رمز|otp|one.time.password|verification\s+code|كلمة\s+المرور|"
    r"كلمة\s+السر|الرقم\s+السري|بيانات|card\s+(?:number|details)|credentials)",
    re.IGNORECASE | re.DOTALL,
)
_URGENCY = re.compile(
    r"(?:عاجل|فوراً|فورا|حالاً|حالا|الآن|خلال\s+(?:\d+|ساعة|ساعتين|24)\s*"
    r"(?:دقيقة|دقائق|ساعة|ساعات|يوم)?|مهلة|immediately|urgent|act\s+now|"
    r"within\s+(?:\d+\s+)?(?:hours?|minutes?|24\s+hours?)|today)",
    re.IGNORECASE,
)
_ACCOUNT_THREAT = re.compile(
    r"(?:حساب(?:ك|كم)?|account).{0,45}(?:تجميد|موقوف|إيقاف|ايقاف|تعليق|إغلاق|مغلق|"
    r"suspend(?:ed)?|locked|deactivat(?:ed|ion))|"
    r"(?:تجميد|إيقاف|ايقاف|تعليق|إغلاق).{0,45}(?:حسابك|حساب|account)",
    re.IGNORECASE | re.DOTALL,
)


def analyze_message_indicators(text: str, *, has_embedded_url: bool = False) -> dict:
    """Return bounded behavioral indicators; never infer SAFE from no match."""
    value = (text or "")[:4096]
    credential_request = bool(_CREDENTIAL_REQUEST.search(value)) and not bool(
        _NEGATED_CREDENTIAL_REQUEST.search(value)
    )
    urgency = bool(_URGENCY.search(value))
    account_threat = bool(_ACCOUNT_THREAT.search(value))

    # A link by itself, a greeting, a brand name, or a generic keyword is not a
    # phishing verdict. Explicit credential collection is enough for caution;
    # threats/urgency need context (a link or a matching coercive claim).
    suspicious = credential_request or (account_threat and (has_embedded_url or urgency))
    indicators = []
    if credential_request:
        indicators.append("credential_request")
    if urgency:
        indicators.append("urgency_language")
    if account_threat:
        indicators.append("account_threat")
    if has_embedded_url:
        indicators.append("embedded_url_present")

    return {
        "classification": "SUSPICIOUS" if suspicious else "UNKNOWN",
        "confidence": None,
        "fraud_probability": None,
        "indicators": indicators,
    }
