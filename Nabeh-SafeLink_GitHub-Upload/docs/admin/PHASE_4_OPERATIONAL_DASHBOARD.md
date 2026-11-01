# المرحلة الرابعة — Dashboard التشغيلي

## النتيجة

تم بناء مسار Admin حقيقي:

```text
GET /api/v1/admin/dashboard/overview?range_days=30
```

المسار محمي بـ Permission Code:

```text
dashboard.read
```

ويقرأ مباشرة من Supabase عبر Backend `service_role`. لا يتم توليد أرقام افتراضية أو استخدام بيانات تجريبية.

## مصدر المؤشرات

| المجموعة | الجدول | المؤشرات |
|---|---|---|
| المستخدمون | `custom_users` | الإجمالي، النشطون، الموقوفون، الجدد خلال الفترة |
| الفحوصات | `scans` | الإجمالي، المكتملة، الفاشلة، قيد المعالجة، SAFE، SUSPICIOUS، DANGEROUS، UNKNOWN، NEEDS_REVIEW |
| Feedback | `feedback` | الإجمالي، الجديد، المراجع |
| الدعم | `support_requests` | OPEN، IN_PROGRESS، URGENT المفتوح، الطلبات الجديدة |
| التدقيق | `admin_audit_logs` | عدد الأحداث خلال الفترة وآخر 8 أحداث |

الفترة قابلة للضبط بين يوم واحد و90 يوماً، والقيمة الافتراضية 30 يوماً.

## سلوك الفشل

إذا كان جدول أو استعلام غير متاح، يرجع Backend `503` برسالة واضحة، وتعرض الواجهة:

> تعذر تحميل Dashboard — لم يتم عرض أرقام بديلة أو وهمية.

هذا يمنع ظهور لوحة تبدو صحيحة بينما مصدر البيانات غير متاح.

## الواجهة

Dashboard يعرض:

- عدد المستخدمين الحقيقي.
- عدد الفحوصات الحقيقي.
- عدد الحالات الخطرة.
- طلبات الدعم المفتوحة.
- توزيع التصنيفات.
- الفحوصات قيد المعالجة.
- البلاغات الجديدة.
- طلبات الدعم العاجلة.
- أحداث التدقيق.

وتظهر حالات Loading وError بوضوح.

## الأداء

تم إنشاء Migration فهارس قراءة مخصصة:

- `idx_scans_classification_created`
- `idx_scans_status_created`
- `idx_feedback_status_created`
- `idx_support_status_priority_created`
- `idx_admin_audit_logs_created_action`

يجب تشغيل Migration الفهارس على Staging ثم Production بعد مراجعة خطة الاستعلامات.

## التحقق المحلي

- Backend tests: `37 passed`.
- Admin Frontend build: ناجح.
- Python compileall: ناجح.
- OpenAPI: مسار Dashboard موجود.
- `git diff --check`: ناجح.

## حدود ما تم إنجازه

تم تنفيذ طبقة المؤشرات التشغيلية والواجهة المرتبطة بها. لم يتم تنفيذ إدارة المستخدمين أو الفحوصات أو الدعم كعمليات تعديل في هذه المرحلة؛ تلك وحدات مستقلة تحتاج مساراتها وصلاحياتها واختباراتها الخاصة.
