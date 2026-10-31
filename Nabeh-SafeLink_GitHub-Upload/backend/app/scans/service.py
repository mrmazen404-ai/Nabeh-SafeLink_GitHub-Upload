"""Scan processing with strict guest isolation and explicit UNKNOWN outcomes."""

import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

from app.db.supabase_client import supabase
from app.observability import elapsed_ms, log_event, resource_id, safe_error
from app.gemini.client import generate_explanation, analyze_sms_message
from app.ml.predictor import predict_url
from app.virustotal.client import check_url_virustotal
from app.dashboard.realtime import manager
from app.config import settings
from app.public.metrics import record_platform_scan_metric
from app.system_settings import setting_enabled_fail_closed
from app.scans.text_rules import analyze_message_indicators

logger = logging.getLogger(__name__)
MAX_EMBEDDED_URLS = 5

ARABIC_PHISHING_KEYWORDS = (
    "حسابك", "البنك", "تجميد", "تحديث", "كلمة المرور", "بطاقة", "جائزة",
    "مبروك", "الفوز", "رمز", "إيقاف", "الراجحي", "الأهلي", "الإنماء",
    "سداد", "غرامة", "ربح", "تأكيد", "انقر", "اضغط",
)


class ScanPersistenceError(Exception):
    """Raised when a registered user's scan cannot be persisted completely."""


