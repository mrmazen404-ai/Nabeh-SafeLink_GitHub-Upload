# تنفيذ مراحل Admin 1–8 — Nabeh SafeLink

## نطاق التنفيذ

تم تنفيذ وإغلاق الجزء التشغيلي من المراحل 1–8 في هذه الدفعة:

1. تثبيت مخطط Admin والتحقق من Hash/RLS/Grants.
2. مصادقة Admin وRBAC والجلسات و2FA وAudit الأساسي.
3. Admin Shell محمي ومتجاوب مع RTL/LTR وDark Mode.
4. Dashboard تشغيلي من Supabase.
5. إدارة المستخدمين وتغيير الحالة مع سبب وAudit.
6. إدارة الفحوصات: قائمة، Pagination، فلاتر، تفاصيل مقنّعة، إشارات، تفسيرات، ومراجعة موثقة.
7. Feedback وSupport وAccount Deletion Requests مع الحالات وAudit.
8. Statistics Overview بحد زمني وحسابات Backend.

## Migration الجديدة

بعد تشغيل المخططات الأساسية و`admin_schema.sql` و`user_privacy_data_schema.sql`، شغّل:

```text
backend/sql/admin_operations_migration.sql
```

تضيف Migration روابط Admin التالية:

- `feedback.reviewed_by_admin_id`
- `support_requests.assigned_admin_id`
- `account_deletion_requests.processed_by_admin_id`
- `account_deletion_requests.decision_reason`

وتضيف الفهارس وRLS وGrants المناسبة.

## مسارات API المضافة

كل المسارات تبدأ من `/api/v1/admin` وتحتاج Admin Access Token وصلاحية Backend:

| المسار | الصلاحية | الغرض |
|---|---|---|
| `GET /scans` | `scans.read` | قائمة الفحوصات مع فلاتر وPagination |
| `GET /scans/{id}` | `scans.read` | تفاصيل مقنّعة مع Signals وExplanations |
| `PATCH /scans/{id}/review` | `scans.review` | تغيير التصنيف بسبب موثق |
| `GET /feedback` | `feedback.read` | قائمة البلاغات |
| `PATCH /feedback/{id}/status` | `feedback.manage` | تحديث حالة البلاغ |
| `GET /support` | `support.read` | قائمة طلبات الدعم |
| `PATCH /support/{id}` | `support.manage` | تحديث الحالة والأولوية والتعيين للمسؤول الحالي |
| `GET /deletion-requests` | `users.read` | قائمة طلبات حذف الحساب |
| `PATCH /deletion-requests/{id}` | `users.manage` | قرار موثق بشأن طلب الحذف |
| `GET /statistics/overview` | `dashboard.read` | مؤشرات Backend محددة زمنياً |

## حماية البيانات

- لا تعرض قائمة الفحوصات `input_value_masked`؛ التفاصيل فقط تعرض النسخة المقنّعة.
- لا يوجد مسار Reveal خام في هذه الدفعة، وبالتالي لا يتم كشف URL أو رسالة أصلية.
- البريد في واجهة الدعم مقنّع.
- عمليات Review/Status/Support/Deletion تُسجل في `admin_audit_logs`.
- قرارات الصلاحية تتم في Backend عبر Permission Codes.
- `service_role` لا يظهر في Frontend.

## الاختبارات التي تم تشغيلها

```bash
python -m compileall -q backend main.py
pytest -q
npm run build --prefix admin_frontend
npm run build --prefix frontend
git diff --check
```

النتيجة الحالية:

- Backend: **37 passed**.
- Admin Frontend Build: **نجح** — 70 module، JS بحجم تقريبي 305 KB قبل gzip.
- Main Frontend Build: **نجح**.
- يوجد تحذير واحد فقط من PyJWT عن طول مفتاح اختبار قصير؛ لا يمثل مفتاح الإنتاج.

## تحقق Staging المطلوب قبل Production

1. تشغيل `admin_operations_migration.sql` على Staging.
2. التحقق من وجود الأعمدة والفهارس.
3. إنشاء بيانات اختبار للفحوصات والبلاغات والدعم.
4. اختبار Login و2FA وRefresh وLogout.
5. اختبار Role Matrix لكل `SUPERVISOR` و`ADMIN` و`SUPER_ADMIN`.
6. اختبار فتح `/scans` وقراءة التفاصيل المقنّعة.
7. اختبار Review بسبب واضح والتحقق من Audit.
8. اختبار تحديث Feedback وSupport وDeletion.
9. التحقق من عدم ظهور `password_hash` أو OTP أو Secrets أو المدخل الخام.
10. اختبار WAF وBrute Force في Staging فقط.

## حدود هذه الدفعة

لم تُنفذ بعد الوحدات التالية، ولذلك لا ينبغي وصف النظام بأنه مكتمل 100%:

- إدارة Model Versions.
- Dangerous Indicators.
- إدارة Admins والدعوات والقبول الكامل.
- Notifications Center.
- Settings وPolicy Publishing.
- CSV Export المقنّع.
- E2E Browser Tests وLoad Tests وWAF Provider Rules.
- Reveal Workflow بصلاحية مستقلة.

هذه الوحدات هي المراحل التالية بعد تثبيت Staging لهذه الدفعة.
