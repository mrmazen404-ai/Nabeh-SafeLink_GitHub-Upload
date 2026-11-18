import os
import sys
import json
import base64
import secrets
import hashlib
import urllib.request
import urllib.parse
from dotenv import load_dotenv

# Ensure UTF-8 output encoding for Windows Command Prompt
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_file, override=True)

default_host = os.getenv("TARGET_HOST", "http://localhost:8000").rstrip("/")
target_host = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else default_host

URL = f"{target_host}/api/v1/admin/auth/bootstrap"
BOOTSTRAP_TOKEN = os.getenv("ADMIN_BOOTSTRAP_TOKEN", "").strip()

EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
DISPLAY_NAME = os.getenv("ADMIN_NAME", "Super Admin").strip()
PASSWORD = os.getenv("ADMIN_PASSWORD", "")

missing = [
    name for name, value in {
        "ADMIN_BOOTSTRAP_TOKEN": BOOTSTRAP_TOKEN,
        "ADMIN_EMAIL": EMAIL,
        "ADMIN_NAME": DISPLAY_NAME,
        "ADMIN_PASSWORD": PASSWORD,
    }.items() if not value
]
if missing:
    raise SystemExit("Missing required environment variables in .env: " + ", ".join(missing))

# Import official backend password hashing function
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))
try:
    from app.admin.security import hash_password
except ImportError:
    def hash_password(pwd: str) -> str:
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(pwd.encode("utf-8"), salt=salt, n=16384, r=8, p=1, maxmem=0, dklen=64)
        s1 = base64.urlsafe_b64encode(salt).decode()
        d1 = base64.urlsafe_b64encode(digest).decode()
        return f"scrypt$16384$8$1${s1}${d1}"

headers = {
    "Content-Type": "application/json",
    "X-Admin-Bootstrap-Token": BOOTSTRAP_TOKEN,
}

payload = {
    "email": EMAIL,
    "display_name": DISPLAY_NAME,
    "password": PASSWORD,
}

print("=" * 65)
print("Nabeh SafeLink - Admin Bootstrap Tool")
print(f"Target Endpoint: {URL}")
print(f"Admin Email:     {EMAIL}")
print("=" * 65)

def direct_supabase_update():
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    if not supabase_url or not service_key:
        print("ERROR: Could not connect to Supabase (SUPABASE_URL/SUPABASE_SECRET_KEY missing in .env).")
        return False

    db_headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    # Check if there is an existing admin row to patch or insert
    fetch_url = f"{supabase_url}/rest/v1/admin_users?select=id,email&limit=1"
    fetch_req = urllib.request.Request(fetch_url, headers=db_headers, method="GET")
    try:
        with urllib.request.urlopen(fetch_req, timeout=15) as fetch_resp:
            rows = json.loads(fetch_resp.read().decode("utf-8"))
            if rows:
                admin_id = rows[0]["id"]
                patch_url = f"{supabase_url}/rest/v1/admin_users?id=eq.{admin_id}"
                patch_body = json.dumps({
                    "email": EMAIL,
                    "display_name": DISPLAY_NAME,
                    "password_hash": hash_password(PASSWORD),
                    "status": "ACTIVE",
                    "email_verified": True,
                    "two_factor_required": True
                }).encode("utf-8")
                patch_req = urllib.request.Request(patch_url, data=patch_body, headers=db_headers, method="PATCH")
                with urllib.request.urlopen(patch_req, timeout=15) as patch_resp:
                    patched = json.loads(patch_resp.read().decode("utf-8"))
                    if patched:
                        for tbl in ["admin_sessions", "admin_2fa_methods", "admin_2fa_recovery_codes"]:
                            del_req = urllib.request.Request(f"{supabase_url}/rest/v1/{tbl}?admin_user_id=eq.{admin_id}", headers=db_headers, method="DELETE")
                            try:
                                urllib.request.urlopen(del_req, timeout=5)
                            except Exception:
                                pass
                        print(f"\n[SUCCESS] Admin account activated for email: {EMAIL}")
                        print("[INFO] Password matched with .env settings.")
                        print("[INFO] 2FA Requirement Enabled (two_factor_required: True)")
                        print("\n[NEXT STEP] You can now log in at http://localhost:5174 using your email and password!")
                        return True
            else:
                # Insert new admin row directly
                insert_url = f"{supabase_url}/rest/v1/admin_users"
                insert_body = json.dumps({
                    "email": EMAIL,
                    "display_name": DISPLAY_NAME,
                    "password_hash": hash_password(PASSWORD),
                    "role": "SUPER_ADMIN",
                    "status": "ACTIVE",
                    "email_verified": True,
                    "two_factor_required": True
                }).encode("utf-8")
                insert_req = urllib.request.Request(insert_url, data=insert_body, headers=db_headers, method="POST")
                with urllib.request.urlopen(insert_req, timeout=15) as insert_resp:
                    inserted = json.loads(insert_resp.read().decode("utf-8"))
                    if inserted:
                        print(f"\n[SUCCESS] Admin account created for email: {EMAIL}")
                        print("[INFO] Password matched with .env settings.")
                        print("[INFO] 2FA Requirement Enabled (two_factor_required: True)")
                        print("\n[NEXT STEP] You can now log in at http://localhost:5174 using your email and password!")
                        return True
    except Exception as ex:
        print(f"ERROR updating admin in Supabase: {ex}")
    return False

# Try standard API bootstrap first
req = urllib.request.Request(URL, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        raw = resp.read().decode("utf-8")
        data = json.loads(raw) if raw else {}
        print(f"\nResponse Status Code: {resp.status}")
        print(json.dumps(data, indent=4, ensure_ascii=False))
        print("\n[SUCCESS] Admin account created successfully!")
        sys.exit(0)
except urllib.error.HTTPError as err:
    body = err.read().decode("utf-8", errors="replace")
    if err.code == 409:
        print("\n[NOTICE] Admin user exists in DB. Updating admin credentials directly from .env...")
        if direct_supabase_update():
            sys.exit(0)
    else:
        print(f"\n[ERROR] Operation failed ({err.code}): {body}")
except Exception:
    print("\n[NOTICE] Local server offline, updating admin credentials directly in Supabase...")
    if direct_supabase_update():
        sys.exit(0)
