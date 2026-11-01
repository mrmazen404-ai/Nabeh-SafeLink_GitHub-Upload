/* Nabeh SafeLink — User privacy, legal documents, and data lifecycle migration
   This migration extends the user-facing data lifecycle only. It does not alter
   the existing authentication/JWT implementation. Run after the base schema. */
begin;

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null check (policy_type in ('TERMS', 'PRIVACY', 'DISCLAIMER')),
  language varchar(2) not null default 'ar' check (language in ('ar', 'en')),
  version text not null,
  title text not null,
  content_markdown text not null,
  content_hash char(64),
  is_active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (policy_type, language, version)
);

create unique index if not exists policy_documents_active_idx
  on public.policy_documents(policy_type, language)
  where is_active = true;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.custom_users(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED')),
  reason text,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  failure_reason text
);

create unique index if not exists account_deletion_pending_user_idx
  on public.account_deletion_requests(user_id)
  where status in ('PENDING', 'CONFIRMED', 'PROCESSING');

create index if not exists account_deletion_user_idx
  on public.account_deletion_requests(user_id, requested_at desc);

alter table public.scans add column if not exists user_hidden_at timestamptz;
alter table public.scans add column if not exists user_deleted_at timestamptz;
create index if not exists scans_user_visible_idx
  on public.scans(user_id, created_at desc)
  where user_hidden_at is null and user_deleted_at is null;

alter table public.privacy_consents add column if not exists accepted_at timestamptz;
alter table public.privacy_consents add column if not exists ip_hash char(64);
alter table public.privacy_consents add column if not exists user_agent_hash char(64);
create unique index if not exists privacy_consents_user_type_version_idx
  on public.privacy_consents(user_id, consent_type, version);

/* Seed the current public policy versions. Replace the text through a reviewed
   migration when the institution approves final legal wording. */
insert into public.policy_documents
  (policy_type, language, version, title, content_markdown, is_active, published_at)
