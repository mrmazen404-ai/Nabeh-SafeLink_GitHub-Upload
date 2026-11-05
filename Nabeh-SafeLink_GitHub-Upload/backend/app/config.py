import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    ENVIRONMENT: str = os.getenv("NABEH_ENVIRONMENT", "development").lower()
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    GEMINI_RATE_LIMIT_RETRIES: int = max(0, min(2, int(os.getenv("GEMINI_RATE_LIMIT_RETRIES", "1"))))
    GEMINI_RATE_LIMIT_BACKOFF_SECONDS: float = max(0.0, min(5.0, float(os.getenv("GEMINI_RATE_LIMIT_BACKOFF_SECONDS", "1"))))
    GEMINI_RATE_LIMIT_MAX_WAIT_SECONDS: float = max(0.0, min(10.0, float(os.getenv("GEMINI_RATE_LIMIT_MAX_WAIT_SECONDS", "4"))))
    AUTH_JWT_SECRET: str = os.getenv("AUTH_JWT_SECRET", "")
    AUTH_OTP_PEPPER: str = os.getenv("AUTH_OTP_PEPPER", "")
    AUTH_ACCESS_TOKEN_MINUTES: int = int(os.getenv("AUTH_ACCESS_TOKEN_MINUTES", "60"))
    AUTH_OTP_MINUTES: int = int(os.getenv("AUTH_OTP_MINUTES", "10"))
    AUTH_OTP_MAX_ATTEMPTS: int = int(os.getenv("AUTH_OTP_MAX_ATTEMPTS", "5"))
    ADMIN_JWT_SECRET: str = os.getenv("ADMIN_JWT_SECRET", "")
    ADMIN_JWT_ISSUER: str = os.getenv("ADMIN_JWT_ISSUER", "nabeh-admin")
    ADMIN_JWT_AUDIENCE: str = os.getenv("ADMIN_JWT_AUDIENCE", "nabeh-admin-api")
    ADMIN_TOTP_ENCRYPTION_KEY: str = os.getenv("ADMIN_TOTP_ENCRYPTION_KEY", "")
    ADMIN_BOOTSTRAP_TOKEN: str = os.getenv("ADMIN_BOOTSTRAP_TOKEN", "")
    ADMIN_TOTP_ISSUER: str = os.getenv("ADMIN_TOTP_ISSUER", "Nabeh Admin")
    ADMIN_ACCESS_TOKEN_MINUTES: int = int(os.getenv("ADMIN_ACCESS_TOKEN_MINUTES", "30"))
    ADMIN_REFRESH_TOKEN_DAYS: int = int(os.getenv("ADMIN_REFRESH_TOKEN_DAYS", "7"))
    ADMIN_LOGIN_RATE_LIMIT: int = int(os.getenv("ADMIN_LOGIN_RATE_LIMIT", "5"))
    ADMIN_IP_SALT: str = os.getenv("ADMIN_IP_SALT", "")
    VISITOR_HASH_SALT: str = os.getenv("VISITOR_HASH_SALT", "")
    SCAN_ML_TIMEOUT_SECONDS: float = max(0.05, min(10.0, float(os.getenv("SCAN_ML_TIMEOUT_SECONDS", "2"))))
    SCAN_AI_TIMEOUT_SECONDS: float = float(os.getenv("SCAN_AI_TIMEOUT_SECONDS", "18"))
    SCAN_TOTAL_TIMEOUT_SECONDS: float = max(1.0, float(os.getenv("SCAN_TOTAL_TIMEOUT_SECONDS", "30")))
    SCAN_METRIC_TIMEOUT_SECONDS: float = max(0.05, min(5.0, float(os.getenv("SCAN_METRIC_TIMEOUT_SECONDS", "0.5"))))
    SCAN_IDEMPOTENCY_ENABLED: bool = os.getenv("SCAN_IDEMPOTENCY_ENABLED", "false").lower() in {"1", "true", "yes"}
    NABEH_TRUST_PROXY_HEADERS: bool = os.getenv("NABEH_TRUST_PROXY_HEADERS", "false").lower() in {"1", "true", "yes"}
    RATE_LIMIT_FAIL_CLOSED: bool = os.getenv("NABEH_RATE_LIMIT_FAIL_CLOSED", "true").lower() in {"1", "true", "yes"}
    RATE_LIMIT_SALT: str = os.getenv("NABEH_RATE_LIMIT_SALT", "")
    APP_NAME: str = os.getenv("APP_NAME", "Nabeh SafeLink")
    APP_VERSION: str = os.getenv("APP_VERSION", "1.0.0")
    CORS_ALLOWED_ORIGINS: tuple = tuple(
        origin.strip().rstrip("/")
        for origin in os.getenv("NABEH_CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")
        if origin.strip()
    )

    def validate_admin_security(self) -> None:
        if self.ENVIRONMENT not in {"production", "staging"}:
            return
        if os.getenv("NABEH_TRUST_MODEL_ARTIFACT", "").lower() not in {"1", "true", "yes"}:
            raise RuntimeError("NABEH_TRUST_MODEL_ARTIFACT=true is required in production")
        if not os.getenv("VIRUSTOTAL_API_KEY", "").strip():
            raise RuntimeError("VIRUSTOTAL_API_KEY is required in production")
        if len(self.ADMIN_JWT_SECRET) < 32:
            raise RuntimeError("ADMIN_JWT_SECRET must be at least 32 characters in production")
        if len(self.ADMIN_BOOTSTRAP_TOKEN) < 32:
            raise RuntimeError("ADMIN_BOOTSTRAP_TOKEN must be at least 32 characters in production")
        if len(self.ADMIN_IP_SALT) < 32:
            raise RuntimeError("ADMIN_IP_SALT must be at least 32 characters in production")
        if len(self.SUPABASE_SECRET_KEY) < 32:
            raise RuntimeError("SUPABASE_SECRET_KEY is required in production")
        if not self.ADMIN_TOTP_ENCRYPTION_KEY:
            raise RuntimeError("ADMIN_TOTP_ENCRYPTION_KEY is required in production")
        if not self.CORS_ALLOWED_ORIGINS:
            raise RuntimeError("Explicit CORS origins are required in production")
        if not self.RATE_LIMIT_FAIL_CLOSED:
            raise RuntimeError("NABEH_RATE_LIMIT_FAIL_CLOSED must be true in production")


settings = Settings()
