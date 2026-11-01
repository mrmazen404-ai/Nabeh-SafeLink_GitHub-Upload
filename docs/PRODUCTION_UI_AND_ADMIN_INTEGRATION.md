# تقرير الإصدار: UI / Admin Operations Integration

التاريخ: 2026-10-16

## ما تم تنفيذه

### 1. استقرار الواجهة وتحديث المسارات
- إضافة `AppErrorBoundary` حتى لا تتحول أخطاء React أو تحميل chunk إلى صفحة بيضاء صامتة.
- تحسين `lazyWithRetry`: إعادة تحميل واحدة فقط عند فشل chunk، ثم عرض شاشة خطأ صريحة مع زر إعادة المحاولة.
- لم يتم تغيير المسارات أو منطق الفحص؛ الإصلاح يعالج طبقة العرض والتعافي.
- FastAPI يحتوي بالفعل على SPA fallback للمسارات عند التحديث، بينما `frontend/vercel.json` مسؤول عن نشر SPA المستقل.

### 2. Responsive / Mobile-first
- إضافة guardrails عامة تمنع overflow وتحوّل أزرار الهاتف إلى عرض كامل.
- تضييق شبكة Scanner إلى عمود واحد تحت 700px، ومنع تمدد بطاقات URL/SMS الطويلة، والتعامل مع النصوص والروابط الطويلة بـ `overflow-wrap`.
- إضافة تحسينات للصفحات المتقدمة والتقارير والشروط في المقاسات الصغيرة، مع دعم `data-theme="dark"`.
- الحفاظ على RTL/LTR وعدم إزالة أي وظيفة موجودة.

### 3. الدعم والإشعارات
- Migration جديد يضيف إلى `support_requests`:
  - `admin_reply text`
  - `replied_at timestamptz`
- رد Admin على طلب الدعم يحفظ الرد ويرسل إشعار `SYSTEM` للمستخدم.
- بيانات الدعم التي تعود للمستخدم تتضمن الرد وتاريخه.
- إضافة Admin API:
  - `POST /api/v1/admin/notifications/broadcast`
  - الصلاحية: `users.manage`
  - يرسل إشعاراً داخل التطبيق إلى المستخدمين النشطين على دفعات 500 ويسجل العملية في Audit Log.
- إضافة شاشة Admin باسم `إشعار عام` لإرسال الإعلان من الواجهة.

### 4. واجهة ردود الدعم
- صفحة `Support Center` تعرض إن كان الطلب قد تلقى ردًا.
- زر `فتح والرد` يعرض نص طلب المستخدم داخل لوحة Admin.
- يمكن تغيير الحالة وكتابة رد يصل إلى مركز إشعارات المستخدم.
- العملية تحفظ الرد وتُسجل في Audit Log من Backend.

### 5. إحصائيات Welcome الحقيقية
- `GET /api/v1/public/overview` يقرأ المستخدمين النشطين والفحوصات وتصنيفاتها من Supabase.
- `POST /api/v1/public/visit` يسجل زائرًا مجهولًا باستخدام معرّف Local Storage بعد تجزئته في Backend.
- لا يتم حفظ عنوان IP أو User-Agent أو المعرّف الخام.
- Welcome تعرض الزوار الفريدين والمستخدمين والفحوصات الآمنة والمشبوهة والخطيرة.

## ما يجب تطبيقه في Supabase

شغّل الملف التالي مرة واحدة في SQL Editor بعد `admin_schema.sql` و`nabeh_complete_database_study_schema.sql`:

```sql
-- backend/sql/admin_operations_migration.sql
```

ثم شغّل Migration الإحصائيات:

```sql
-- backend/sql/public_metrics_migration.sql
```

الـ migration idempotent باستخدام `if not exists`. تحقق بعد التنفيذ:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'support_requests'
  and column_name in ('admin_reply', 'replied_at');
```

## التحقق المنفذ محلياً

- `python -m compileall -q backend main.py` — ناجح.
- `pytest -q` — **38 passed**, تحذير واحد فقط من طول مفتاح JWT في اختبار أمني مقصود.
- `frontend: npm run build` — ناجح.
- `admin_frontend: npm run build` — ناجح.
- `git diff --check` — ناجح.

## ملاحظات إنتاجية مهمة

1. الإشعارات الحالية داخل التطبيق (in-app) وليست بريداً أو Push Notification؛ إضافة البريد تحتاج مزود SMTP/transactional mail ومتغيرات سرية منفصلة.
2. يجب ضبط `VISITOR_HASH_SALT` في Backend بقيمة عشوائية قوية، وعدم وضعها في الواجهة. العداد هو عدد معرّفات المتصفح الفريدة المجهّلة، وليس عدد طلبات HTTP.
3. لا تستخدم مفتاح Supabase service role في الواجهة. يبقى في Backend فقط.
4. بعد نشر Backend، اختبر:

```bash
curl -fsS https://YOUR_API_DOMAIN/health
curl -i https://YOUR_FRONTEND_DOMAIN/non-existing-route
```

يجب أن تعيد الصفحة الثانية `index.html` بدلاً من 404 أبيض، ويجب أن تعيد الواجهة شاشة 404 المنطقية من React.
