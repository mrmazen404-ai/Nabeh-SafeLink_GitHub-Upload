# مراجعة مخطط Supabase لنظام Admin

## النتيجة المختصرة

الملف المرفق هو **مخطط سياقي صادر من Supabase** ويحتوي على 31 جدولاً، منها 8 جداول مخصصة لـ Admin. هذا يعني أن جداول Admin موجودة في نفس قاعدة بيانات SafeLink وليست قاعدة منفصلة.

الجداول الإدارية الموجودة هي:

- `admin_users`
- `admin_sessions`
- `admin_2fa_methods`
- `admin_2fa_recovery_codes`
- `admin_login_attempts`
- `admin_invitations`
- `admin_audit_logs`
- `admin_notifications`

## التوافق مع المشروع

المخطط المرفق يطابق نطاق المرحلة الأولى في المشروع من حيث أسماء جداول Admin، الأدوار، حالات الحساب، جلسات refresh، 2FA، recovery codes، invitations، audit logs والإشعارات.

كما أن `admin_audit_logs` مرتبط بجدولي `custom_users` و`scans`، وهذا يثبت أن Admin مصمم لإدارة بيانات النظام الأساسية من خلال Backend محمي، وليس من خلال اتصال مباشر من الواجهة.

## نقطة حرجة تحتاج تحققاً

في الملف المرفق تظهر أعمدة مثل:

```sql
refresh_token_hash character
ip_hash character
user_agent_hash character
code_hash character
email_hash character
token_hash character
```

بينما ملف المشروع `backend/sql/admin_schema.sql` يعرف هذه الأعمدة كـ `char(64)`.

في PostgreSQL، كتابة `character` بدون طول تعني عادةً `character(1)`. إذا كان هذا هو النوع الفعلي في قاعدة البيانات، فسيحدث عدم توافق خطير مع النظام لأن الكود يولد Hash بطول 64 حرفاً. النتيجة المحتملة هي رفض الإدراج أو قص القيمة أو فشل تدوير الجلسات والتحقق من recovery codes.

لا ينبغي تغيير القاعدة اعتماداً على ملف السياق وحده؛ يجب تنفيذ استعلام التحقق التالي في Supabase SQL Editor:

```sql
select
  table_name,
  column_name,
  data_type,
  character_maximum_length,
  udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'admin_sessions',
    'admin_2fa_recovery_codes',
    'admin_login_attempts',
    'admin_invitations',
    'admin_audit_logs'
  )
  and column_name in (
    'refresh_token_hash',
    'ip_hash',
    'user_agent_hash',
    'code_hash',
    'email_hash',
    'token_hash'
  )
order by table_name, column_name;
```

## النتيجة الصحيحة المتوقعة

يجب أن تكون أعمدة Hash إما:

```text
data_type = character
character_maximum_length = 64
udt_name = bpchar
```

أو تكون `text` مع قيد يضمن الطول 64. إذا ظهرت `character_maximum_length = 1`، فهذه مشكلة إنتاجية عالية الأولوية.

## فروقات أخرى بين المخطط المرفق ومخطط المشروع

مخطط المشروع يحدد إجراءات حذف مرتبطة بجداول Admin مثل `on delete cascade` و`on delete set null` و`on delete restrict`. أما ملف Supabase المرفق فيعرض العلاقات بدون هذه الإجراءات. ملف التصدير السياقي لا يكفي وحده لإثبات الإجراء الفعلي؛ يجب فحص `pg_constraint` مباشرة قبل اعتماد الحكم.

استخدم هذا الاستعلام:

```sql
select
  conname,
  conrelid::regclass as table_name,
  confrelid::regclass as referenced_table,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conname like 'admin_%'
order by conname;
```

## RLS والصلاحيات

التصدير المرفق يثبت تعريف الجداول فقط، لكنه لا يثبت وجود RLS policies أو grants الفعلية. ملف المشروع يطلب:

- تفعيل RLS على جداول Admin.
- منع `anon` و`authenticated`.
- السماح لـ `service_role` فقط.
- جعل Audit Logs append-only.

يجب التحقق من ذلك باستعلامات Supabase التالية:

```sql
select tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'admin_%'
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename like 'admin_%'
order by tablename, policyname;
```

## ملاحظة تصميمية

حقول `feedback.reviewed_by` و`model_versions.approved_by` تشير إلى `custom_users` وليس `admin_users`. هذا لا يمنع Admin من قراءة البيانات، لكنه يجعل تسجيل المسؤول الذي راجع Feedback أو وافق Model Version غير ممثل بشكل صحيح. لا ينبغي تعديل ذلك قبل تحديد سياسة التدقيق المطلوبة؛ الحل الأفضل غالباً إضافة حقول Admin مستقلة أو جدول أحداث إداري، بدلاً من خلط هوية المستخدم بهوية المسؤول.

## القرار الحالي

لا يوجد أساس آمن لتطبيق migration عشوائي على الإنتاج قبل تنفيذ استعلامات التحقق أعلاه. الخطوة الصحيحة هي:

1. التحقق من أطوال Hash الفعلية.
2. التحقق من إجراءات Foreign Keys.
3. التحقق من RLS وPolicies وGrants.
4. تشغيل اختبار Bootstrap/Login/2FA في staging.
5. بعد نجاح ذلك، بناء Admin Shell والوحدات الإدارية على نفس المخطط.
