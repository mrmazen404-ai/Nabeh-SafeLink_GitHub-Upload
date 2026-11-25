#!/usr/bin/env python3
"""Train a URL phishing model using URL-Phish and the current PhishTank feed.

Data sources and attribution:
- URL-Phish, Mendeley Data v2, DOI 10.17632/65z9twcx3r.2, CC BY 4.0.
  The source page reports 100,000 benign and 16,600 phishing URLs; phishing
  samples were collected from PhishTank between Nov 2024 and Sep 2025.
- PhishTank online-valid CSV, https://data.phishtank.com/data/online-valid.csv.
  PhishTank developer docs say its database is updated hourly. Its terms page
  says Data is available for commercial use without charge; retain attribution.

This script only parses URL strings as text. It never visits training URLs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, early_stopping, log_evaluation
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from app.ml import predictor  # noqa: E402

KNOWN_SAFE_HOLDOUTS = (
    "https://example.com/",
    "https://google.com/",
    "https://wikipedia.org/",
    "https://github.com/",
    "https://python.org/",
    "https://salla.sa/",
)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def root_domain(url: str) -> str:
    _, parsed, host, _ = predictor.parse_url(url)
    if parsed is None or not host:
        return ""
    ext = predictor._TLD_EXTRACTOR(host)
    return f"{ext.domain}.{ext.suffix}".lower() if ext.domain and ext.suffix else host.lower()


def valid_web_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw or len(raw) > 4096 or any(ch.isspace() for ch in raw):
        return None
    normalized, parsed, host, _ = predictor.parse_url(raw)
    if parsed is None or not host or parsed.scheme.lower() not in {"http", "https"}:
        return None
    return normalized


def read_mendeley(path: Path) -> pd.DataFrame:
    with zipfile.ZipFile(path) as archive:
        candidates = [n for n in archive.namelist() if n.lower().endswith(".csv")]
        if len(candidates) != 1:
            raise ValueError(f"Expected one CSV in Mendeley ZIP, found {len(candidates)}")
        data = pd.read_csv(archive.open(candidates[0]), usecols=["url", "label"])
    data["label"] = pd.to_numeric(data["label"], errors="coerce")
    data = data.dropna(subset=["url", "label"])
    data["label"] = data["label"].astype(int)
    if not set(data["label"].unique()).issubset({0, 1}):
        raise ValueError("Unexpected Mendeley labels; expected 0=benign, 1=phishing")
    data["source"] = "Mendeley_URL-Phish_v2"
    return data[["url", "label", "source"]]


def read_phishtank(path: Path) -> pd.DataFrame:
    data = pd.read_csv(path, usecols=["url", "verified", "online"])
    data = data[
        data["verified"].astype(str).str.lower().eq("yes")
        & data["online"].astype(str).str.lower().eq("yes")
    ].copy()
    data["label"] = 1
    data["source"] = "PhishTank_online_valid"
    return data[["url", "label", "source"]]


def metric_block(y: np.ndarray, p: np.ndarray, threshold: float) -> dict:
    pred = (p >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(y, pred)),
        "precision_phishing": float(precision_score(y, pred, zero_division=0)),
        "recall_phishing": float(recall_score(y, pred, zero_division=0)),
        "f1_phishing": float(f1_score(y, pred, zero_division=0)),
        "false_positive_rate": float(fp / max(1, fp + tn)),
        "true_negative_rate": float(tn / max(1, fp + tn)),
        "roc_auc": float(roc_auc_score(y, p)),
        "pr_auc": float(average_precision_score(y, p)),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def choose_fpr_limited_threshold(y: np.ndarray, p: np.ndarray, max_fpr: float) -> float:
    # Select the lowest threshold that keeps validation FPR at/below the target,
    # thereby maximizing phishing recall within this explicit false-alarm budget.
    candidates = np.unique(p)
    candidates.sort()
    best = None
    for t in candidates:
        pred = p >= t
        negatives = y == 0
        fpr = float(np.mean(pred[negatives])) if negatives.any() else 1.0
        if fpr <= max_fpr:
            best = float(t)
            break
    return best if best is not None else 1.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mendeley-zip", required=True, type=Path)
    ap.add_argument("--phishtank-csv", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--report", required=True, type=Path)
    ap.add_argument("--seed", type=int, default=20261023)
    ap.add_argument("--max-validation-fpr", type=float, default=0.02)
    args = ap.parse_args()

    mendeley = read_mendeley(args.mendeley_zip)
    phishtank = read_phishtank(args.phishtank_csv)
    raw = pd.concat([mendeley, phishtank], ignore_index=True)
    raw["url"] = raw["url"].map(valid_web_url)
    raw = raw.dropna(subset=["url"]).copy()
    raw["root_domain"] = raw["url"].map(root_domain)
    raw = raw[raw["root_domain"].ne("")].copy()

    # Exact-URL conflicts resolve to the verified phishing label. Then remove
    # benign rows sharing a registrable domain with a verified phishing sample.
    raw["label"] = raw["label"].astype(int)
    raw = raw.sort_values("label", ascending=False).drop_duplicates("url", keep="first")
    malicious_roots = set(raw.loc[raw.label.eq(1), "root_domain"])
    conflicting_benign = raw.label.eq(0) & raw.root_domain.isin(malicious_roots)
    conflicts_removed = int(conflicting_benign.sum())
    raw = raw[~conflicting_benign].copy()

    # Do not train on the explicit benign smoke-test roots; use these only as a
    # qualitative regression gate after model selection.
    safe_roots = {root_domain(u) for u in KNOWN_SAFE_HOLDOUTS}
    safe_roots.discard("")
    holdout_mask = raw.root_domain.isin(safe_roots)
    safe_holdout_rows = int(holdout_mask.sum())
    raw = raw[~holdout_mask].copy()

    # Stable URL feature contract is inherited from production inference code.
    feature_rows = []
    urls = raw["url"].tolist()
    for i, url in enumerate(urls, 1):
        feature_rows.append(predictor.extract_features(url))
        if i % 25000 == 0:
            print(f"extracted_features={i}/{len(urls)}", flush=True)
    features = pd.DataFrame(feature_rows)
    feature_names = list(features.columns)
    if len(feature_names) != 42:
        raise ValueError(f"Expected 42 production features, got {len(feature_names)}")
    x = features.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    y = raw["label"].to_numpy(dtype=np.int8)
    groups = raw["root_domain"].to_numpy()

    # Group holdouts prevent URLs from the same eTLD+1 appearing in multiple
    # partitions, reducing domain leakage in validation and test metrics.
    splitter1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=args.seed)
    train_idx, remainder_idx = next(splitter1.split(x, y, groups))
    splitter2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=args.seed + 1)
    val_rel, test_rel = next(splitter2.split(x.iloc[remainder_idx], y[remainder_idx], groups[remainder_idx]))
    val_idx = remainder_idx[val_rel]
    test_idx = remainder_idx[test_rel]
    for name, ids in (("train", train_idx), ("validation", val_idx), ("test", test_idx)):
        if len(np.unique(y[ids])) != 2:
            raise ValueError(f"{name} split does not contain both labels")
    assert not (set(groups[train_idx]) & set(groups[val_idx]))
    assert not (set(groups[train_idx]) & set(groups[test_idx]))
    assert not (set(groups[val_idx]) & set(groups[test_idx]))

    model = LGBMClassifier(
        objective="binary",
        n_estimators=1600,
        learning_rate=0.03,
        num_leaves=31,
        max_depth=-1,
        min_child_samples=40,
        subsample=0.85,
        colsample_bytree=0.90,
        reg_lambda=2.0,
        random_state=args.seed,
        n_jobs=min(8, os.cpu_count() or 2),
        verbosity=-1,
    )
    model.fit(
        x.iloc[train_idx], y[train_idx],
        eval_set=[(x.iloc[val_idx], y[val_idx])],
        eval_metric="binary_logloss",
        callbacks=[early_stopping(100, verbose=False), log_evaluation(0)],
    )
    p_val = model.predict_proba(x.iloc[val_idx])[:, 1]
    p_test = model.predict_proba(x.iloc[test_idx])[:, 1]
    threshold = choose_fpr_limited_threshold(y[val_idx], p_val, args.max_validation_fpr)
    test_metrics = metric_block(y[test_idx], p_test, threshold)
    test_at_half = metric_block(y[test_idx], p_test, 0.5)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": model,
        "feature_names": feature_names,
        "threshold": threshold,
        "label_mapping": {"good": 0, "bad": 1},
        "metadata": {
            "model_name": "Nabeh SafeLink",
            "version": "candidate-2026-10-23-42-features",
            "model_type": "LGBMClassifier",
            "feature_count": len(feature_names),
            "feature_names": feature_names,
            "label_mapping": {"good": 0, "bad": 1},
            "selected_threshold": threshold,
            "threshold_policy": f"maximum recall with validation FPR <= {args.max_validation_fpr}",
            "validation_metrics_at_selected_threshold": metric_block(y[val_idx], p_val, threshold),
            "test_metrics_at_selected_threshold": test_metrics,
            "test_metrics_at_0_5": test_at_half,
            "split_rows": {"train": int(len(train_idx)), "validation": int(len(val_idx)), "test": int(len(test_idx))},
            "split_domains": {"train": int(len(set(groups[train_idx]))), "validation": int(len(set(groups[val_idx]))), "test": int(len(set(groups[test_idx])))},
            "source_rows": {str(k): int(v) for k, v in raw.source.value_counts().items()},
            "label_rows": {str(k): int(v) for k, v in raw.label.value_counts().items()},
            "root_domain_label_conflicts_removed": conflicts_removed,
            "known_safe_holdout_roots_excluded_from_training": sorted(safe_roots),
            "known_safe_holdout_rows_excluded": safe_holdout_rows,
            "best_iteration": int(model.best_iteration_ or model.n_estimators),
            "sources": [
                {"name": "URL-Phish Mendeley Data v2", "doi": "10.17632/65z9twcx3r.2", "published": "2026-03-09", "license": "CC BY 4.0", "url": "https://data.mendeley.com/datasets/65z9twcx3r/2"},
                {"name": "PhishTank online-valid feed", "url": "https://data.phishtank.com/data/online-valid.csv", "usage_terms": "PhishTank terms page states Data is available for commercial use without charge", "terms_url": "https://phishtank.net/terms.php"},
            ],
            "input_sha256": {"mendeley_zip": sha256(args.mendeley_zip), "phishtank_csv": sha256(args.phishtank_csv)},
            "training_utc": datetime.now(timezone.utc).isoformat(),
            "training_script": "backend/scripts/train_url_model.py",
            "urls_were_fetched": False,
        },
    }
    joblib.dump(bundle, args.output, compress=3)
    args.report.write_text(json.dumps(bundle["metadata"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Qualitative holdout, never used for fitting. This is a veto, not a
    # replacement for group-held-out metrics.
    prior = predictor.model_bundle
    prior_attempt = predictor._model_load_attempted
    predictor.model_bundle = bundle
    predictor._model_load_attempted = True
    safe_results = {u: predictor.predict_url(u) for u in KNOWN_SAFE_HOLDOUTS}
    predictor.model_bundle = prior
    predictor._model_load_attempted = prior_attempt
    report = json.loads(args.report.read_text(encoding="utf-8"))
    report["known_safe_holdout_predictions"] = {
        u: {k: v for k, v in result.items() if k in {"classification", "confidence", "phishing_prob", "source"}}
        for u, result in safe_results.items()
    }
    report["known_safe_holdout_all_not_dangerous"] = all(r["classification"] != "DANGEROUS" for r in safe_results.values())
    report["candidate_passed_smoke_gate"] = (
        test_metrics["false_positive_rate"] <= 0.05
        and report["known_safe_holdout_all_not_dangerous"]
    )
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "candidate_model": str(args.output),
        "report": str(args.report),
        "best_iteration": bundle["metadata"]["best_iteration"],
        "validation_metrics": bundle["metadata"]["validation_metrics_at_selected_threshold"],
        "test_metrics": test_metrics,
        "known_safe_holdout_predictions": report["known_safe_holdout_predictions"],
        "candidate_passed_smoke_gate": report["candidate_passed_smoke_gate"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
