# Nabeh SafeLink URL Model Evaluation

This document records the evaluation values shipped with the retrained URL model artifact `backend/app/ml/nabeh_model_retrained_report.json`. These figures describe the URL model only; they are not SMS probabilities and must not be displayed as SMS confidence.

## Model identity

| Field | Value |
|---|---|
| Model | Nabeh SafeLink |
| Type | LightGBM binary classifier |
| Version | candidate-2026-10-23-42-features |
| Features | 42 |
| Selected threshold | 0.5166115785121916 |
| Threshold policy | Maximum recall with validation FPR <= 0.02 |
| URLs fetched during training | No |
| Candidate smoke gate | Passed |

## Test confusion matrix at the selected threshold

The label mapping is `good = 0` and `bad = 1`; `bad` is the phishing class used for these metrics.

| Actual \\ Predicted | Good | Bad |
|---|---:|---:|
| Good | TN = 14,443 | FP = 236 |
| Bad | FN = 442 | TP = 10,092 |

| Metric | Value |
|---|---:|
| Accuracy | 0.973109110379566 |
| Precision (phishing) | 0.97714949651433 |
| Recall (phishing) | 0.9580406303398519 |
| F1 (phishing) | 0.9675007190106414 |
| False-positive rate | 0.016077389467947407 |
| True-negative rate | 0.9839226105320525 |
| ROC AUC | 0.9951955908075109 |
| PR AUC | 0.993635026365143 |
| Test rows | 25,213 |
| Test domains | 15,097 |

## Validation confusion matrix at the selected threshold

| Actual \\ Predicted | Good | Bad |
|---|---:|---:|
| Good | TN = 14,754 | FP = 301 |
| Bad | FN = 393 | TP = 10,502 |

| Metric | Value |
|---|---:|
| Accuracy | 0.9732562620423892 |
| Precision (phishing) | 0.9721373692492826 |
| Recall (phishing) | 0.9639284075263882 |
| F1 (phishing) | 0.9680154852981842 |
| False-positive rate | 0.01999335768847559 |
| ROC AUC | 0.9948441670734918 |
| PR AUC | 0.9924405597922118 |
| Validation rows | 25,950 |
| Validation domains | 15,096 |

## Interpretation boundary

These matrices are valid only for the URL test split and its data-generation process. They do not prove sender identity, do not validate SMS text classification, and do not justify a numeric SMS risk gauge. The application therefore withholds SMS probabilities and exposes URL model evidence separately.

The artifact also states that known-safe holdout roots were excluded from training and that the model was trained without fetching URLs. These facts should remain in the academic report as limitations and reproducibility notes.
