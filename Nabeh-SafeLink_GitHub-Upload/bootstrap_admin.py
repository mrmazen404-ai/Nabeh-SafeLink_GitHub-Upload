import os
import sys
import json
import requests

# Target host can be overridden via environment variable or command line argument
default_host = "https://www.intellidefenda.com"
target_host = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else os.getenv("TARGET_HOST", default_host).rstrip("/")

URL = f"{target_host}/api/v1/admin/auth/bootstrap"
BOOTSTRAP_TOKEN = os.getenv("ADMIN_BOOTSTRAP_TOKEN", "").strip()

EMAIL = os.getenv("ADMIN_EMAIL", "").strip()
DISPLAY_NAME = os.getenv("ADMIN_NAME", "").strip()
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
    raise SystemExit("Missing required environment variables: " + ", ".join(missing))

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
print(f"🚀 Nabeh SafeLink — Admin Bootstrap Tool")
print(f"📡 Target Endpoint: {URL}")
print(f"👤 Admin Email:     {EMAIL}")
print("=" * 65)

try:
    response = requests.post(URL, headers=headers, json=payload, timeout=30)
    print(f"\n📥 Response Status Code: {response.status_code}\n")

    try:
        print(json.dumps(response.json(), indent=4, ensure_ascii=False))
    except ValueError:
        print(response.text)

    if response.status_code in (200, 201):
        print("\n✅ تم إنشاء وتفعيل حساب الأدمن في Vercel بنجاح!")
    elif response.status_code == 409:
        print("\n⚠️ حساب الأدمن موجود ومفعل مسبقاً على هذا السيرفر.")
    elif response.status_code == 401:
        print("\n❌ توكن Bootstrap غير صحيح.")
    elif response.status_code == 404:
        print("\n❌ التوكن مفقود أو المسار غير موجود. تحقق من متغيرات البيئة في Vercel.")
    else:
        print(f"\n❌ فشل العملية: {response.status_code}")

except requests.exceptions.ConnectionError:
    print("\n❌ تعذر الاتصال بالسيرفر الهدف. تأكد من أن السيرفر شغال والرابط صحيح.")
except Exception as e:
    print(f"\n❌ خطأ غير متوقع: {e}")
