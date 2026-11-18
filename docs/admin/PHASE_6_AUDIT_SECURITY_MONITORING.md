# المرحلة السادسة — Audit Logs والأمان والمراقبة المتقدمة

## مسارات API

تم توسيع مركز التدقيق إلى المسارات التالية:

```text
GET /api/v1/admin/audit-logs
GET /api/v1/admin/audit-logs/{log_id}
GET /api/v1/admin/security/overview?range_days=7
```

جميع المسارات تتطلب `audit.read` وتتحقق من جلسة Admin وRBAC في Backend.

## سجل التدقيق

قائمة الأحداث تدعم:

- Pagination عبر `limit` و`offset`.
- فلترة `action`.
- فلترة `resource_type`.
- فلترة `from_date` و`to_date` عبر API.
- إجمالي النتائج في `meta.total`.
- المعرّف والفاعل والمورد وRequest ID والتوقيت.

القائمة لا ترجع `before_data` أو `after_data` مباشرة؛ التفاصيل تطلب بشكل منفصل لتقليل كشف البيانات.

## الإخفاء

تفاصيل الحدث تمر عبر Redaction قبل إرسالها للواجهة. يتم إخفاء أو تنقيح الحقول التي تحتوي على:

- Passwords.
- Tokens.
- Secrets.
- OTP/Recovery Codes.
- Hashes.
- Cipher/Nonce values.
- البريد الإلكتروني يتم عرضه بصيغة مقنّعة.

Audit Logs نفسها Append-only في قاعدة البيانات، ولا يوجد مسار API للتعديل أو الحذف.

## المراقبة الأمنية

`security/overview` يحسب من الجداول الفعلية:

- إجمالي محاولات دخول Admin.
- المحاولات الناجحة.
- المحاولات الفاشلة.
- Rate Limited.
- الجلسات النشطة.
- الجلسات الملغاة.
- المسؤولون النشطون والموقوفون.
- إجمالي أحداث التدقيق خلال الفترة.

ويحسب مستوى الخطر:

- `NORMAL`: لا يوجد نشاط مقلق.
- `ELEVATED`: خمس محاولات فاشلة أو أكثر.
- `HIGH`: توجد محاولات محجوبة بسبب Rate Limit.

هذا تصنيف تشغيلي أولي وليس بديلاً عن SIEM أو فريق استجابة للحوادث.

## الواجهة

تمت إضافة:

- بطاقات مؤشرات الأمان.
- فلترة الإجراء ونوع المورد.
- Pagination.
- نافذة تفاصيل مقنّعة.
- حالة Loading وError وEmpty.
- تصميم متجاوب.

## فهارس الأداء

تم إنشاء Migration للفهرسة:

- `idx_admin_audit_logs_action_time`
- `idx_admin_audit_logs_resource_time`
- `idx_admin_login_attempts_outcome_time`
- `idx_admin_sessions_expiry_revoked`

تشغّل Migration على Staging ثم Production بعد مراجعة خطة التنفيذ.

## التحقق

- Backend tests: `37 passed`.
- Admin Frontend build: ناجح.
- Python compileall: ناجح.
- OpenAPI: مسارات Audit والأمان موجودة.
- `git diff --check`: ناجح.

لم يتم تنفيذ قراءة حية من Supabase داخل Sandbox؛ البيانات المعروضة في الإنتاج ستكون من الجداول الفعلية، أو تظهر حالة فشل صريحة عند تعذر المصدر.
