"""URL validation and text extraction shared by scan routes and scan services.

This module deliberately accepts only HTTP(S) web URLs, normalizes scheme/host
(and IDN hostnames), and preserves path, query, and fragment data.
"""

import ipaddress
import re
from urllib.parse import urlsplit, urlunsplit

_HTTP_SCHEMES = {"http", "https"}
_SCHEME_RE = re.compile(r"^([A-Za-z][A-Za-z0-9+.-]*):")
_HOST_WITH_PORT_RE = re.compile(r"^(?:\[[0-9a-fA-F:.]+\]|[^:/\s]+):\d+(?:[/?#]|$)")
_LABEL = r"[^\W_](?:(?:[^\W_]|-){0,61}[^\W_])?"
_EXPLICIT_URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"']+", re.IGNORECASE)
_DEFANGED_LINK_RE = re.compile(
    r"(?<![\w@])(?:hxxps?://[^\s<>\"']+|https?\s*\[:\]\s*//[^\s<>\"']+|[^\s<>\"']*(?:\[\.\]|\(\.\)|\{\.\})[^\s<>\"']*)",
    re.IGNORECASE,
)
_BARE_DOMAIN_RE = re.compile(
    rf"(?<![\w@])(?:{_LABEL}\.)+{_LABEL}(?::\d{{1,5}})?(?:[/?#][^\s<>\"']*)?(?:[.,;:!?،؛؟۔]+)?(?=$|[\s<>\"')\]\}}])",
    re.IGNORECASE | re.UNICODE,
)
_TRAILING_SENTENCE_PUNCTUATION = ".,;:!?،؛؟۔"
_CLOSING_PAIRS = {")": "(", "]": "[", "}": "{"}


def normalize_web_url(value: str) -> str:
    """Validate one HTTP(S) URL and return a stable scheme/host representation.

    A missing scheme defaults to HTTPS. Free text, credentials in the authority,
    malformed IDNs/hosts, ambiguous non-HTTP schemes, control characters, and
    invalid ports are rejected. The original path, query, and fragment are kept.
    """
    raw = str(value or "").strip()
    if not raw or any(char.isspace() or ord(char) < 0x20 or ord(char) == 0x7F for char in raw):
        raise ValueError("invalid_url")
    if "\\" in raw or re.search(r"%(?![0-9a-fA-F]{2})", raw):
        raise ValueError("invalid_url")

    scheme_match = _SCHEME_RE.match(raw)
    has_host_port = bool(_HOST_WITH_PORT_RE.match(raw))
    if scheme_match and scheme_match.group(1).lower() not in _HTTP_SCHEMES and not has_host_port:
        raise ValueError("unsupported_scheme")

    if raw.startswith("//"):
        candidate = f"https:{raw}"
    elif scheme_match and scheme_match.group(1).lower() in _HTTP_SCHEMES:
        candidate = raw
    else:
        candidate = f"https://{raw}"
    try:
        parsed = urlsplit(candidate)
        host = parsed.hostname or ""
        port = parsed.port
    except ValueError as error:
        raise ValueError("invalid_url") from error

    if parsed.scheme.lower() not in _HTTP_SCHEMES or not host:
        raise ValueError("invalid_url")
    if parsed.username is not None or parsed.password is not None or "%" in parsed.netloc:
        raise ValueError("ambiguous_authority")
    if port is not None and not 1 <= port <= 65535:
        raise ValueError("invalid_port")

    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        if ":" in host or "%" in host:
            raise ValueError("invalid_host") from None
        try:
            ascii_host = host.encode("idna").decode("ascii").lower().rstrip(".")
        except (UnicodeError, ValueError):
            raise ValueError("invalid_host") from None

        if not ascii_host or len(ascii_host) > 253:
            raise ValueError("invalid_host")
        if ascii_host == "localhost":
            host_display = ascii_host
        else:
            labels = ascii_host.split(".")
            if len(labels) < 2 or re.fullmatch(r"[0-9.]+", ascii_host):
                raise ValueError("invalid_host")
            if any(
                not label
                or len(label) > 63
                or re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", label) is None
                for label in labels
            ):
                raise ValueError("invalid_host")
            host_display = ascii_host
    else:
        host_display = f"[{address.compressed}]" if address.version == 6 else address.compressed

    netloc = host_display + (f":{port}" if port is not None else "")
    return urlunsplit((parsed.scheme.lower(), netloc, parsed.path, parsed.query, parsed.fragment))


def _trim_text_delimiters(candidate: str) -> str:
    candidate = candidate.strip()
    while candidate:
        previous = candidate
        while candidate and candidate[-1] in _CLOSING_PAIRS:
            opener = _CLOSING_PAIRS[candidate[-1]]
            if candidate.count(candidate[-1]) > candidate.count(opener):
                candidate = candidate[:-1]
            else:
                break
        candidate = candidate.rstrip(_TRAILING_SENTENCE_PUNCTUATION)
        if candidate == previous:
            break
    return candidate


def _follows_defanged_scheme(text: str, start: int) -> bool:
    prefix = text[max(0, start - 24):start]
    match = re.search(
        r"\b([a-z][a-z0-9+.-]*)(\s*:\s*//|\s*\[\s*:\s*\]\s*//|\s*\(\s*:\s*\)\s*//)\s*$",
        prefix,
        re.IGNORECASE,
    )
    if not match:
        return False
    scheme = match.group(1).lower()
    delimiter = match.group(2)
    return scheme not in _HTTP_SCHEMES or "[" in delimiter or "(" in delimiter


def extract_web_urls_from_text(text: str) -> list[str]:
    """Extract distinct, valid HTTP(S) URLs from prose in first-seen order.

    Recognizes explicit URLs, www-prefixed hosts, and bare ASCII/IDN domains.
    It trims common sentence/wrapper delimiters, rejects invalid candidates,
    and never silently rewrites defanged scheme spellings into live URLs.
    """
    if not text:
        return []

    explicit = list(_EXPLICIT_URL_RE.finditer(text))
    spans = [(match.start(), match.end()) for match in explicit]
    matches = [(match.start(), match.group(0)) for match in explicit]
    for match in _BARE_DOMAIN_RE.finditer(text):
        if any(start <= match.start() < end for start, end in spans):
            continue
        if _follows_defanged_scheme(text, match.start()):
            continue
        matches.append((match.start(), match.group(0)))

    urls: list[str] = []
    seen: set[str] = set()
    for _, raw_candidate in sorted(matches, key=lambda item: item[0]):
        candidate = _trim_text_delimiters(raw_candidate)
        if not candidate:
            continue
        try:
            normalized = normalize_web_url(candidate)
        except ValueError:
            continue
        if normalized not in seen:
            seen.add(normalized)
            urls.append(normalized)
    return urls


def extract_defanged_urls_from_text(text: str) -> list[str]:
    """Find common defanged-link spellings without converting them to live URLs."""
    if not text:
        return []
    candidates: list[str] = []
    seen: set[str] = set()
    for match in _DEFANGED_LINK_RE.finditer(text):
        candidate = match.group(0).strip().lstrip("([{<\"'")
        candidate = _trim_text_delimiters(candidate)
        if candidate and candidate not in seen:
            seen.add(candidate)
            candidates.append(candidate)
    return candidates