values
('TERMS','ar','1.0','شروط الاستخدام',
'## شروط استخدام Nabeh SafeLink\n\nتقدم Nabeh SafeLink خدمة مساعدة لتحليل الروابط والرسائل والمؤشرات المرتبطة بالاحتيال. النتائج احتمالية وليست ضمانًا أمنيًا أو قرارًا قانونيًا أو ماليًا.\n\nيلتزم المستخدم باستخدام الخدمة لأغراض مشروعة، وعدم إرسال كلمات المرور أو مفاتيح الوصول أو بيانات البطاقات أو أي أسرار. لا يجوز محاولة تعطيل الخدمة أو تجاوز حدود الاستخدام أو استخدام النتائج لإيذاء الآخرين.\n\nيستطيع المستخدم إدارة فحوصاته وطلب إخفائها أو حذف بيانات حسابه وفق سياسة الخصوصية والاحتفاظ. قد تعتمد الخدمة على مزودين خارجيين للتحليل عند تفعيلهم، ولا ينبغي إرسال معلومات لا يملك المستخدم حق مشاركتها.\n\nتحتفظ Nabeh بحق تحديث هذه الشروط مع نشر رقم إصدار جديد. استمرار الاستخدام بعد نشر التحديث يعني قبول النسخة الجديدة عندما يطلب النظام ذلك.',true,now()),
('TERMS','en','1.0','Terms of Use',
'## Nabeh SafeLink Terms of Use\n\nNabeh SafeLink provides an assistance service for analyzing links, messages, and fraud-related signals. Results are probabilistic and are not a security guarantee or legal, financial, or professional advice.\n\nUse the service lawfully. Do not submit passwords, access keys, payment-card data, or other secrets. Do not disrupt the service, bypass limits, or use results to harm others.\n\nYou can manage scans and request hiding or deletion of account data under the privacy and retention policy. Third-party analysis providers may be used when enabled; do not submit information you are not authorized to share.\n\nWe may publish updated versions of these terms. The system will request consent when a material update requires it.',true,now()),
('PRIVACY','ar','1.0','سياسة الخصوصية',
'## سياسة الخصوصية\n\nنجمع بيانات الحساب اللازمة للتسجيل وتقديم الخدمة، مثل البريد والاسم، ونسجل الفحوصات المحفوظة للحساب عند اختيار المستخدم ذلك. تُحفظ مدخلات الفحص بصيغة مقنّعة قدر الإمكان، ولا ينبغي للمستخدم إدخال أسرار أو بيانات شخصية غير لازمة.\n\nقد تُرسل قيمة الفحص إلى خدمات تحليل خارجية مفعّلة مثل VirusTotal أو Gemini حسب إعدادات الخدمة. يستخدم النظام نتائج التحليل لتحسين القرار وشرح التصنيف، مع تقليل البيانات الحساسة في السجلات.\n\nيستطيع المستخدم الاطلاع على موافقاته، إخفاء الفحص من السجل، طلب حذف الفحص، تصدير بياناته، وطلب حذف الحساب. عند الحذف قد نحتفظ بسجل تدقيق منزوع الهوية إذا كان الاحتفاظ مطلوبًا لأمن الخدمة أو الالتزامات النظامية.\n\nلا نبيع بيانات المستخدمين. نستخدم ضوابط وصول وسجلات تدقيق، لكن لا توجد وسيلة تقنية تضمن أمانًا مطلقًا. للاستفسارات استخدم صفحة التواصل.',true,now()),
('PRIVACY','en','1.0','Privacy Policy',
'## Privacy Policy\n\nWe collect account data needed to provide the service, such as email and display name, and retain authenticated scans when the user chooses to save them. Scan inputs should never contain secrets or unnecessary personal data.\n\nWhen enabled, scan values may be sent to external analysis providers such as VirusTotal or Gemini. Results are used to produce a classification and explanation, while sensitive data is minimized in logs.\n\nUsers can review consents, hide or delete scans, export account data, and request account deletion. A de-identified audit record may be retained when needed for service security or legal obligations.\n\nWe do not sell user data. Access controls and audit logging are used, but no technical system can guarantee absolute security. Contact us through the support page for questions.',true,now()),
('DISCLAIMER','ar','1.0','إخلاء المسؤولية',
'## إخلاء المسؤولية\n\nSafeLink أداة مساعدة لاتخاذ الحذر وليست بديلًا عن برامج الحماية أو مراجعة الجهة الرسمية أو المختص. قد تكون النتيجة غير دقيقة بسبب تغير المواقع أو نقص البيانات أو أخطاء النماذج والخدمات الخارجية.\n\nلا تفتح رابطًا لمجرد أنه صُنّف آمنًا، ولا تدخل بيانات حساسة قبل التحقق من الجهة عبر قناة مستقلة. لا تتحمل الخدمة مسؤولية الخسائر الناتجة عن الاعتماد المنفرد على نتيجة الفحص.',true,now()),
('DISCLAIMER','en','1.0','Disclaimer',
'## Disclaimer\n\nSafeLink is an assistance tool for cautious decision-making, not a replacement for security controls, official verification, or professional advice. Results may be inaccurate because websites change and models or external providers can fail.\n\nDo not open a link solely because it was classified as safe, and verify the organization independently before entering sensitive data. The service is not liable for losses caused by relying on a scan result alone.',true,now())
on conflict (policy_type, language, version) do nothing;

update public.policy_documents
set content_hash = encode(digest(content_markdown, 'sha256'), 'hex')
where content_hash is null;

alter table public.policy_documents enable row level security;
alter table public.account_deletion_requests enable row level security;
revoke all on public.policy_documents from anon, authenticated;
revoke all on public.account_deletion_requests from anon, authenticated;
grant all on public.policy_documents to service_role;
grant all on public.account_deletion_requests to service_role;

commit;
