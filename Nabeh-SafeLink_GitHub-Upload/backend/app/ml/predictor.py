"""Nabeh SafeLink ML URL predictor."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
import re
import math
import json
import threading
import joblib
from urllib.parse import urlsplit, unquote
import pandas as pd
import numpy as np
import tldextract

_TLD_EXTRACTOR = tldextract.TLDExtract(suffix_list_urls=())

BRANDS = (
    "paypal", "apple", "google", "microsoft", "amazon",
    "facebook", "instagram", "linkedin", "netflix",
    "whatsapp", "telegram", "binance", "coinbase",
    "dropbox", "adobe", "outlook", "office365",
)

SUSPICIOUS_WORDS = (
    "login", "signin", "verify", "verification", "secure",
    "account", "update", "confirm", "password", "credential",
    "bank", "wallet", "payment", "invoice", "billing",
    "auth", "authenticate", "unlock", "recover", "reset",
    "webscr", "ebayisapi", "validate",
)

SUSPICIOUS_EXTENSIONS = (
    ".exe", ".scr", ".zip", ".rar", ".7z", ".msi",
    ".bat", ".cmd", ".js", ".jar", ".apk",
)

URL_SHORTENERS = (
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "buff.ly", "ow.ly",
    "cutt.ly", "rebrand.ly", "shorturl.at", "s.id", "clck.ru", "rb.gy", "v.gd"
)

# Exact registrable domains only. These are context signals, never an allowlist:
# a URL on a trusted platform can still be compromised or malicious.
KNOWN_PLATFORM_ROOTS = frozenset({
    "github.com", "github.io", "gitlab.com", "bitbucket.org",
    "microsoft.com", "microsoftonline.com", "google.com", "googleapis.com",
    "amazon.com", "amazon.sa", "apple.com", "python.org", "mozilla.org",
})


def is_shortener_url(raw_url: str) -> bool:
    if not raw_url:
        return False
    candidate = str(raw_url).strip().lower()
    if "://" not in candidate:
        candidate = "http://" + candidate
    try:
        parsed = urlsplit(candidate)
        host = parsed.hostname or ""
        ext = _TLD_EXTRACTOR(host)
        domain_registered = f"{ext.domain}.{ext.suffix}" if ext.domain and ext.suffix else host
        return domain_registered in URL_SHORTENERS or host in URL_SHORTENERS
    except Exception:
        return False


def _registered_domain(host: str) -> str:
    """Return the exact eTLD+1 used for context checks."""
    ext = _TLD_EXTRACTOR((host or "").lower().rstrip("."))
    return f"{ext.domain}.{ext.suffix}" if ext.domain and ext.suffix else ""


def _should_gate_known_platform_false_positive(url: str, features: dict, phishing_prob: float) -> bool:
    """Downgrade an ML-only alarm on a known platform when no strong URL signal exists.

    This deliberately changes DANGEROUS to SUSPICIOUS, never SAFE. The fusion
    layer can still promote the result when independent VirusTotal evidence agrees.
    """
    parsed = urlsplit(url)
    root = _registered_domain(parsed.hostname or "")
    if root not in KNOWN_PLATFORM_ROOTS or phishing_prob < 0.80:
        return False
    strong_flags = (
        features.get("has_ip_host"),
        features.get("has_at_symbol"),
        features.get("has_punycode"),
        features.get("nonstandard_port"),
        features.get("suspicious_extension"),
        features.get("brand_impersonation"),
        features.get("many_hyphens_domain"),
    )
    if any(bool(flag) for flag in strong_flags):
        return False
    path_query = f"{parsed.path or ''}?{parsed.query or ''}".lower()
    return not any(term in path_query for term in ("password", "passwd", "otp", "cvv", "card", "token"))

# Preferred model is retrained LightGBM model, falling back to original model
RETRAINED_MODEL_PATH = os.path.join(os.path.dirname(__file__), "nabeh_model_retrained.joblib")
ORIGINAL_MODEL_PATH = os.path.join(os.path.dirname(__file__), "nabeh_model.joblib")
PORTABLE_MODEL_PATH = os.path.join(os.path.dirname(__file__), "nabeh_model_retrained.json")
MODEL_PATH = RETRAINED_MODEL_PATH if os.path.exists(RETRAINED_MODEL_PATH) else ORIGINAL_MODEL_PATH

model_bundle = None
_model_load_attempted = False
_model_load_status = "NOT_CHECKED"
_MAX_INFLIGHT_PREDICTIONS = 2
_DEFAULT_PREDICTION_TIMEOUT_SECONDS = 2.0
_PREDICTION_EXECUTOR = ThreadPoolExecutor(
    max_workers=_MAX_INFLIGHT_PREDICTIONS,
    thread_name_prefix="nabeh-predict",
)
_PREDICTION_SLOTS = threading.BoundedSemaphore(_MAX_INFLIGHT_PREDICTIONS)


def _load_trusted_model():
    global model_bundle, _model_load_attempted, _model_load_status
    if model_bundle is not None or _model_load_attempted:
        return model_bundle
    _model_load_attempted = True
    if os.getenv("NABEH_TRUST_MODEL_ARTIFACT", "").lower() not in {"1", "true", "yes"}:
        _model_load_status = "TRUST_DISABLED"
        return None
    if not os.path.exists(MODEL_PATH):
        _model_load_status = "ARTIFACT_MISSING"
        return None
    try:
        loaded = joblib.load(MODEL_PATH)
        if (
            not isinstance(loaded, dict)
            or not hasattr(loaded.get("model"), "predict_proba")
            or not isinstance(loaded.get("feature_names"), (list, tuple))
        ):
            _model_load_status = "ARTIFACT_INVALID"
            return None
        model_bundle = loaded
        _model_load_status = "READY"
    except Exception:
        # Serverless runtimes can fail to unpickle a LightGBM sklearn wrapper
        # even when the trained artifact is present. Use the portable dump of
        # the same trees as a dependency-light production fallback.
        try:
            if os.path.abspath(MODEL_PATH) not in {
                os.path.abspath(RETRAINED_MODEL_PATH),
                os.path.abspath(ORIGINAL_MODEL_PATH),
            }:
                raise ValueError("portable fallback is only for the configured production artifact")
            with open(PORTABLE_MODEL_PATH, "r", encoding="utf-8") as handle:
                portable = json.load(handle)
            if (
                not isinstance(portable, dict)
                or not isinstance(portable.get("feature_names"), (list, tuple))
                or not isinstance(portable.get("tree_info"), list)
                or not portable["tree_info"]
            ):
                raise ValueError("invalid portable model bundle")
            model_bundle = portable
            _model_load_status = "READY_PORTABLE"
        except Exception:
            model_bundle = None
            _model_load_status = "LOAD_FAILED"
    return model_bundle


def get_model_readiness() -> dict:
    """Return non-sensitive model readiness state for health diagnostics."""
    if model_bundle is not None:
        return {"status": "ready", "code": "MODEL_READY"}
    _load_trusted_model()
    if model_bundle is not None:
        return {"status": "ready", "code": "MODEL_READY"}
    code = {
        "TRUST_DISABLED": "MODEL_TRUST_DISABLED",
        "ARTIFACT_MISSING": "MODEL_ARTIFACT_MISSING",
        "ARTIFACT_INVALID": "MODEL_ARTIFACT_INVALID",
        "LOAD_FAILED": "MODEL_ARTIFACT_LOAD_FAILED",
        "READY_PORTABLE": "MODEL_READY",
    }.get(_model_load_status, "MODEL_UNAVAILABLE")
    return {"status": "unavailable", "code": code}


def _portable_tree_predict(node: dict, values: list[float]) -> float:
    """Evaluate one binary LightGBM tree from its portable JSON dump."""
    while "leaf_value" not in node:
        feature_index = int(node["split_feature"])
        value = values[feature_index]
        if math.isnan(value):
            go_left = bool(node.get("default_left", True))
        elif node.get("decision_type", "<=") == "<=":
            go_left = value <= float(node["threshold"])
        else:
            go_left = value == float(node["threshold"])
        node = node["left_child"] if go_left else node["right_child"]
    return float(node["leaf_value"])


def _portable_predict_proba(bundle: dict, values: list[float]) -> float:
    raw_score = sum(
        _portable_tree_predict(tree["tree_structure"], values)
        for tree in bundle["tree_info"]
    )
    raw_score = max(-60.0, min(60.0, raw_score))
    return 1.0 / (1.0 + math.exp(-raw_score))


def normalize_url(value: str) -> str:
    s = str(value).strip()
    if not s:
        return ""
    s = unquote(s)
    s = s.lower()
    s = re.sub(r"\s+", "", s)
    return s


def parse_url(raw_url: str):
    url = normalize_url(raw_url)
    structural_url = str(raw_url).strip().lower()
    structural_url = re.sub(r"\s+", "", structural_url)
    candidate = structural_url if "://" in structural_url else "http://" + structural_url

    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname or ""
        port = None
        try:
            port = parsed.port
        except ValueError:
            return url, None, "", None
        return url, parsed, hostname, port
    except Exception:
        return url, None, "", None
def shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = np.bincount(np.frombuffer(text.encode("utf-8", "ignore"), dtype=np.uint8))
    probs = counts[counts > 0] / len(text.encode("utf-8", "ignore"))
    return float(-(probs * np.log2(probs)).sum())


def safe_ratio(a: float, b: float) -> float:
    return float(a) / max(1.0, float(b))


def extract_features(raw_url: str) -> dict:
    url, parsed, host, port = parse_url(raw_url)

    if parsed is None:
        parsed = urlsplit("http://" + url)
        host = parsed.hostname or ""

    host = host.lower()
    # Decode values only after structural parsing so encoded separators cannot
    # create query/fragment boundaries that were absent in the original URL.
    path = unquote(parsed.path or "").lower()
    query = unquote(parsed.query or "").lower()
    fragment = unquote(parsed.fragment or "").lower()
    scheme = parsed.scheme.lower()

    ext = _TLD_EXTRACTOR(host)
    subdomain = ext.subdomain or ""

    if subdomain.startswith('www.'):
        subdomain = subdomain[4:]
    elif subdomain == 'www':
        subdomain = ""

    suffix = ext.suffix or ""
    domain_name = ext.domain or ""

    full = url
    host_len = len(host)
    path_len = len(path)
    query_len = len(query)
    url_len = len(full)

    digits_url = sum(c.isdigit() for c in full)
    letters_url = sum(c.isalpha() for c in full)

    special_url = sum(
        not c.isalnum() and c not in "._-:/"
        for c in full
    )

    digit_domain = sum(c.isdigit() for c in host)
    hyphen_domain = host.count("-")
    dot_domain = host.count(".")

    suspicious_word_count = sum(
        word in full.lower() for word in SUSPICIOUS_WORDS
    )
    brand_path_count = sum(
        brand in path.lower() or brand in query.lower()
        for brand in BRANDS
    )

    brand_impersonation = int(
        any(brand in full.lower() for brand in BRANDS)
        and not any(brand == domain_name.lower() for brand in BRANDS)
    )



    ipv4_pattern = re.compile(r"^(?:\d{1,3}\.){3}\d{1,3}$")
    is_ipv4 = int(bool(ipv4_pattern.match(host)))

    percent_count = full.count("%")
    at_count = full.count("@")
    amp_count = query.count("&")

    return {
        "url_length": url_len,
        "host_length": host_len,
        "path_length": path_len,
        "query_length": query_len,
        "fragment_length": len(fragment),
        "path_depth": path.count("/"),
        "query_param_count": (amp_count + 1) if query else 0,
        "subdomain_length": len(subdomain),
        "subdomain_count": subdomain.count(".") + (1 if subdomain else 0),
        "domain_length": len(domain_name),
        "tld_length": len(suffix),

        "digit_count_url": digits_url,
        "digit_ratio_url": safe_ratio(digits_url, url_len),
        "digit_count_domain": digit_domain,
        "digit_ratio_domain": safe_ratio(digit_domain, host_len),
        "letter_count_url": letters_url,
        "special_char_count_url": special_url,
        "hyphen_count_domain": hyphen_domain,
        "dot_count_domain": dot_domain,
        "at_count_url": at_count,
        "percent_count_url": percent_count,
        "is_https": int(scheme == "https"),
        "has_ip_host": is_ipv4,
        "has_port": int(port is not None),
        "nonstandard_port": int(port not in (None, 80, 443)),
        "has_at_symbol": int("@" in full),
        "has_double_slash_path": int("//" in path),
        "has_encoded_chars": int("%" in full),
        "has_hex_escape": int(bool(re.search(r"%[0-9a-f]{2}", full))),
        "has_punycode": int("xn--" in host),

        "suspicious_word_count": suspicious_word_count,
        "brand_path_count": brand_path_count,
        "brand_impersonation": brand_impersonation,
        "suspicious_extension": int(
            any(path.lower().endswith(ext) for ext in SUSPICIOUS_EXTENSIONS)
        ),
        "long_subdomain": int(len(subdomain) >= 20),
        "many_subdomains": int(
            (subdomain.count(".") + 1 if subdomain else 0) >= 3
        ),
        "many_digits": int(digits_url >= 8),
        "many_hyphens_domain": int(hyphen_domain >= 3),
        "many_special_chars": int(special_url >= 10),

        "host_entropy": shannon_entropy(host),
        "path_entropy": shannon_entropy(path),
        "url_entropy": shannon_entropy(full),
    }


def predict_url(url: str) -> dict:
    raw_value = str(url or "").strip()
    if not raw_value:
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "EMPTY_INPUT",
        }
    if re.search(r"\s", raw_value):
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "INVALID_URL",
        }
    if re.search(r"%(?:2f|3f|23|40|3a)", raw_value, re.IGNORECASE):
        return {
            "classification": "UNKNOWN",
            "confidence": None,
            "source": "AMBIGUOUS_URL_ENCODING",
        }
    explicit_scheme = re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", raw_value)
    if explicit_scheme and not raw_value.lower().startswith(("http://", "https://")):
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "INVALID_URL",
        }

    url_norm, parsed, host, port = parse_url(url)
    if not url_norm:
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "EMPTY_INPUT",
        }
    if parsed is None or not host or parsed.scheme.lower() not in {"http", "https"}:
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "INVALID_URL",
        }

    ext = _TLD_EXTRACTOR(host)
    if not ext.suffix and not re.match(r"^(?:\d{1,3}\.){3}\d{1,3}$", host) and host != "localhost":
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "INVALID_URL",
        }

    global model_bundle
    if model_bundle is None:
        _load_trusted_model()
    if not model_bundle:
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "MODEL_UNAVAILABLE",
        }

    try:
        feature_names = model_bundle["feature_names"]
        threshold = model_bundle.get("threshold", 0.425)
        features = extract_features(url)
        values = [float(features[name]) for name in feature_names]

        if "model" in model_bundle:
            df = pd.DataFrame([features])[feature_names]
            probs = model_bundle["model"].predict_proba(df)[0]
            label_map = model_bundle.get("label_mapping", {"good": 0, "bad": 1})
            bad_idx = label_map.get("bad", 1)
            phishing_prob = float(probs[bad_idx]) if len(probs) > bad_idx else float(probs[-1])
        else:
            phishing_prob = _portable_predict_proba(model_bundle, values)

        raw_classification = "UNKNOWN"
        context_gated = False
        if phishing_prob >= threshold:
            classification = "DANGEROUS"
            confidence = phishing_prob
            raw_classification = classification
            if _should_gate_known_platform_false_positive(url, features, phishing_prob):
                classification = "SUSPICIOUS"
                confidence = min(0.79, phishing_prob)
                context_gated = True
        elif phishing_prob >= (threshold * 0.6):
            classification = "SUSPICIOUS"
            confidence = phishing_prob
            raw_classification = classification
        else:
            classification = "SAFE"
            confidence = 1.0 - phishing_prob
            raw_classification = classification

        return {
            "classification": classification,
            "confidence": round(confidence, 4),
            "phishing_prob": round(phishing_prob, 4),
            # Keep the public source contract stable; expose the gate separately.
            "source": "ML_MODEL",
            "raw_classification": raw_classification,
            "context_gated": context_gated,
        }
    except Exception:
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "MODEL_ERROR",
        }


async def predict_url_async(
    url: str,
    timeout: float = _DEFAULT_PREDICTION_TIMEOUT_SECONDS,
    predictor_fn=None,
) -> dict:
    """Run synchronous inference without blocking the event loop.

    At most ``_MAX_INFLIGHT_PREDICTIONS`` calls are submitted at once. A timed
    out call keeps its slot until its worker actually finishes; Python cannot
    safely terminate a running thread.
    """
    if not _PREDICTION_SLOTS.acquire(blocking=False):
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "MODEL_BUSY",
        }

    try:
        worker_future = _PREDICTION_EXECUTOR.submit(predictor_fn or predict_url, url)
    except Exception:
        _PREDICTION_SLOTS.release()
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "MODEL_ERROR",
        }

    # Release only when the actual concurrent future is done, not when the
    # awaiting coroutine times out or is cancelled.
    worker_future.add_done_callback(lambda _: _PREDICTION_SLOTS.release())
    try:
        return await asyncio.wait_for(
            asyncio.wrap_future(worker_future), timeout=max(0.0, float(timeout))
        )
    except asyncio.TimeoutError:
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "MODEL_TIMEOUT",
        }
    except Exception:
        return {
            "classification": "UNKNOWN",
            "confidence": 0.5,
            "source": "MODEL_ERROR",
        }


if __name__ == "__main__":
    test_urls = [
        "https://www.google.com",
        "http://paypa1-secure-login-verify.com/account",
        "http://bit.ly/bank-verify",
        "https://github.com/openai/whisper"
    ]
    for u in test_urls:
        res = predict_url(u)
        print(f"{u[:45]:<45} → {res['classification']} (prob={res.get('phishing_prob')}, conf={res.get('confidence')}, source={res.get('source')})")
