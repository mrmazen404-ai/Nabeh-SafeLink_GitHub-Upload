"""Pytest configuration for backend tests."""
import os
import sys
from pathlib import Path
# Add backend/ to sys.path so 'app' is importable
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
# Safe test environment variables (avoid real connections)
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-service-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-for-testing-only")
os.environ.setdefault("AUTH_OTP_PEPPER", "test-otp-pepper")
os.environ.setdefault("NABEH_TRUST_MODEL_ARTIFACT", "false")
os.environ.setdefault("VIRUSTOTAL_API_KEY", "test-vt-key")
