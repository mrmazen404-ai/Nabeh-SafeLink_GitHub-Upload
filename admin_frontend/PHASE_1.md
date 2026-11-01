# Admin Panel — Phase 1

تم تنفيذ أساس Backend مستقل تحت `/api/v1/admin`:

- Bootstrap لأول `SUPER_ADMIN` عبر `X-Admin-Bootstrap-Token` لمرة واحدة.
- Admin JWT منفصل عن JWT المستخدمين.
- Scrypt password hashing.
- TOTP مع تشفير secret بواسطة Fernet.
- Recovery codes مخزنة كـ hashes.
- Access/refresh sessions مع تدوير refresh token.
- Logout وLogout-all وإدارة الجلسات.
- RBAC عبر `SUPERVISOR`, `ADMIN`, `SUPER_ADMIN`.
- Audit logs append-only عبر SQL trigger.
- Supabase admin tables مع RLS ومنع anon/authenticated.

قبل التشغيل:

1. طبّق `backend/sql/admin_schema.sql` على Supabase في staging أولاً.
2. ولّد `ADMIN_JWT_SECRET` و`ADMIN_IP_SALT` عشوائياً.
3. ولّد مفتاح Fernet لـ `ADMIN_TOTP_ENCRYPTION_KEY`.
4. اضبط `ADMIN_BOOTSTRAP_TOKEN` سرياً ثم احذفه/غيّره بعد bootstrap.
5. ثبّت `pyotp==2.9.0`.

لم تُنفذ بعد وحدات users/scans/statistics/support/settings/models في هذه المرحلة؛ ستأتي بعد تثبيت Auth + Sessions + Audit.
