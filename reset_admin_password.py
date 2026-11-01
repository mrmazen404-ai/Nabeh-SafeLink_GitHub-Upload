import base64
import getpass
import hashlib
import json
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request


def hash_password(password: str) -> str:
    """Create a password hash compatible with backend/app/admin/security.py."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
    )
    return "scrypt$16384$8$1${}${}".format(
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(digest).decode(),
    )


def request_json(url: str, method: str = "GET", headers: dict | None = None, body: dict | None = None):
    data = None
    request_headers = headers or {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        request_headers = {**request_headers, "Content-Type": "application/json"}

    request = urllib.request.Request(
        url,
        data=data,
        headers=request_headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        response_body = error.read().decode("utf-8", errors="replace")
        print(f"Supabase HTTP Error: {error.code}")
        print(response_body)
        sys.exit(1)
    except urllib.error.URLError as error:
        raise SystemExit(f"Could not connect to Supabase: {error.reason}") from error


print("Supabase URL:")
supabase_url = input().strip().rstrip("/")
if not supabase_url.startswith("https://"):
    raise SystemExit("Supabase URL must start with https://")

service_role_key = getpass.getpass("Supabase service_role key: ").strip()
if not service_role_key:
    raise SystemExit("The service_role key cannot be empty")

print("Admin email:")
email = input().strip().lower()
if "@" not in email:
    raise SystemExit("Enter a valid admin email")

password = getpass.getpass("New admin password (minimum 12 characters): ")
password_confirm = getpass.getpass("Repeat new admin password: ")

if password != password_confirm:
    raise SystemExit("Passwords do not match")
if len(password) < 12:
    raise SystemExit(
        f"Password must be at least 12 characters. Received: {len(password)} characters."
    )

headers = {
    "apikey": service_role_key,
    "Authorization": f"Bearer {service_role_key}",
}

encoded_email = urllib.parse.quote(email, safe="")
lookup_url = (
    f"{supabase_url}/rest/v1/admin_users"
    f"?select=id,email,status,two_factor_required"
    f"&email=eq.{encoded_email}"
)

_, rows = request_json(lookup_url, headers=headers)
if not rows:
    raise SystemExit(
        "No admin account was found for this email. "
        "Check the email address used during bootstrap."
    )

admin = rows[0]
print(f"Found admin account: {admin.get('email')}")
print(f"Current status: {admin.get('status')}")

update_url = f"{supabase_url}/rest/v1/admin_users?email=eq.{encoded_email}"
update_headers = {**headers, "Prefer": "return=minimal"}
request_json(
    update_url,
    method="PATCH",
    headers=update_headers,
    body={
        "password_hash": hash_password(password),
        "status": "ACTIVE",
    },
)

print("Admin password updated successfully.")
print("Open: https://admin.intellidefenda.com")