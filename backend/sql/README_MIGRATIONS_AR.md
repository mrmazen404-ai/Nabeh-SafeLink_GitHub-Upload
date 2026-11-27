# تعليمات تطبيق migrations — Nabeh SafeLink

هذه الملفات تغييرات قاعدة بيانات حقيقية، ولا تُنفّذ تلقائيًا عند رفع الكود. لم يُجرَ اتصال بقاعدة Supabase أو تطبيق migration أثناء هذه المهمة؛ يجب تطبيقها على بيئة اختبار أولًا ثم الإنتاج من لوحة SQL Editor أو آلية migrations المعتمدة لدى الفريق.

## الترتيب المطلوب قبل نشر الكود

1. خذ نسخة احتياطية أو تأكد من قابلية استعادة قاعدة البيانات.
2. طبّق `scan_idempotency_migration.sql`. هذا الملف يضيف `idempotency_key_hash`، ويضمن طول `input_hash` المناسب، ويضيف `analysis_snapshot` إن لم يوجد، ثم ينشئ فهرسًا فريدًا لكل مستخدم ومفتاح idempotency. لا يُخزّن المفتاح الخام.
3. طبّق `support_ticket_id_migration.sql`. هذا الملف يضيف `ticket_id`، ويولّد معرفًا للصفوف القديمة، ويفرض عدم الفراغ والتفرّد.
4. شغّل استعلامات التحقق أدناه، ثم اختبر endpoint فحص مستخدم مسجل وطلب دعم في بيئة staging قبل نشر التطبيق.

> لا تستخدم `sql/all.sql` أو `nabeh_complete_database_study_schema.sql` بوصفهما migration على قاعدة إنتاج قائمة؛ فهما مخططان شاملان وليسا بديلًا عن migration الإضافية.

## تحقق بعد التنفيذ

```sql
select column_name, data_type, character_maximum_length
from information_schema.columns
where table_schema = 'public'
  and table_name = 'scans'
  and column_name in ('input_hash', 'idempotency_key_hash', 'analysis_snapshot');

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('scans', 'support_requests')
  and indexname in ('scans_user_idempotency_key_unique', 'scans_input_hash_idx', 'support_requests_ticket_id_unique');

select count(*) as missing_ticket_ids
from public.support_requests
where ticket_id is null or btrim(ticket_id) = '';

select count(*) as duplicate_ticket_ids
from (
  select ticket_id
  from public.support_requests
  group by ticket_id
  having count(*) > 1
) duplicates;
```

القيم المتوقعة: `input_hash` و`idempotency_key_hash` بطول 64، وجود الفهارس الثلاثة، ونتيجتا `missing_ticket_ids` و`duplicate_ticket_ids` تساويان صفرًا.

بعد نجاح التحقق فقط، فعّل `SCAN_IDEMPOTENCY_ENABLED=true` في بيئة backend و`VITE_SCAN_IDEMPOTENCY_ENABLED=true` في build الواجهة. كلا الخيارين معطّل افتراضيًا لتفادي إرسال header إلى قاعدة لم تطبق migration. أعد build/deploy للواجهة بعد تغيير متغير `VITE_`.

## سلوك التطبيق قبل migration

- استخدام `Idempotency-Key` لفحص الحساب يتطلب migration `scan_idempotency_migration.sql`. عند عدم وجود العمود أو الفهرس يفشل الطلب برسالة خدمة غير متاحة بدل الادعاء بأن منع التكرار يعمل.
- إنشاء تذكرة الدعم يتطلب migration `support_ticket_id_migration.sql`. إذا لم يطبقها فريق قاعدة البيانات فلن يعلن التطبيق نجاح الحفظ.
- لا توجد هذه الملفات بديلًا عن اختبار rollback/restore أو مراجعة SQL من مسؤول قاعدة البيانات.
