# User authentication hardening deployment

Before deploying the backend revision that reads `custom_users.auth_token_version`, apply `backend/sql/user_auth_token_version.sql` to the Supabase database. The migration is idempotent and defaults existing accounts to version `0`, so existing versionless access tokens remain compatible until their normal expiration or the next revocation event.

After applying the migration, deploy the backend and frontend together. The backend embeds the current version in new access and password-reset JWTs, checks it against the user row on every authenticated request, increments it on logout and password changes, and rejects an OTP verification if the OTP state was consumed or changed concurrently. Logout intentionally revokes all active sessions for that account.

Configure Upstash REST credentials and a strong random `NABEH_RATE_LIMIT_SALT` in production. Keep `NABEH_RATE_LIMIT_FAIL_CLOSED=true` and `NABEH_AUTH_RATE_LIMIT_FAIL_CLOSED=true`. Set `NABEH_TRUST_PROXY_HEADERS=true` only when requests come from a proxy whose source address is included in `NABEH_TRUSTED_PROXY_CIDRS` and which overwrites incoming forwarding headers.

Post-deployment checks should use a synthetic staging account: (1) wrong OTP for an existing verified address does not issue a token; (2) correct OTP succeeds once and a concurrent/repeated use fails; (3) rate limits return 429 when exceeded and 503 when the limiter is unavailable under fail-closed; (4) logout and password change invalidate the old token. Do not use real customers for these checks.

Before deploying the atomic privacy-deletion routes, also apply `backend/sql/user_privacy_deletion_atomic.sql`. It installs service-role-only PostgreSQL functions for per-scan and per-account deletion; the functions run in one database transaction, remove scan-specific evidence, anonymize retained scan/audit data, invalidate account sessions, and mark the deletion request complete. Do not deploy those route changes before this migration is installed.

Apply `backend/sql/user_terms_consent_type.sql` before enabling mandatory latest-terms checks. It updates the `privacy_consents.consent_type` check constraint to allow the existing `TERMS_OF_USE` records used by `TermsConsentGate`; without it, consent recording and protected APIs will fail.

Also apply `backend/sql/user_signup_otp_atomic.sql` after the token-version migration and before deploying the hardened signup route. The function consumes the OTP and inserts or verifies the account in one PostgreSQL transaction; a database failure rolls back both changes.
