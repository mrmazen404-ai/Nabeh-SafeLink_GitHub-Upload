#!/usr/bin/env python3
"""Standalone ML verification for Nabeh SafeLink.

This script exercises only backend.app.ml.predictor. It does not call Gemini,
VirusTotal, Supabase, or the HTTP API.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

# Production requires an explicit trust decision before loading the artifact.
os.environ.setdefault("NABEH_TRUST_MODEL_ARTIFACT", "true")

from app.ml.predictor import get_model_readiness, predict_url  # noqa: E402


CASES = [
    ("benign", "https://example.com"),
    ("benign", "https://www.google.com/search?q=security"),
    ("suspicious-looking", "https://paypa1-secure-login-verify.com/secure"),
    ("suspicious-looking", "http://bank-account-update.net/login"),
    ("invalid", "not a valid url with spaces"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Nabeh SafeLink ML predictor only")
    parser.add_argument("--json", action="store_true", help="Print machine-readable output")
    args = parser.parse_args()

    started = time.perf_counter()
    readiness = get_model_readiness()
    results = []
    for label, url in CASES:
        case_started = time.perf_counter()
        result = predict_url(url)
        results.append(
            {
                "case": label,
                "url": url,
                "result": result,
                "elapsed_ms": round((time.perf_counter() - case_started) * 1000, 2),
            }
        )

    model_cases = [item for item in results if item["case"] != "invalid"]
    model_results = [item["result"] for item in model_cases]
    valid_classes = {"SAFE", "SUSPICIOUS", "DANGEROUS", "UNKNOWN"}
    all_shapes_valid = all(
        isinstance(item.get("classification"), str)
        and item["classification"] in valid_classes
        and isinstance(item.get("source"), str)
        for item in model_results
    )
    model_used = any(item["result"].get("source") == "ML_MODEL" for item in model_cases)
    invalid_is_safe = results[-1]["result"].get("classification") == "SAFE"
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    passed = readiness.get("status") == "ready" and all_shapes_valid and model_used and not invalid_is_safe

    output = {
        "ml_only": True,
        "gemini_called": False,
        "virustotal_called": False,
        "readiness": readiness,
        "model_artifact_used": model_used,
        "results": results,
        "elapsed_ms": elapsed_ms,
        "passed": passed,
    }
    if args.json:
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print("Nabeh SafeLink standalone ML test")
        print(f"Readiness: {readiness}")
        print(f"Artifact used: {model_used}")
        print("External providers: Gemini=NOT CALLED, VirusTotal=NOT CALLED")
        for item in results:
            result = item["result"]
            print(
                f"- {item['case']:<20} {item['url']:<62} "
                f"=> {result.get('classification')} | source={result.get('source')} "
                f"| phishing_prob={result.get('phishing_prob')} | {item['elapsed_ms']} ms"
            )
        print(f"Overall: {'PASS' if passed else 'FAIL'} ({elapsed_ms} ms)")

    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
