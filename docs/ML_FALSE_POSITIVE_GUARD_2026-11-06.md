# ML false-positive guard — 2026-11-06

## Change

The URL predictor now recognizes exact registrable domains for common platforms as context signals. If the LightGBM model alone returns `DANGEROUS` with a high score on one of those platforms, and the URL has no strong structural indicators (`@`, IP host, Punycode, non-standard port, executable extension, brand mismatch, many hyphens, or credential terms), the predictor caps the result at `SUSPICIOUS`.

This is not an allowlist and never returns `SAFE`. VirusTotal evidence can still promote the final fused result. The public `source` value remains `ML_MODEL` for compatibility, while `raw_classification` and `context_gated` expose the audit trail.

## Validation

The repository test suite passed after the change:

```text
210 passed, 3 warnings, 0 failures
```

The new regression case was the long GitHub repository URL that previously received an ML-only `DANGEROUS` result. It now returns:

```json
{
  "classification": "SUSPICIOUS",
  "raw_classification": "DANGEROUS",
  "context_gated": true
}
```

A credential-bearing GitHub URL is not gated and remains eligible for a dangerous result:

```text
https://github.com/login?token=reset-password-otp
```

## Limitation

This commit does not retrain the LightGBM artifact. The original model and its reported validation/test metrics remain unchanged. A statistically valid retraining still requires the versioned Mendeley and PhishTank input datasets, plus a hard-negative set of long legitimate URLs. The guard is an inference-layer mitigation that can be deployed safely before that retraining.
