import os
import sys
import json
import time
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

supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
service_role_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
admin_email = os.getenv("ADMIN_EMAIL", "mr.isl4m.404@gmail.com").strip().lower()

if len(sys.argv) > 1:
    admin_email = sys.argv[1].strip().lower()

if not supabase_url or not service_role_key:
    raise SystemExit("ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in .env")

headers = {
    "apikey": service_role_key,
    "Authorization": f"Bearer {service_role_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

encoded_email = urllib.parse.quote(admin_email, safe="")

print("=" * 65)
print("Nabeh SafeLink - Delete Admin User Tool")
print(f"Target Supabase: {supabase_url}")
print(f"Target Email:   {admin_email}")
print("=" * 65)

# First check if the user exists
check_url = f"{supabase_url}/rest/v1/admin_users?select=id,email,status&email=eq.{encoded_email}"
check_req = urllib.request.Request(check_url, headers=headers, method="GET")

try:
    with urllib.request.urlopen(check_req, timeout=15) as resp:
        rows = json.loads(fetch_resp.read().decode("utf-8") if 'fetch_resp' in locals() else resp.read().decode("utf-8"))
        if not rows:
            print("\n[NOTICE] No admin account found with this email address.")
            sys.exit(0)

        admin_id = rows[0]["id"]
        freed_email = f"deleted_{int(time.time())}_{admin_email}"

        # Perform soft delete & email release
        patch_url = f"{supabase_url}/rest/v1/admin_users?id=eq.{admin_id}"
        patch_body = json.dumps({
            "email": freed_email,
            "status": "DELETED",
            "two_factor_required": False
        }).encode("utf-8")

        patch_req = urllib.request.Request(patch_url, data=patch_body, headers=headers, method="PATCH")
        with urllib.request.urlopen(patch_req, timeout=15) as patch_resp:
            patched = json.loads(patch_resp.read().decode("utf-8"))
            if patched:
                # Clean sessions & 2FA methods
                for tbl in ["admin_sessions", "admin_2fa_methods", "admin_2fa_recovery_codes"]:
                    del_req = urllib.request.Request(f"{supabase_url}/rest/v1/{tbl}?admin_user_id=eq.{admin_id}", headers=headers, method="DELETE")
                    try:
                        urllib.request.urlopen(del_req, timeout=5)
                    except Exception:
                        pass

                print(f"\n[SUCCESS] Admin email released and account deactivated successfully:")
                print(f"[INFO] Released Email: {admin_email}")
                print("\n[NEXT STEP] You can update .env with a new email and run: python bootstrap_admin.py")
except Exception as ex:
    print(f"\n[ERROR] Execution failed: {ex}")