class ScanService:
    @staticmethod
    def extract_urls_from_text(text: str) -> list[str]:
        if not text:
            return []
        explicit_pattern = re.compile(r"(?:https?://|www\.)[^\s,;،؛؟۔\"'<>]+", re.IGNORECASE)
        tld_pattern = (
            r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+"
            r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
            r"(?:/[^\s,;،؛؟۔\"'<>()]*)?"
        )
        explicit_matches = list(explicit_pattern.finditer(text))
        spans = [(match.start(), match.end()) for match in explicit_matches]
        matches = [(match.start(), match.group(0)) for match in explicit_matches]
        for match in re.finditer(tld_pattern, text, re.IGNORECASE):
            if any(start <= match.start() < end for start, end in spans):
                continue
            matches.append((match.start(), match.group(0)))

        urls = []
        seen = set()
        for _, candidate in sorted(matches, key=lambda item: item[0]):
            candidate = candidate.rstrip(".,;:!?')")
            normalized = candidate if candidate.lower().startswith(("http://", "https://")) else f"https://{candidate}"
            parsed = urlsplit(normalized)
            key = (
                parsed.scheme.lower(),
                parsed.netloc.lower(),
                parsed.path or "/",
                parsed.query,
                parsed.fragment,
            )
            if candidate and key not in seen:
                seen.add(key)
                urls.append(candidate)
        return urls

    @staticmethod
    def extract_url_from_text(text: str) -> str:
        """Backward-compatible first-URL accessor for callers expecting a scalar."""
        urls = ScanService.extract_urls_from_text(text)
        return urls[0] if urls else ""

    @staticmethod
    def analyze_text_phishing(text: str, has_embedded_url: bool = False) -> dict:
        signals = analyze_message_indicators(text, has_embedded_url=has_embedded_url)
        text_lower = (text or "").lower()
        matches = [word for word in ARABIC_PHISHING_KEYWORDS if word in text_lower or word in (text or "")]
        return {
            **signals,
            "keyword_matches": matches,
            "match_count": len(matches),
            "source": "SMS_TEXT_INDICATORS",
        }

    @staticmethod
    def _merge_text_signal(combined: dict, text_result: dict) -> dict:
        text_class = text_result.get("classification")
        if text_class in {"DANGEROUS", "SUSPICIOUS"} and combined.get("classification") in {"SAFE", "UNKNOWN"}:
            return {
                "classification": text_class,
                "confidence": text_result.get("confidence"),
                "weighted_score": combined.get("weighted_score"),
                "source": "LOCAL_TEXT_RULES + URL_ANALYSIS",
            }
        return combined

    @staticmethod
    def _enforce_text_safety_floor(combined: dict, text_rules: dict, ai_result: dict) -> dict:
        """AI may increase a risk verdict but cannot downgrade deterministic evidence."""
        rank = {"SAFE": 0, "UNKNOWN": 1, "SUSPICIOUS": 2, "DANGEROUS": 3}
        evidence = [combined or {}, text_rules or {}]
        baseline = max(
            (item for item in evidence if str(item.get("classification", "UNKNOWN")).upper() in rank),
            key=lambda item: rank[str(item.get("classification", "UNKNOWN")).upper()],
            default={"classification": "UNKNOWN", "confidence": None},
        )
        ai = dict(ai_result or {})
        ai_class = str(ai.get("classification", "UNKNOWN")).upper()
        base_class = str(baseline.get("classification", "UNKNOWN")).upper()
        if ai_class not in rank:
            ai_class = "UNKNOWN"
        if rank[ai_class] < rank[base_class]:
            ai["classification"] = base_class
            ai["confidence"] = baseline.get("confidence")
        else:
            ai["classification"] = ai_class
            try:
                ai_confidence = float(ai.get("confidence"))
            except (TypeError, ValueError):
                ai_confidence = 0.0
            try:
                evidence_confidence = float(baseline.get("confidence"))
            except (TypeError, ValueError):
                evidence_confidence = 0.0
            ai["confidence"] = max(0.0, min(1.0, max(ai_confidence, evidence_confidence)))
        return ai

    @staticmethod
    def combine_scan_results(vt_result: dict, ml_result: dict) -> dict:
        """Combine 3-Stage Scan Results (Stage 1: ML, Stage 2: VirusTotal) into an accurate verdict.

        Core security principle: ML alone is NEVER sufficient for DANGEROUS classification.
        DANGEROUS requires either:
          (a) VirusTotal with 3+ malicious engines, OR
          (b) VirusTotal with 1-2 malicious AND ML corroboration (high confidence)
        """
        vt_result = vt_result or {}
        ml_result = ml_result or {}
        vt_status = str(vt_result.get("status", "UNKNOWN")).upper()

        try:
            vt_malicious = max(0, int(vt_result.get("malicious", 0) or 0))
            vt_suspicious = max(0, int(vt_result.get("suspicious", 0) or 0))
            vt_harmless = max(0, int(vt_result.get("harmless", 0) or 0))
            vt_total = max(0, int(vt_result.get("total_engines", 0) or 0))
        except (TypeError, ValueError):
            vt_malicious = vt_suspicious = vt_harmless = vt_total = 0
            vt_status = "UNKNOWN"

        vt_counts_consistent = vt_total > 0 and (vt_malicious + vt_suspicious + vt_harmless) <= vt_total
        vt_status_consistent = not (
            (vt_status == "SAFE" and (vt_malicious > 0 or vt_suspicious > 0))
            or (vt_status == "SUSPICIOUS" and vt_malicious == 0 and vt_suspicious == 0)
            or (vt_status == "DANGEROUS" and vt_malicious == 0)
        )
        has_vt = (
            vt_counts_consistent
            and vt_status_consistent
            and vt_status in {"SAFE", "SUSPICIOUS", "DANGEROUS"}
        )

        ml_class = str(ml_result.get("classification", "UNKNOWN")).upper()
        ml_prob = ml_result.get("phishing_prob")
        try:
            ml_prob = float(ml_prob)
            has_ml = ml_class in {"SAFE", "SUSPICIOUS", "DANGEROUS"} and 0.0 <= ml_prob <= 1.0
        except (TypeError, ValueError):
            ml_prob, has_ml = None, False

        # ═══════════════════════════════════════════════════════════════════
        # TIER 1: DANGEROUS — requires STRONG evidence
        # ═══════════════════════════════════════════════════════════════════

        # Rule 1a: VirusTotal strong consensus (3+ engines flag as malicious)
        if has_vt and vt_malicious >= 3:
            # Confidence scales with # of engines
            confidence = min(0.99, 0.85 + (vt_malicious - 3) * 0.02)
            return {
                "classification": "DANGEROUS",
                "confidence": round(confidence, 4),
                "weighted_score": 1.0,
                "source": f"VIRUSTOTAL_CONSENSUS ({vt_malicious} engines)",
            }

        # Rule 1b: VirusTotal moderate (1-2) + ML corroboration at high confidence
        if has_vt and vt_malicious >= 1 and has_ml and ml_class == "DANGEROUS" and ml_prob >= 0.85:
            # Two independent signals agree
            confidence = min(0.95, 0.75 + (ml_prob - 0.85) * 1.5)
            return {
                "classification": "DANGEROUS",
                "confidence": round(confidence, 4),
                "weighted_score": round(ml_prob, 4),
                "source": f"DANGEROUS_CORROBORATED (VT:{vt_malicious} + ML:{ml_prob:.2f})",
            }

        # ═══════════════════════════════════════════════════════════════════
        # TIER 2: SUSPICIOUS — moderate evidence
        # ═══════════════════════════════════════════════════════════════════

        # Rule 2a: VirusTotal has malicious OR multiple suspicious signals
        if has_vt and (vt_malicious >= 1 or vt_suspicious >= 2):
            return {
                "classification": "SUSPICIOUS",
                "confidence": 0.65,
                "weighted_score": float(ml_prob or 0.5),
                "source": f"VIRUSTOTAL_SIGNAL (M:{vt_malicious}, S:{vt_suspicious})",
            }

        # Rule 2b: ML strong signal alone → maximum SUSPICIOUS (never DANGEROUS)
        if has_ml and ml_class == "DANGEROUS" and ml_prob >= 0.60:
            return {
                "classification": "SUSPICIOUS",
                "confidence": round(min(0.75, ml_prob * 0.9), 4),
                "weighted_score": round(ml_prob, 4),
                "source": "ML_SIGNAL_ONLY",
            }

        # Rule 2c: ML suspicious signal
        if has_ml and ml_class == "SUSPICIOUS":
            return {
                "classification": "SUSPICIOUS",
                "confidence": round(float(ml_prob or 0.55) * 0.8, 4),
                "weighted_score": round(float(ml_prob or 0.5), 4),
                "source": "ML_SUSPICIOUS_SIGNAL",
            }

        # ═══════════════════════════════════════════════════════════════════
        # TIER 3: SAFE — requires positive evidence from both sources
        # ═══════════════════════════════════════════════════════════════════

        # Rule 3a: Both VT and ML agree on SAFE
        if has_vt and has_ml and vt_status == "SAFE" and ml_class == "SAFE":
            # Confidence = average of both
            vt_conf = float(vt_result.get("confidence") or 0.85)
            ml_conf = 1.0 - ml_prob  # phishing_prob = 0 → confidence = 1
            confidence = min(0.95, (vt_conf + ml_conf) / 2)
            return {
                "classification": "SAFE",
                "confidence": round(confidence, 4),
                "weighted_score": round(ml_prob, 4),
                "source": "HYBRID_CONSENSUS_SAFE",
            }

        # ═══════════════════════════════════════════════════════════════════
        # TIER 4: Hybrid weighted score (fallback for edge cases)
        # ═══════════════════════════════════════════════════════════════════
        if has_vt and has_ml:
            vt_score = min(1.0, (vt_malicious + (vt_suspicious * 0.5)) / max(1.0, vt_total * 0.10))
            score = (0.55 * vt_score) + (0.45 * ml_prob)

            # The weighted fallback is not a calibrated proof threshold. It may
            # only raise caution; DANGEROUS requires the explicit rules above,
            # and SAFE requires positive agreement from a rule above.
            classification = "SUSPICIOUS" if score >= 0.40 else "UNKNOWN"

            # Confidence reflects the score, but never reaches 0.99 from weighted alone
            if classification == "UNKNOWN":
                confidence = None
            else:
                confidence = round(min(0.88, 0.60 + score * 0.3), 4)

            return {
                "classification": classification,
                "confidence": round(confidence, 4) if confidence is not None else None,
                "weighted_score": round(score, 4),
                "source": "HYBRID_WEIGHTED",
            }

        # ═══════════════════════════════════════════════════════════════════
        # TIER 5: Insufficient evidence → UNKNOWN (never fabricate)
        # ═══════════════════════════════════════════════════════════════════
        return {
            "classification": "UNKNOWN",
            "confidence": None,
            "weighted_score": None,
            "source": "INSUFFICIENT_EVIDENCE",
        }

    @staticmethod
    def _local_explanation(classification: str, language: str) -> dict:
        english = language == "en"
        text = {
            "SAFE": ("لم تظهر مؤشرات خطر في التحليل المحلي." if not english else "No risk indicators were found by local analysis."),
            "SUSPICIOUS": ("ظهرت مؤشرات تستدعي الحذر والتحقق من المصدر." if not english else "Indicators require caution and source verification."),
            "DANGEROUS": ("ظهرت مؤشرات خطر قوية؛ لا تفتح الرابط ولا تشارك بياناتك." if not english else "Strong risk indicators were found; do not open or share data."),
            "UNKNOWN": ("تعذر التحقق محلياً؛ لا تعتبر النتيجة آمنة." if not english else "Local verification was inconclusive; do not treat this as safe."),
        }.get(classification, "تعذر التحقق محلياً.")
        recommendation = {
            "SAFE": "تابع بحذر." if not english else "Continue cautiously.",
            "SUSPICIOUS": "تحقق من المصدر قبل التفاعل." if not english else "Verify the source before interacting.",
            "DANGEROUS": "تجنب فتح الرابط أو إدخال بياناتك." if not english else "Avoid opening the link or entering data.",
            "UNKNOWN": "أعد المحاولة لاحقاً أو تحقق عبر مصدر موثوق." if not english else "Try again later or verify with a trusted source.",
        }.get(classification, "توخ الحذر." if not english else "Exercise caution.")
        return {"summary": text, "reasons": [], "recommendation": recommendation, "provider": "LOCAL_RULES"}

    @classmethod
    def _local_sms_fallback(cls, text_content: str, extracted_url: str, combined: dict, language: str, provider: str) -> dict:
        text_result = cls.analyze_text_phishing(text_content, bool(extracted_url))
        rank = {"SAFE": 0, "UNKNOWN": 1, "SUSPICIOUS": 2, "DANGEROUS": 3}
        candidates = [text_result.get("classification", "UNKNOWN")]
        if extracted_url:
            candidates.append(combined.get("classification", "UNKNOWN"))
        classification = max(
            (str(item).upper() for item in candidates if str(item).upper() in rank),
            key=lambda item: rank[item],
            default="UNKNOWN",
        )
        explanation = cls._local_explanation(classification, language)
        explanation.update({
            "classification": classification,
            "confidence": None,
            "fraud_probability": None,
            "urgency_pressure_score": None,
            "credential_theft_score": None,
            "identity_spoofing_score": None,
            "lure_type": "إشارات تستدعي الحذر" if classification == "SUSPICIOUS" and language == "ar" else "Indicators require caution" if classification == "SUSPICIOUS" else "غير محسوم" if language == "ar" else "Inconclusive",
            "authenticity_status": "غير متحقق" if language == "ar" else "Unverified",
            "limitations": ["القواعد المحلية لا تثبت سلامة الرسالة أو هوية مرسلها." if language == "ar" else "Local rules cannot verify message safety or sender identity."],
            "provider": provider,
        })
        if text_result.get("indicators"):
            explanation["reasons"] = [
                ("إشارات مرصودة: " if language == "ar" else "Observed signals: ") + ", ".join(text_result["indicators"])
            ]
        return explanation

    @classmethod
    async def process_url_scan(cls, target_url: str, language: str = "ar") -> dict:
        """Standalone 3-Stage URL Link Scanner (ML -> VirusTotal -> Gemini Research)."""
        operation_id = resource_id(target_url)
        started = time.perf_counter()
        log_event(logger, logging.INFO, "scan_started", operation_id=operation_id, input_type="URL", mode="url")
        deadline = asyncio.get_running_loop().time() + settings.SCAN_TOTAL_TIMEOUT_SECONDS
        ml_started = time.perf_counter()
        log_event(logger, logging.INFO, "scan_ml_started", operation_id=operation_id, provider="ML_MODEL", mode="url")
        try:
            ml_result = predict_url(target_url)
            log_event(logger, logging.INFO, "scan_ml_succeeded", operation_id=operation_id, provider="ML_MODEL", classification=ml_result.get("classification"), duration_ms=elapsed_ms(ml_started))
        except Exception as error:
            log_event(logger, logging.ERROR, "scan_ml_failed", operation_id=operation_id, provider="ML_MODEL", error_type=safe_error(error), error_code="MODEL_ERROR", duration_ms=elapsed_ms(ml_started))
            ml_result = {"classification": "UNKNOWN", "confidence": None, "source": "ML_ERROR"}

        vt_started = time.perf_counter()
        log_event(logger, logging.INFO, "scan_virustotal_started", operation_id=operation_id, provider="VIRUSTOTAL", mode="url")
        try:
            remaining = max(0.0, deadline - asyncio.get_running_loop().time())
            vt_result = await asyncio.wait_for(check_url_virustotal(target_url), timeout=remaining)
        except asyncio.TimeoutError:
            log_event(logger, logging.WARNING, "scan_virustotal_timeout", operation_id=operation_id, provider="VIRUSTOTAL", error_code="SCAN_DEADLINE_EXCEEDED", duration_ms=elapsed_ms(vt_started))
            vt_result = {"status": "UNKNOWN", "error": "SCAN_DEADLINE_EXCEEDED"}
        except Exception as error:
            log_event(logger, logging.ERROR, "scan_virustotal_failed", operation_id=operation_id, provider="VIRUSTOTAL", error_type=safe_error(error), error_code="VIRUSTOTAL_NETWORK_ERROR", duration_ms=elapsed_ms(vt_started))
            vt_result = {"status": "UNKNOWN", "error": "VIRUSTOTAL_UNAVAILABLE"}
        else:
            log_event(logger, logging.INFO, "scan_virustotal_succeeded", operation_id=operation_id, provider="VIRUSTOTAL", status=vt_result.get("status"), malicious=vt_result.get("malicious", 0), suspicious=vt_result.get("suspicious", 0), total_engines=vt_result.get("total_engines", 0), duration_ms=elapsed_ms(vt_started))

        combined = cls.combine_scan_results(vt_result, ml_result)
        log_event(logger, logging.INFO, "scan_fusion_completed", operation_id=operation_id, provider="LOCAL_RULES", classification=combined.get("classification"), source=combined.get("source"))
        combined["evidence"] = {"ml": ml_result, "virustotal": vt_result, "input_type": "URL"}

        remaining = max(0.0, deadline - asyncio.get_running_loop().time())
        try:
            ai_enabled = await asyncio.wait_for(
                asyncio.to_thread(setting_enabled_fail_closed, "features.ai_explanations_enabled"), timeout=remaining
            )
        except asyncio.TimeoutError:
            ai_enabled = False
            logger.warning("scan_total_deadline_settings")
        if not ai_enabled:
            explanation = cls._local_explanation(combined["classification"], language)
            explanation["provider"] = "LOCAL_FEATURE_DISABLED"
            log_event(logger, logging.WARNING, "scan_fallback_selected", operation_id=operation_id, provider="LOCAL_RULES", fallback_reason="AI_FEATURE_DISABLED")
        else:
            try:
                explanation = await asyncio.wait_for(
                    generate_explanation(
                        input_value=target_url,
                        classification=combined["classification"],
                        evidence=combined.get("evidence", {}),
                        language=language,
                    ),
                    timeout=max(0.0, min(settings.SCAN_AI_TIMEOUT_SECONDS, deadline - asyncio.get_running_loop().time())),
                )
            except asyncio.TimeoutError:
                log_event(logger, logging.WARNING, "scan_gemini_timeout", operation_id=operation_id, provider="GEMINI", error_code="GEMINI_TIMEOUT")
                explanation = cls._local_explanation(combined["classification"], language)
                explanation["provider"] = "LOCAL_TIMEOUT_FALLBACK"
            except Exception as error:
                log_event(logger, logging.WARNING, "scan_gemini_failed", operation_id=operation_id, provider="GEMINI", error_type=safe_error(error), error_code="GEMINI_PROVIDER_ERROR")
                explanation = cls._local_explanation(combined["classification"], language)
                explanation["provider"] = "LOCAL_ERROR_FALLBACK"

        log_event(logger, logging.INFO, "scan_succeeded", operation_id=operation_id, classification=combined["classification"], provider=explanation.get("provider"), duration_ms=elapsed_ms(started), mode="url")

        return {
            "scan_kind": "URL_LINK",
            "input_type": "URL",
            "input_value": target_url,
            "extracted_url": target_url,
            "classification": combined["classification"],
            "confidence": None,
            "source": combined["source"],
            "stages": {
                "stage1_ml": {
                    "name": "Stage 1: LightGBM ML Model Analysis",
                    "classification": ml_result.get("classification", "UNKNOWN"),
                    "confidence": None,
                    "phishing_prob": None,
                    "source": ml_result.get("source", "N/A"),
                },
                "stage2_virustotal": {
                    "name": "Stage 2: VirusTotal Engine Intelligence",
                    "status": vt_result.get("status", "UNKNOWN"),
                    "malicious": vt_result.get("malicious", 0),
                    "suspicious": vt_result.get("suspicious", 0),
                    "harmless": vt_result.get("harmless", 0),
                    "total_engines": vt_result.get("total_engines", 0),
                },
                "stage3_gemini": {
                    "name": "Stage 3: Gemini AI URL Threat Research",
                    "provider": explanation.get("provider", "LOCAL_RULES"),
                    "classification": explanation.get("classification", "UNKNOWN"),
                    "summary": explanation.get("summary", ""),
                    "recommendation": explanation.get("recommendation", ""),
                },
            },
            "explanation": explanation,
            "virustotal": vt_result,
            "ml_model": {
                "classification": ml_result.get("classification", "UNKNOWN"),
                "confidence": None,
                "phishing_prob": None,
                "source": ml_result.get("source", "N/A"),
            },
        }

    @classmethod
    async def process_text_scan(cls, text_content: str, language: str = "ar") -> dict:
        """100% AI-Driven SMS / Text Message Smishing Scanner (Gemini AI API + Link Audit Pipeline)."""
        operation_id = resource_id(text_content)
        started = time.perf_counter()
        log_event(logger, logging.INFO, "scan_started", operation_id=operation_id, input_type="TEXT", mode="sms")
        deadline = asyncio.get_running_loop().time() + settings.SCAN_TOTAL_TIMEOUT_SECONDS
        all_extracted_urls = cls.extract_urls_from_text(text_content)
        extracted_urls = all_extracted_urls[:MAX_EMBEDDED_URLS]
        unscanned_url_count = max(0, len(all_extracted_urls) - len(extracted_urls))
        log_event(logger, logging.INFO, "scan_validation_succeeded", operation_id=operation_id, input_type="TEXT", mode="sms", links_detected=len(all_extracted_urls), links_scanned=len(extracted_urls))
        extracted_url = extracted_urls[0] if extracted_urls else ""
        semaphore = asyncio.Semaphore(2)

        async def analyze_embedded_url(url: str) -> dict:
            try:
                ml = await asyncio.to_thread(predict_url, url)
            except Exception:
                log_event(logger, logging.ERROR, "scan_ml_failed", operation_id=operation_id, provider="ML_MODEL", error_code="MODEL_ERROR")
                ml = {"classification": "UNKNOWN", "confidence": None, "source": "ML_ERROR"}

            async with semaphore:
                remaining = max(0.0, deadline - asyncio.get_running_loop().time())
                if remaining <= 0:
                    vt = {"status": "UNKNOWN", "error": "SCAN_DEADLINE_EXCEEDED"}
                else:
                    try:
                        vt = await asyncio.wait_for(
                            check_url_virustotal(url), timeout=min(8.0, remaining)
                        )
                    except asyncio.TimeoutError:
                        log_event(logger, logging.WARNING, "scan_virustotal_timeout", operation_id=operation_id, provider="VIRUSTOTAL", error_code="SCAN_DEADLINE_EXCEEDED")
                        vt = {"status": "UNKNOWN", "error": "SCAN_DEADLINE_EXCEEDED"}
                    except Exception as error:
                        log_event(logger, logging.ERROR, "scan_virustotal_failed", operation_id=operation_id, provider="VIRUSTOTAL", error_type=safe_error(error), error_code="VIRUSTOTAL_NETWORK_ERROR")
                        vt = {"status": "UNKNOWN", "error": "VIRUSTOTAL_UNAVAILABLE"}
            return {"url": url, "ml": ml, "virustotal": vt, "combined": cls.combine_scan_results(vt, ml)}

        embedded_url_analyses = await asyncio.gather(
            *(analyze_embedded_url(url) for url in extracted_urls)
        )
        selected_url = None
        if embedded_url_analyses:
            rank = {"SAFE": 0, "UNKNOWN": 1, "SUSPICIOUS": 2, "DANGEROUS": 3}
            strongest = max(
                embedded_url_analyses,
                key=lambda item: rank.get(str(item["combined"].get("classification", "UNKNOWN")).upper(), 1),
            )
            combined = dict(strongest["combined"])
            selected_url = strongest["url"]
            if unscanned_url_count and combined.get("classification") == "SAFE":
                combined.update(classification="UNKNOWN", confidence=None, source="PARTIAL_LINK_ANALYSIS")
            elif len(embedded_url_analyses) > 1:
                combined["source"] = "MULTIPLE_EMBEDDED_URLS"
            # Keep public evidence aligned with the URL that produced the
            # strongest verdict. Using the first URL here could contradict the
            # final classification when a later embedded URL was dangerous.
            vt_result = strongest["virustotal"]
            ml_result = strongest["ml"]
        else:
            combined = {
                "classification": "UNKNOWN",
                "confidence": None,
                "weighted_score": None,
                "source": "TEXT_ONLY",
            }
            vt_result = {"status": "NOT_APPLICABLE", "total_engines": 0}
            ml_result = {"classification": "UNKNOWN", "source": "NOT_APPLICABLE"}

        evidence = {
            "ml": ml_result,
            "virustotal": vt_result,
            "input_type": "TEXT",
            "extracted_url": extracted_url,
            "selected_url": selected_url,
            "embedded_url_analyses": [
                {
                    "url": item["url"],
                    "classification": item["combined"].get("classification", "UNKNOWN"),
                    "source": item["combined"].get("source", "UNKNOWN"),
                    "ml": item["ml"],
                    "virustotal": item["virustotal"],
                }
                for item in embedded_url_analyses
            ],
            "unscanned_url_count": unscanned_url_count,
            "url_combined_verdict": combined,
        }

        # Gemini is optional and can be disabled centrally without disabling local analysis.
        remaining = max(0.0, deadline - asyncio.get_running_loop().time())
        try:
            ai_enabled = await asyncio.wait_for(
                asyncio.to_thread(setting_enabled_fail_closed, "features.ai_explanations_enabled"), timeout=remaining
            )
        except asyncio.TimeoutError:
            ai_enabled = False
            logger.warning("scan_total_deadline_settings")
        if not ai_enabled:
            ai_analysis = cls._local_sms_fallback(
                text_content, selected_url or extracted_url, combined, language, "LOCAL_FEATURE_DISABLED"
            )
            log_event(logger, logging.WARNING, "scan_gemini_fallback_selected", operation_id=operation_id, provider="LOCAL_RULES", fallback_reason="AI_FEATURE_DISABLED", mode="sms")
        else:
            try:
                ai_analysis = await asyncio.wait_for(
                    analyze_sms_message(
                        text_content=text_content,
                        extracted_url=selected_url or extracted_url,
                        evidence=evidence,
                        language=language,
                    ),
                    timeout=max(0.0, min(settings.SCAN_AI_TIMEOUT_SECONDS, deadline - asyncio.get_running_loop().time())),
                )
            except asyncio.TimeoutError:
                log_event(logger, logging.WARNING, "scan_gemini_timeout", operation_id=operation_id, provider="GEMINI", error_code="GEMINI_TIMEOUT", mode="sms")
                ai_analysis = cls._local_sms_fallback(
                    text_content, selected_url or extracted_url, combined, language, "LOCAL_TIMEOUT_FALLBACK"
                )
            except Exception as error:
                log_event(logger, logging.WARNING, "scan_gemini_failed", operation_id=operation_id, provider="GEMINI", error_type=safe_error(error), error_code="GEMINI_PROVIDER_ERROR", mode="sms")
                ai_analysis = cls._local_sms_fallback(
                    text_content, selected_url or extracted_url, combined, language, "LOCAL_ERROR_FALLBACK"
                )

        local_text = cls.analyze_text_phishing(text_content, bool(extracted_url))
        ai_class = str(ai_analysis.get("classification", "UNKNOWN")).upper()
        if ai_class == "SAFE":
            # Clean text/link signals cannot authenticate the SMS sender or claim.
            ai_analysis["classification"] = "UNKNOWN"
            ai_analysis["confidence"] = None
            ai_analysis["fraud_probability"] = None
            ai_analysis["authenticity_status"] = "غير متحقق" if language == "ar" else "Unverified"
            ai_analysis.setdefault("reasons", []).append(
                "فحص الرابط أو غياب المؤشرات لا يثبت أصالة الرسالة أو هوية مرسلها." if language == "ar" else "A clean link or absent indicators cannot verify the SMS sender or authenticity."
            )
            ai_class = "UNKNOWN"
        if ai_class == "DANGEROUS" and combined.get("classification") != "DANGEROUS":
            # An LLM-only SMS judgment is insufficient for the highest-severity label.
            ai_analysis["classification"] = "SUSPICIOUS"
            ai_analysis["confidence"] = None
            ai_analysis["fraud_probability"] = None
            ai_analysis["authenticity_status"] = "غير متحقق" if language == "ar" else "Unverified"
            ai_analysis.setdefault("reasons", []).append(
                "لم يُرفع الحكم إلى خطير اعتماداً على Gemini وحده." if language == "ar" else "Gemini alone cannot establish a dangerous verdict."
            )
        safety_evidence = combined if extracted_url else local_text
        if str(safety_evidence.get("classification", "UNKNOWN")).upper() == "SAFE":
            safety_evidence = {**safety_evidence, "classification": "UNKNOWN", "confidence": None}
        ai_analysis = cls._enforce_text_safety_floor(safety_evidence, local_text, ai_analysis)
        classification = ai_analysis.get("classification", combined.get("classification", "UNKNOWN"))
        # This SMS task has no independently calibrated probability model.
        confidence = None
        fraud_prob = None
        log_event(logger, logging.INFO, "scan_succeeded", operation_id=operation_id, input_type="TEXT", mode="sms", classification=classification, provider=ai_analysis.get("provider"), links_scanned=len(embedded_url_analyses), links_not_scanned=unscanned_url_count, duration_ms=elapsed_ms(started))

        explanation = {
            "summary": ai_analysis.get("summary", ""),
            "reasons": ai_analysis.get("reasons", []),
            "recommendation": ai_analysis.get("recommendation", ""),
            "provider": ai_analysis.get("provider", "GEMINI_AI"),
            "claimed_sender": ai_analysis.get("claimed_sender", "جهة غير محددة"),
            "official_domain": ai_analysis.get("official_domain", "غير متاح"),
            "official_portal_url": ai_analysis.get("official_portal_url", "غير متاح"),
            "claim_verdict_explanation": ai_analysis.get("claim_verdict_explanation", ""),
            "action_plan_steps": ai_analysis.get("action_plan_steps", []),
            "lure_type": ai_analysis.get("lure_type", "غير محدد"),
            "authenticity_status": ai_analysis.get("authenticity_status", "غير متحقق" if language == "ar" else "Unverified"),
            "limitations": ai_analysis.get("limitations", []),
            "fraud_probability": fraud_prob,
            "urgency_pressure_score": None,
            "credential_theft_score": None,
            "identity_spoofing_score": None,
        }

        return {
            "scan_kind": "SMS_TEXT",
            "input_type": "TEXT",
            "input_value": text_content,
            "extracted_url": extracted_url or None,
            "selected_url": selected_url,
            "extracted_urls": all_extracted_urls,
            "links_scanned_count": len(embedded_url_analyses),
            "links_not_scanned_count": unscanned_url_count,
            "embedded_url_analyses": [
                {
                    "url": item["url"],
                    "classification": item["combined"].get("classification", "UNKNOWN"),
                    "source": item["combined"].get("source", "UNKNOWN"),
                    "ml_classification": item["ml"].get("classification", "UNKNOWN"),
                    "ml_source": item["ml"].get("source", "N/A"),
                    "virustotal": item["virustotal"],
                }
                for item in embedded_url_analyses
            ],
            "classification": classification,
            "confidence": confidence,
            "fraud_probability": fraud_prob,
            "source": ai_analysis.get("provider", "GEMINI_AI"),
            "text_analysis": {
                "has_embedded_url": bool(extracted_url),
                "extracted_url": extracted_url or None,
                "extracted_urls": all_extracted_urls,
                "links_scanned_count": len(embedded_url_analyses),
                "links_not_scanned_count": unscanned_url_count,
                "lure_type": ai_analysis.get("lure_type", ""),
                "fraud_probability": fraud_prob,
            },
            "stages": {
                "stage1_text_nlp": {
                    "name": "Stage 1: Gemini AI SMS Context & Intent Analysis",
                    "classification": classification,
                    "confidence": confidence,
                    "fraud_probability": fraud_prob,
                    "lure_type": ai_analysis.get("lure_type", "N/A"),
                    "source": ai_analysis.get("provider", "GEMINI_AI"),
                },
                "stage2_link_audit": {
                    "name": "Stage 2: Embedded Link Security Audit",
                    "status": vt_result.get("status", "NOT_APPLICABLE"),
                    "malicious": vt_result.get("malicious", 0),
                    "suspicious": vt_result.get("suspicious", 0),
                    "total_engines": vt_result.get("total_engines", 0),
                    "urls_scanned_count": len(embedded_url_analyses),
                    "urls_not_scanned_count": unscanned_url_count,
                    "results": [
                        {
                            "url": item["url"],
                            "classification": item["combined"].get("classification", "UNKNOWN"),
                            "source": item["combined"].get("source", "UNKNOWN"),
                            "virustotal_status": item["virustotal"].get("status", "UNKNOWN"),
                            "malicious": item["virustotal"].get("malicious", 0),
                            "suspicious": item["virustotal"].get("suspicious", 0),
                            "harmless": item["virustotal"].get("harmless", 0),
                            "total_engines": item["virustotal"].get("total_engines", 0),
                            "ml_classification": item["ml"].get("classification", "UNKNOWN"),
                            "ml_source": item["ml"].get("source", "N/A"),
                        }
                        for item in embedded_url_analyses
                    ],
                    "ml_phishing_prob": None,
                },
                "stage3_gemini_sms": {
                    "name": "Stage 3: Gemini AI Smishing Threat Research",
                    "provider": ai_analysis.get("provider", "GEMINI_AI"),
                    "classification": ai_analysis.get("classification", "UNKNOWN"),
                    "summary": ai_analysis.get("summary", ""),
                    "recommendation": ai_analysis.get("recommendation", ""),
                },
            },
            "explanation": explanation,
            "virustotal": vt_result,
            "virustotal_results": [item["virustotal"] for item in embedded_url_analyses],
            "ml_model": {
                "classification": ml_result.get("classification", "UNKNOWN"),
                "confidence": None,
                "phishing_prob": None,
                "source": ml_result.get("source", "N/A"),
            },
            "ml_models": [
                {
                    "classification": item["ml"].get("classification", "UNKNOWN"),
                    "source": item["ml"].get("source", "N/A"),
                }
                for item in embedded_url_analyses
            ],
        }

    @classmethod
    async def process_guest_scan(cls, input_type: str, raw_input: str, language: str = "ar") -> dict:
        """Process guest scan routing cleanly between URL and SMS Text pipelines."""
        operation_id = resource_id(raw_input)
        log_event(logger, logging.INFO, "guest_scan_started", operation_id=operation_id, input_type=input_type, language=language)
        if input_type == "TEXT":
            scan_res = await cls.process_text_scan(raw_input, language=language)
        else:
            target = cls.extract_url_from_text(raw_input) or raw_input
            scan_res = await cls.process_url_scan(target, language=language)
            scan_res["input_value"] = raw_input
        scan_res["is_guest"] = True
        scan_res["scan_id"] = None
        try:
            await asyncio.to_thread(record_platform_scan_metric, scan_res.get("classification", "UNKNOWN"))
        except Exception:
            # Aggregate metrics must never make a guest scan fail.
            logger.warning("guest_scan_metric_persistence_failed")
        log_event(logger, logging.INFO, "guest_scan_finished", operation_id=operation_id, classification=scan_res.get("classification"))
        return scan_res

    @staticmethod
    def _mask_input(input_type: str, raw_input: str) -> str:
        if input_type == "TEXT":
            return "[TEXT REDACTED]"
        candidate = raw_input if "://" in raw_input else "https://" + raw_input
        try:
            parsed = urlsplit(candidate)
            host = parsed.hostname or "[HOST REDACTED]"
            return f"{parsed.scheme}://{host}/[REDACTED]"
        except Exception:
            return "[URL REDACTED]"

    @classmethod
    async def process_authenticated_scan(cls, input_type: str, raw_input: str, user_id: str, language: str = "ar") -> dict:
        if not user_id:
            raise ScanPersistenceError("verified user ID required")

        operation_id = resource_id(raw_input)
        log_event(logger, logging.INFO, "authenticated_scan_started", operation_id=operation_id, input_type=input_type, language=language)
        if input_type == "TEXT":
            scan_res = await cls.process_text_scan(raw_input, language=language)
        else:
            target = cls.extract_url_from_text(raw_input) or raw_input
            scan_res = await cls.process_url_scan(target, language=language)
            scan_res["input_value"] = raw_input

        scan_res["is_guest"] = False

        try:
            persistence_started = time.perf_counter()
            log_event(logger, logging.INFO, "scan_persistence_started", operation_id=operation_id, provider="SUPABASE", operation_name="insert_scan")
            now_iso = datetime.now(timezone.utc).isoformat()
            scan_data = {
                "user_id": user_id,
                "input_type": input_type,
                "input_value_masked": cls._mask_input(input_type, raw_input),
                "status": "COMPLETED",
                "classification": scan_res["classification"],
                "confidence_score": None,
                "confidence_level": None,
                "recommendation": scan_res.get("explanation", {}).get("recommendation", ""),
                "completed_at": now_iso,
            }
            saved = supabase.table("scans").insert(scan_data).execute()
            if saved.data:
                scan_id = saved.data[0].get("id")
                scan_res["scan_id"] = scan_id
                log_event(logger, logging.INFO, "scan_persistence_succeeded", operation_id=operation_id, provider="SUPABASE", operation_name="insert_scan", scan_id=scan_id, duration_ms=elapsed_ms(persistence_started))
                try:
                    await asyncio.to_thread(record_platform_scan_metric, scan_res.get("classification", "UNKNOWN"))
                except Exception:
                    logger.warning("authenticated_scan_metric_persistence_failed")
                try:
                    supabase.table("scans").update({"analysis_snapshot": scan_res.get("stages", {})}).eq("id", scan_id).eq("user_id", user_id).execute()
                except Exception:
                    # Older installations can apply the additive SQL migration later;
                    # the scan itself must not fail merely because the optional snapshot is absent.
                    log_event(logger, logging.WARNING, "supabase_operation_failed", operation_id=operation_id, provider="SUPABASE", operation_name="update_analysis_snapshot", error_code="PERSISTENCE_FAILED")

                explanation = scan_res.get("explanation", {})
                raw_provider = str(explanation.get("provider", "LOCAL_RULES")).upper()
                if "GEMINI" in raw_provider:
                    provider = "GEMINI"
                elif "LOCAL" in raw_provider or "RULES" in raw_provider:
                    provider = "LOCAL_RULES"
                elif "HUMAN" in raw_provider:
                    provider = "HUMAN_REVIEW"
                elif raw_provider in {"TEMPLATE", "GEMINI", "HUMAN_REVIEW", "LOCAL_RULES"}:
                    provider = "LOCAL_RULES" if raw_provider == "TEMPLATE" else raw_provider
                else:
                    provider = "LOCAL_RULES"

                explanation_data = {
                    "scan_id": scan_id,
                    "language": language,
                    "summary": explanation.get("summary", ""),
                    "reasons": explanation.get("reasons", []),
                    "recommendation": explanation.get("recommendation", ""),
                    "provider": provider,
                }
                try:
                    supabase.table("scan_explanations").insert(explanation_data).execute()
                except Exception:
                    log_event(logger, logging.WARNING, "supabase_operation_failed", operation_id=operation_id, provider="SUPABASE", operation_name="insert_scan_explanation", error_code="PERSISTENCE_FAILED")
                event = {
                    "type": "scan_completed",
                    "scan_id": scan_id,
                    "classification": scan_res.get("classification", "UNKNOWN"),
                    "confidence": scan_res.get("confidence"),
                    "created_at": now_iso,
                    "title": "اكتمل فحص جديد",
                }
                try:
                    await manager.broadcast(user_id, event)
                    log_event(logger, logging.INFO, "websocket_broadcast_succeeded", operation_id=operation_id, scan_id=scan_id, status="succeeded")
                except Exception as error:
                    log_event(logger, logging.WARNING, "websocket_broadcast_failed", operation_id=operation_id, scan_id=scan_id, error_type=safe_error(error), error_code="BROADCAST_FAILED")
                if scan_res.get("classification") == "DANGEROUS":
                    notification = {
                        "user_id": user_id,
                        "scan_id": scan_id,
                        "type": "DANGEROUS_RESULT",
                        "title": "تنبيه أمني عاجل",
                        "body": "تم اكتشاف نتيجة خطيرة في آخر فحص. لا تفتح الرابط ولا تدخل بياناتك.",
                    }
                    try:
                        saved_notification = supabase.table("notifications").insert(notification).execute()
                        notification_data = (saved_notification.data or [notification])[0]
                        log_event(logger, logging.INFO, "notification_succeeded", operation_id=operation_id, scan_id=scan_id, status="succeeded")
                    except Exception:
                        log_event(logger, logging.WARNING, "notification_failed", operation_id=operation_id, scan_id=scan_id, error_code="NOTIFICATION_FAILED")
                        notification_data = notification
                    try:
                        await manager.broadcast(user_id, {
                            "type": "security_alert",
                            "severity": "critical",
                            "notification": notification_data,
                            "created_at": now_iso,
                        })
                        log_event(logger, logging.INFO, "websocket_broadcast_succeeded", operation_id=operation_id, scan_id=scan_id, mode="security_alert")
                    except Exception as error:
                        log_event(logger, logging.WARNING, "websocket_broadcast_failed", operation_id=operation_id, scan_id=scan_id, mode="security_alert", error_type=safe_error(error), error_code="BROADCAST_FAILED")
                log_event(logger, logging.INFO, "authenticated_scan_persisted", operation_id=operation_id, scan_id=scan_id)
        except Exception as error:
            log_event(logger, logging.ERROR, "scan_persistence_failed", operation_id=operation_id, provider="SUPABASE", error_type=safe_error(error), error_code="PERSISTENCE_FAILED")
            raise ScanPersistenceError("scan persistence failed") from None

        log_event(logger, logging.INFO, "authenticated_scan_finished", operation_id=operation_id, classification=scan_res.get("classification"))
        return scan_res

    @staticmethod
    async def get_recent_scans(limit: int = 50, user_id: str = None) -> list:
        if not user_id:
            raise ValueError("user_id is required")
        safe_limit = max(1, min(int(limit), 50))
        try:
            result = (
                supabase.table("scans")
                .select("id,input_type,input_value_masked,status,classification,confidence_score,confidence_level,created_at,completed_at,user_hidden_at,user_deleted_at")
                .eq("user_id", user_id)
                .is_("user_hidden_at", "null")
                .is_("user_deleted_at", "null")
                .order("created_at", desc=True)
                .limit(safe_limit)
                .execute()
            )
            rows = result.data or []
            for row in rows:
                row["confidence_score"] = None
                row["confidence_level"] = None
            return rows
        except Exception:
            logger.error("scan_history_query_failed")
            raise
