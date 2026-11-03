import pytest

from app.scans.url_utils import extract_defanged_urls_from_text, extract_web_urls_from_text, normalize_web_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("example.com", "https://example.com"),
        ("//example.com/path", "https://example.com/path"),
        ("HTTP://EXAMPLE.COM/a?x=1#Frag", "http://example.com/a?x=1#Frag"),
        ("example.com:8443/path", "https://example.com:8443/path"),
        ("www.Example.com", "https://www.example.com"),
        ("192.0.2.1/path", "https://192.0.2.1/path"),
        ("[2001:0db8::1]:8443/path", "https://[2001:db8::1]:8443/path"),
        ("https://example.com/a%2Fb?x=%3F#frag", "https://example.com/a%2Fb?x=%3F#frag"),
    ],
)
def test_normalize_web_url_supports_common_web_url_forms(raw, expected):
    assert normalize_web_url(raw) == expected


def test_normalize_web_url_converts_unicode_host_to_idna_and_keeps_path():
    host = "مثال.إختبار"
    expected_host = host.encode("idna").decode("ascii").lower()
    assert normalize_web_url(f"{host}/مسار?بحث=1#قسم") == f"https://{expected_host}/مسار?بحث=1#قسم"


@pytest.mark.parametrize(
    "raw",
    [
        "ordinary text",
        "visit https://example.com now",
        "https://one.example https://two.example",
        "ftp://example.com/file",
        "https://user@example.com/path",
        "https://a..b/path",
        "https://999.999.999.999/path",
        "https://example.com:65536/path",
        "https://example.com/path with-space",
        "https://example.com/%ZZ",
        "https://[fe80::1%25eth0]/path",
    ],
)
def test_normalize_web_url_rejects_ambiguous_or_invalid_inputs(raw):
    with pytest.raises(ValueError):
        normalize_web_url(raw)


def test_extract_urls_from_markdown_html_punctuation_and_multiline_text():
    text = (
        "افحص (https://example.com/a?x=1&y=2#frag)، ثم [https://SECOND.example/path].\n"
        "رابط HTML: <a href=\"https://third.example/login\">افتح</a>"
    )
    assert extract_web_urls_from_text(text) == [
        "https://example.com/a?x=1&y=2#frag",
        "https://second.example/path",
        "https://third.example/login",
    ]


def test_extract_urls_normalizes_idn_and_deduplicates_equivalent_hosts():
    host = "مثال.إختبار"
    canonical = host.encode("idna").decode("ascii").lower()
    text = f"{host}/مسار ثم https://{canonical}/مسار"
    assert extract_web_urls_from_text(text) == [f"https://{canonical}/مسار"]


def test_extract_urls_skips_email_numbers_unsupported_and_defanged_links():
    text = (
        "بريد user@example.com ورقم 1.2، ftp://bad.example، "
        "hxxps://evil.example، https[:]//other.example، example[.]com"
    )
    assert extract_web_urls_from_text(text) == []


def test_extract_defanged_urls_reports_original_spelling_without_rewriting():
    text = "(hxxps://evil.example/path)، example[.]com/login و https[:]//bad.example"
    assert extract_defanged_urls_from_text(text) == [
        "hxxps://evil.example/path",
        "example[.]com/login",
        "https[:]//bad.example",
    ]


def test_extractor_does_not_return_a_valid_prefix_of_malformed_host_or_port():
    text = "example.com:999999 invalid.example_suffix good.example/path."
    assert extract_web_urls_from_text(text) == ["https://good.example/path"]


def test_extract_urls_keeps_query_fragment_and_distinct_destinations():
    text = "https://example.com/path?x=1#one https://example.com/path?x=2#one"
    assert extract_web_urls_from_text(text) == [
        "https://example.com/path?x=1#one",
        "https://example.com/path?x=2#one",
    ]
