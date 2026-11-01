python3 <<'PY'
import secrets
from cryptography.fernet import Fernet

print("AUTH_JWT_SECRET=" + secrets.token_urlsafe(64))
print("AUTH_OTP_PEPPER=" + secrets.token_urlsafe(64))
print("ADMIN_JWT_SECRET=" + secrets.token_urlsafe(64))
print("ADMIN_BOOTSTRAP_TOKEN=" + secrets.token_urlsafe(48))   # ← هذا هو المطلوب
print("ADMIN_IP_SALT=" + secrets.token_urlsafe(48))
print("NABEH_RATE_LIMIT_SALT=" + secrets.token_urlsafe(48))
print("ADMIN_TOTP_ENCRYPTION_KEY=" + Fernet.generate_key().decode())