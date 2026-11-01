# Admin Security Hardening

طبّق ملفات SQL بالترتيب التالي في Supabase قبل نشر نسخة Backend المصححة:

1. `backend/sql/admin_schema.sql`
2. `backend/sql/admin_operations_migration.sql`
3. `backend/sql/admin_system_settings.sql`
4. `backend/sql/admin_security_hardening.sql`

ملف `admin_security_hardening.sql` يضيف:

- `admin_bootstrap_first`: إنشاء أول Super Admin داخل قفل PostgreSQL ذري.
- `admin_accept_invitation`: قبول الدعوة وإنشاء المسؤول وتعليم الدعوة كمستخدمة داخل معاملة واحدة.
- صلاحيات تنفيذ محصورة بـ`service_role`.

الإصلاحات البرمجية المرافقة:

- منع إعادة استخدام خطوة TOTP نفسها عبر تحديث ذري لـ`last_used_step`.
- Rate Limit لتأكيد إعداد 2FA.
- استهلاك Recovery Code بعملية ذرية.
- State machine لطلبات حذف الحساب.
- رفض Broadcast إذا تجاوز الجمهور الحد الآمن بدل الإرسال الجزئي الصامت.
- تخزين Refresh Token في `sessionStorage` بدل `localStorage` داخل Admin Frontend.
- واجهة `/invite?token=...` لقبول دعوات المسؤولين.
- تحقق Startup من الأسرار عند ضبط `NABEH_ENVIRONMENT=staging` أو `production`.

بعد تطبيق SQL اضبط:

```text
NABEH_ENVIRONMENT=production
ADMIN_JWT_SECRET=<random secret, 32+ chars>
ADMIN_BOOTSTRAP_TOKEN=<one-time random secret, 32+ chars>
ADMIN_IP_SALT=<random secret, 32+ chars>
ADMIN_TOTP_ENCRYPTION_KEY=<valid Fernet key>
SUPABASE_SECRET_KEY=<server-side service role key>
NABEH_CORS_ALLOWED_ORIGINS=https://<admin-domain>
```

لا تضع أيًا من هذه القيم داخل Git أو ملفات `dist`.
