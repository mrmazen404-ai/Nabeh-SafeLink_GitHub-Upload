"""Internal, loss-aware projection of the existing scan response.

This module is intentionally not wired into the public API in phases A-D.  It
separates source evidence for later UI/API work without inventing model
attributions or changing the existing decision policy.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

CONTRACT_VERSION = "0.2.0"


def _upper(value: Any, default: str = "UNKNOWN") -> str:
    text = str(value or default).strip().upper()
    return text or default


def _stage(data: dict[str, Any], *names: str) -> dict[str, Any]:
    stages = data.get("stages")
    if not isinstance(stages, dict):
        return {}
    for name in names:
        value = stages.get(name)
        if isinstance(value, dict):
            return value
    return {}


def _source_status(value: Any, fallback: str = "NOT_REPORTED") -> str:
    return _upper(value, fallback)


def _ml_analysis(data: dict[str, Any], evidence_card: dict[str, Any]) -> dict[str, Any]:
    stage = _stage(data, "stage1_ml", "stage1_text_nlp")
    model = data.get("ml_model") if isinstance(data.get("ml_model"), dict) else {}
    source = model.get("source", stage.get("source", "NOT_REPORTED"))
    classification = _upper(model.get("classification", stage.get("classification", "UNKNOWN")))
    observations = evidence_card.get("url_observations")
    observed_facts = deepcopy(observations.get("items", [])) if isinstance(observations, dict) else []
    strong_signals = evidence_card.get("decision", {}).get("inputs", {}).get("ml_strong_signals", [])
    if not isinstance(strong_signals, list):
        strong_signals = []
    raw_classification = model.get("raw_classification", stage.get("raw_classification"))
    context_gated = model.get("context_gated", stage.get("context_gated"))
    reason_codes = []
    if source == "ML_MODEL":
        reason_codes.append("ML_MODEL_EXECUTED")
    elif source and source != "NOT_REPORTED":
        reason_codes.append(f"ML_{_upper(source)}")
    if strong_signals:
        reason_codes.append("ML_EXPLICIT_STRUCTURAL_SIGNALS_PRESENT")
    elif source == "ML_MODEL":
        reason_codes.append("ML_NO_EXPLICIT_STRUCTURAL_SIGNALS_REPORTED")
    if context_gated is True:
        reason_codes.append("ML_CONTEXT_GATE_APPLIED")
    measured_fact_evidence = [
        {"code": fact.get("code"), "value": deepcopy(fact.get("value")), "type": "MEASURED_FACT"}
        for fact in observed_facts
        if isinstance(fact, dict) and fact.get("code")
    ]
    signal_evidence = [
        {"code": signal, "type": "EXPLICIT_STRUCTURAL_SIGNAL"}
        for signal in strong_signals
    ]
    return {
        "status": "COMPLETED" if source == "ML_MODEL" else _source_status(source, "NOT_RUN"),
        "classification": classification,
        "source": source,
        "model_name": "LightGBM" if source == "ML_MODEL" or "ml" in str(stage.get("name", "")).lower() else None,
        "model_version": None,
        "raw_classification": raw_classification,
        "context_gated": context_gated,
        "confidence": model.get("confidence", stage.get("confidence")),
        "phishing_probability": model.get("phishing_prob", stage.get("phishing_prob")),
        "observed_facts": observed_facts,
        "strong_signals": deepcopy(strong_signals),
        "reason_codes": reason_codes,
        "model_attribution": {
            "available": False,
            "reason_code": "MODEL_ATTRIBUTION_NOT_AVAILABLE",
            "message": "Measured URL properties are not proof of individual LightGBM feature contributions.",
        },
        "evidence": measured_fact_evidence + signal_evidence,
        "limitations": [
            "MODEL_ATTRIBUTION_NOT_AVAILABLE",
            "RAW_MODEL_PROBABILITY_NOT_EXPOSED_OR_CALIBRATED",
            "MODEL_CLASSIFICATION_IS_NOT_PROOF_OF_MALWARE",
        ],
    }


def _virustotal_analysis(data: dict[str, Any], evidence_card: dict[str, Any]) -> dict[str, Any]:
    raw = data.get("virustotal") if isinstance(data.get("virustotal"), dict) else {}
    stage = _stage(data, "stage2_virustotal", "stage2_link_audit")
    status = _upper(raw.get("status", stage.get("status", "UNKNOWN")))
    provider_status = _source_status(raw.get("provider_status", stage.get("provider_status", status)))
    count_keys = ("malicious", "suspicious", "harmless", "undetected", "timeout", "total_engines")
    counts = {}
    source_counts = raw.get("counts") if isinstance(raw.get("counts"), dict) else raw
    for key in count_keys:
        if key in source_counts and source_counts.get(key) is not None:
            try:
                counts[key] = int(source_counts[key])
            except (TypeError, ValueError):
                pass
    evidence = []
    reason_codes = []
    if "malicious" in counts:
        evidence.append({"code": "VT_MALICIOUS_ENGINE_COUNT", "value": counts["malicious"], "type": "PROVIDER_FACT"})
    if "suspicious" in counts:
        evidence.append({"code": "VT_SUSPICIOUS_ENGINE_COUNT", "value": counts["suspicious"], "type": "PROVIDER_FACT"})
    if status == "SAFE" and provider_status == "SUCCESS":
        reason_codes.append("VT_NO_MALICIOUS_OR_SUSPICIOUS_VERDICT")
    elif status == "DANGEROUS":
        reason_codes.append("VT_DANGEROUS_PROVIDER_VERDICT")
    elif status == "SUSPICIOUS":
        reason_codes.append("VT_SUSPICIOUS_PROVIDER_VERDICT")
    if provider_status != "SUCCESS":
        status_code = f"VT_PROVIDER_{provider_status}"
        evidence.append({"code": status_code, "type": "PROVIDER_STATUS"})
        reason_codes.append(status_code)
    return {
        "status": "COMPLETED" if provider_status == "SUCCESS" else provider_status,
        "classification": status,
        "provider": "VirusTotal",
        "provider_status": provider_status,
        "counts": counts,
        "evidence_timestamp": raw.get("evidence_timestamp"),
        "last_analysis_date": raw.get("last_analysis_date"),
        "freshness_status": raw.get("analysis_freshness_reason"),
        "reason_codes": reason_codes,
        "evidence": evidence,
        "limitations": [
            "UNDETECTED_IS_NOT_HARMLESS",
            "PROVIDER_RESULT_IS_NOT_PROOF_OF_ABSOLUTE_SAFETY",
        ],
    }


def _gemini_analysis(data: dict[str, Any]) -> dict[str, Any]:
    explanation = data.get("explanation") if isinstance(data.get("explanation"), dict) else {}
    stage = _stage(data, "stage3_gemini", "stage3_gemini_sms")
    provider = explanation.get("provider", stage.get("provider", "NOT_REPORTED"))
    provider_status = _source_status(explanation.get("provider_status", stage.get("provider_status", "NOT_REPORTED")))
    fallback_reason = explanation.get("fallback_reason", stage.get("fallback_reason"))
    citations = deepcopy(explanation.get("citations", stage.get("citations", [])))
    domain_verification = deepcopy(explanation.get("domain_verification", stage.get("domain_verification")))
    reason_codes = []
    if provider_status == "SUCCESS" and str(provider).upper().startswith("GEMINI"):
        reason_codes.append("GEMINI_PROVIDER_RESPONSE")
    elif provider_status in {"FALLBACK", "DISABLED"}:
        reason_codes.append(f"GEMINI_{provider_status}")
        if fallback_reason:
            reason_codes.append(f"GEMINI_FALLBACK_{_upper(fallback_reason)}")
    else:
        reason_codes.append("GEMINI_STATUS_NOT_CONFIRMED")
    if not citations:
        reason_codes.append("GEMINI_NO_PROVIDER_CITATIONS")
    return {
        "status": "COMPLETED" if provider_status == "SUCCESS" else provider_status,
        "classification": _upper(explanation.get("classification", stage.get("classification", "UNKNOWN"))),
        "provider": provider,
        "provider_status": provider_status,
        "summary": explanation.get("summary", stage.get("summary", "")),
        "fallback_reason": fallback_reason,
        "input_truncated": bool(explanation.get("input_truncated", stage.get("input_truncated", False))),
        "domain_verification": domain_verification or {"status": "NOT_REPORTED"},
        "citations": citations,
        "reason_codes": reason_codes,
        "role": "SUPPORTING_EXPLANATION_NOT_DECISION_SOURCE",
        "evidence": [],
        "limitations": [
            "AI_EXPLANATION_IS_NOT_INDEPENDENT_MALWARE_PROOF",
            "GEMINI_CITATIONS_DO_NOT_PROVE_SENDER_IDENTITY",
        ],
    }


def _fusion_audit(decision_code: str, inputs: dict[str, Any], decision: dict[str, Any]) -> dict[str, Any]:
    """Describe only rules evidenced by the existing fusion decision code."""
    rule_map = {
        "VT_STRONG_CONSENSUS": "RULE_VT_MALICIOUS_ENGINE_CONSENSUS",
        "VT_ML_CORROBORATION": "RULE_VT_AND_ML_CORROBORATION",
        "ML_HIGH_CONFIDENCE_STRUCTURAL": "RULE_ML_HIGH_CONFIDENCE_PLUS_TWO_STRUCTURAL_SIGNALS",
        "ML_VT_CONFLICT": "RULE_ML_DANGEROUS_CONFLICTED_BY_VT_SAFE",
        "VT_SIGNAL": "RULE_VT_SIGNAL_SUSPICIOUS",
        "ML_STRONG_SIGNAL_ONLY": "RULE_ML_STRONG_SIGNAL_CAPS_AT_SUSPICIOUS",
        "ML_SUSPICIOUS_SIGNAL": "RULE_ML_SUSPICIOUS_CLASSIFICATION",
        "SAFE_SOURCE_CONSENSUS": "RULE_VT_AND_ML_SAFE_CONSENSUS",
        "HYBRID_WEIGHTED_SUSPICIOUS": "RULE_HYBRID_WEIGHTED_SUSPICIOUS",
        "HYBRID_WEIGHTED_INCONCLUSIVE": "RULE_HYBRID_WEIGHTED_INCONCLUSIVE",
        "INSUFFICIENT_EVIDENCE": "RULE_INSUFFICIENT_EVIDENCE",
    }
    applied = [rule_map[decision_code]] if decision_code in rule_map else []
    reasons = []
    if applied:
        reasons.append(decision_code)
    if decision_code == "INSUFFICIENT_EVIDENCE":
        reasons.append("FINAL_CLASSIFICATION_UNKNOWN")
    return {
        "policy_id": decision.get("policy_id", "NABEH_URL_FUSION"),
        "policy_version": decision.get("policy_version"),
        "decision_code": decision_code,
        "inputs": deepcopy(inputs),
        "thresholds": deepcopy(decision.get("thresholds", {})),
        "rules_applied": applied,
        "rules_rejected": [],
        "decision_reasons": reasons,
        "audit_status": "EXACT_RULE_MAPPED" if applied else "DECISION_CODE_NOT_MAPPED",
    }


def _unknown_reason_codes(data: dict[str, Any], ml: dict[str, Any], vt: dict[str, Any], fusion: dict[str, Any]) -> list[str]:
    """Return explicit UNKNOWN causes supported by fields in the scan response."""
    if fusion.get("decision_code") != "INSUFFICIENT_EVIDENCE" and str(data.get("classification", "")).upper() != "UNKNOWN":
        return []
    reasons = []
    ml_source = _upper(ml.get("source", "NOT_REPORTED"), "NOT_REPORTED")
    vt_status = _upper(vt.get("provider_status", "NOT_REPORTED"), "NOT_REPORTED")
    if ml_source in {"MODEL_UNAVAILABLE", "MODEL_ERROR", "MODEL_BUSY", "INVALID_URL", "NOT_APPLICABLE", "NOT_REPORTED"}:
        reasons.append(f"ML_{ml_source}")
    if vt_status in {"NOT_CONFIGURED", "ANALYSIS_STALE", "ANALYSIS_DATE_MISSING", "ANALYSIS_DATE_INVALID", "TIMEOUT", "NETWORK_ERROR", "PROVIDER_ERROR", "BUSY", "PRIVACY_BLOCKED", "SUBMISSION_DISABLED", "NOT_APPLICABLE", "NOT_REPORTED"}:
        reasons.append(f"VT_{vt_status}")
    if not reasons:
        reasons.append("NO_PROVIDER_MEETS_A_DECISION_RULE")
    if data.get("analysis_coverage") == "PARTIAL":
        reasons.append("ANALYSIS_COVERAGE_PARTIAL")
    return reasons


def build_analysis_contract(scan_result: dict[str, Any]) -> dict[str, Any]:
    """Project an existing scan result into separated, non-lossy source sections.

    The function is pure: it does not call providers, alter the input, or
    change the existing public response.  Missing fields remain explicit.
    """
    data = deepcopy(scan_result or {})
    evidence_card = data.get("evidence_card") if isinstance(data.get("evidence_card"), dict) else {}
    decision = evidence_card.get("decision") if isinstance(evidence_card.get("decision"), dict) else {}
    fusion_seed = {
        "policy_id": decision.get("policy_id", "NABEH_URL_FUSION"),
        "policy_version": decision.get("policy_version"),
        "decision_code": decision.get("code", "INSUFFICIENT_EVIDENCE"),
        "inputs": deepcopy(decision.get("inputs", {})),
        "thresholds": deepcopy(decision.get("thresholds", {})),
    }
    ml_analysis = _ml_analysis(data, evidence_card)
    virustotal_analysis = _virustotal_analysis(data, evidence_card)
    gemini_analysis = _gemini_analysis(data)
    fusion = _fusion_audit(
        fusion_seed["decision_code"],
        fusion_seed["inputs"],
        fusion_seed,
    )
    unknown_reason_codes = _unknown_reason_codes(data, ml_analysis, virustotal_analysis, fusion)
    return {
        "contract_version": CONTRACT_VERSION,
        "final_decision": {
            "classification": _upper(data.get("classification", decision.get("classification", "UNKNOWN"))),
            "decision_code": fusion["decision_code"],
            "source": data.get("source", "NOT_REPORTED"),
            "is_safe_proven": False,
            "limitations": ["FINAL_DECISION_IS_POLICY_OUTPUT_NOT_SINGLE_PROVIDER_PROOF"],
        },
        "ml_analysis": ml_analysis,
        "virustotal_analysis": virustotal_analysis,
        "gemini_analysis": gemini_analysis,
        "fusion_analysis": fusion,
        "unknown_analysis": {
            "is_unknown": bool(unknown_reason_codes),
            "reason_codes": unknown_reason_codes,
            "message_code": "UNKNOWN_REASONS_EXPLICIT" if unknown_reason_codes else None,
        },
        "coverage": {
            "status": data.get("analysis_coverage", "FULL"),
            "reasons": deepcopy(data.get("coverage_reasons", [])),
            "links_scanned_count": data.get("links_scanned_count"),
            "links_not_scanned_count": data.get("links_not_scanned_count"),
        },
        "limitations": [
            "THIS_IS_AN_INTERNAL_PROJECTION_DURING_PHASE_A_F",
            "MISSING_PROVIDER_FIELDS_ARE_NOT_INFERRED",
        ],
    }
