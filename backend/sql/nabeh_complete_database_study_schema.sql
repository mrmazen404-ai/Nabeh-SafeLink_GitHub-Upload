/*
  Nabeh SafeLink - Complete Database Schema
  Based on: Nabeh Database Design Study v1.0
  Platform: Supabase / PostgreSQL

  IMPORTANT DESIGN DECISION
  -------------------------
  The running project uses custom FastAPI authentication, not Supabase Auth.
  Therefore public.custom_users is the application identity table. It contains
  password_hash and replaces the conceptual "users" table from the study.
  Supabase Auth's auth.users is not used by the current backend.

  Run this entire file once in Supabase SQL Editor.
  The script is transaction-wrapped and is safe to re-run for the objects it
  creates. Existing legacy foreign keys are removed before custom identity FKs
  are added as NOT VALID, so old orphan rows do not block migration; all new
  writes are still checked by PostgreSQL.
*/

begin;

create extension if not exists pgcrypto;

/* ================================================================
   1. APPLICATION USERS AND PROFILES
   ================================================================ */

create table if not exists public.custom_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'USER'
    check (role in ('USER', 'SUPERVISOR', 'ADMIN')),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SUSPENDED', 'DELETED')),
  email_verified boolean not null default false,
  preferred_language varchar(5) not null default 'ar'
    check (preferred_language in ('ar', 'en')),
  last_login_at timestamptz,
  auth_token_version integer not null default 0 check (auth_token_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_users
  add column if not exists display_name text,
  add column if not exists password_hash text,
  add column if not exists role text not null default 'USER',
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists email_verified boolean not null default false,
  add column if not exists preferred_language varchar(5) not null default 'ar',
  add column if not exists last_login_at timestamptz,
  add column if not exists auth_token_version integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists custom_users_email_lower_uidx
  on public.custom_users (lower(email));
create index if not exists custom_users_status_idx
  on public.custom_users (status, created_at desc);

create table if not exists public.user_profiles (
  user_id uuid primary key,
  display_name varchar(100) not null,
  preferred_language varchar(5) not null default 'ar'
    check (preferred_language in ('ar', 'en')),
  timezone varchar(50),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists user_id uuid,
  add column if not exists display_name varchar(100),
  add column if not exists preferred_language varchar(5) default 'ar',
  add column if not exists timezone varchar(50),
  add column if not exists avatar_path text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

/* Remove old user_profiles references to public.users/auth.users. */
do $$
declare c record;
begin
  if to_regclass('public.user_profiles') is not null then
    for c in
      select conname from pg_constraint
      where conrelid = 'public.user_profiles'::regclass
        and contype = 'f'
    loop
      execute format('alter table public.user_profiles drop constraint if exists %I', c.conname);
    end loop;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_user_id_fkey'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_user_id_fkey
      foreign key (user_id) references public.custom_users(id)
      on delete restrict not valid;
  end if;
end $$;

/* ================================================================
   2. OTP AUTHENTICATION
   ================================================================ */

create table if not exists public.custom_auth_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  purpose text not null check (purpose in ('signup', 'recovery')),
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'custom_auth_otps_user_id_fkey'
      and conrelid = 'public.custom_auth_otps'::regclass
  ) then
    alter table public.custom_auth_otps
      add constraint custom_auth_otps_user_id_fkey
      foreign key (user_id) references public.custom_users(id)
      on delete cascade not valid;
  end if;
end $$;

create index if not exists custom_auth_otps_lookup_idx
  on public.custom_auth_otps (user_id, purpose, created_at desc)
  where consumed_at is null;
create index if not exists custom_auth_otps_expiry_idx
  on public.custom_auth_otps (expires_at)
  where consumed_at is null;

/* ================================================================
   3. MODEL VERSIONS
   ================================================================ */

create table if not exists public.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  version text not null,
  task_type text not null check (task_type in ('URL', 'MESSAGE')),
  metrics jsonb not null default '{}'::jsonb,
  dataset_reference text,
  artifact_path text,
  status text not null default 'TRAINING'
    check (status in ('TRAINING', 'CANDIDATE', 'APPROVED', 'RETIRED')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (model_name, version, task_type)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'model_versions_approved_by_fkey'
      and conrelid = 'public.model_versions'::regclass
  ) then
    alter table public.model_versions
      add constraint model_versions_approved_by_fkey
      foreign key (approved_by) references public.custom_users(id)
      on delete set null not valid;
  end if;
end $$;

create index if not exists model_versions_task_status_idx
  on public.model_versions (task_type, status, created_at desc);

/* ================================================================
   4. SCANS
   Guest scans are intentionally not inserted by the current backend.
   The nullable user_id still supports a future persisted-guest policy.
   ================================================================ */

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  input_type text not null
    check (input_type in ('URL', 'TEXT', 'MESSAGE', 'FILE', 'EMAIL_HEADER')),
  input_value_masked text,
  input_hash char(64),
  input_language varchar(5),
  status text not null default 'PROCESSING'
    check (status in ('PROCESSING', 'COMPLETED', 'FAILED')),
  classification text
    check (classification in ('SAFE', 'SUSPICIOUS', 'DANGEROUS', 'UNKNOWN', 'NEEDS_REVIEW')),
  confidence_score numeric(5,4)
    check (confidence_score is null or confidence_score between 0 and 1),
  confidence_level text
    check (confidence_level is null or confidence_level in ('HIGH', 'MEDIUM', 'LOW')),
  recommendation text,
  model_version_id uuid,
  request_id uuid,
  error_code text,
  analysis_snapshot jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint scans_state_consistency check (
    (status = 'COMPLETED' and classification is not null and completed_at is not null)
    or (status in ('PROCESSING', 'FAILED'))
  )
);

/* Add the study fields to an existing scans table. */
alter table public.scans
  add column if not exists user_id uuid,
  add column if not exists input_type text,
  add column if not exists input_value_masked text,
  add column if not exists input_hash char(64),
  add column if not exists input_language varchar(5),
  add column if not exists status text not null default 'PROCESSING',
  add column if not exists classification text,
  add column if not exists confidence_score numeric(5,4),
  add column if not exists confidence_level text,
  add column if not exists recommendation text,
  add column if not exists model_version_id uuid,
  add column if not exists request_id uuid,
  add column if not exists error_code text,
  add column if not exists analysis_snapshot jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz;

/* Drop legacy FK references and reconnect identity to custom_users. */
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.scans'::regclass
      and contype = 'f'
      and confrelid::regclass::text in ('users', 'public.users', 'auth.users')
  loop
    execute format('alter table public.scans drop constraint if exists %I', c.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scans_user_id_fkey'
      and conrelid = 'public.scans'::regclass
  ) then
    alter table public.scans
      add constraint scans_user_id_fkey
      foreign key (user_id) references public.custom_users(id)
      on delete set null not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'scans_model_version_id_fkey'
      and conrelid = 'public.scans'::regclass
  ) then
    alter table public.scans
      add constraint scans_model_version_id_fkey
      foreign key (model_version_id) references public.model_versions(id)
      on delete set null not valid;
  end if;
end $$;

create index if not exists idx_scans_user_created
  on public.scans (user_id, created_at desc);
create index if not exists idx_scans_user_result
  on public.scans (user_id, classification);
create index if not exists idx_scans_status_created
  on public.scans (status, created_at desc);
create index if not exists idx_scans_input_hash
  on public.scans (input_hash)
  where input_hash is not null;

/* ================================================================
   5. ANALYSIS SIGNALS AND EXPLANATIONS
   ================================================================ */

create table if not exists public.scan_signals (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  signal_code varchar(80) not null,
  signal_label_en text,
  signal_label_ar text,
  severity smallint not null default 1 check (severity between 1 and 5),
  evidence_masked text,
  source text not null check (source in ('ML', 'RULE', 'REPUTATION', 'GEMINI', 'OTHER')),
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_signals_scan
  on public.scan_signals (scan_id, created_at desc);
create index if not exists idx_scan_signals_code
  on public.scan_signals (signal_code, severity);

create table if not exists public.scan_explanations (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  language varchar(5) not null default 'ar',
  summary text not null default '',
  reasons jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reasons) = 'array'),
  recommendation text not null default '',
  provider text not null default 'TEMPLATE'
    check (provider in ('TEMPLATE', 'GEMINI', 'HUMAN_REVIEW', 'LOCAL_RULES')),
  prompt_version text,
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_explanations_scan
  on public.scan_explanations (scan_id, created_at desc);

/* ================================================================
   6. FRAUD DICTIONARY AND MANY-TO-MANY LINK
   ================================================================ */

create table if not exists public.fraud_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.scan_fraud_types (
  scan_id uuid not null references public.scans(id) on delete cascade,
  fraud_type_id uuid not null references public.fraud_types(id) on delete restrict,
  confidence_score numeric(5,4)
    check (confidence_score is null or confidence_score between 0 and 1),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (scan_id, fraud_type_id)
);

create index if not exists idx_scan_fraud_types_fraud
  on public.scan_fraud_types (fraud_type_id, is_primary);

insert into public.fraud_types (code, name_en, name_ar, description_en, description_ar)
values
  ('PHISHING', 'Phishing', 'تصيد احتيالي', 'Credential or identity theft attempt', 'محاولة سرقة بيانات الدخول أو الهوية'),
  ('IMPERSONATION', 'Impersonation', 'انتحال شخصية', 'Impersonating a trusted person or organization', 'انتحال جهة أو شخص موثوق'),
  ('FINANCIAL_SCAM', 'Financial scam', 'احتيال مالي', 'Fraud involving payments or financial data', 'احتيال يتعلق بالدفع أو البيانات المالية'),
  ('MALWARE', 'Malware', 'برمجية ضارة', 'Malicious software distribution', 'توزيع برمجيات ضارة')
on conflict (code) do nothing;

/* ================================================================
   7. FEEDBACK
   ================================================================ */

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  user_id uuid not null references public.custom_users(id) on delete restrict,
  reported_classification text not null
    check (reported_classification in ('SAFE', 'SUSPICIOUS', 'DANGEROUS', 'UNKNOWN', 'NEEDS_REVIEW')),
  comment text,
  status text not null default 'NEW'
    check (status in ('NEW', 'REVIEWED', 'USED_FOR_ANALYSIS')),
  reviewed_by uuid references public.custom_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_scan on public.feedback (scan_id, created_at desc);
create index if not exists idx_feedback_status on public.feedback (status, created_at desc);

/* Prevent feedback for a scan owned by another user. */
create or replace function public.enforce_feedback_scan_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.scans s
    where s.id = new.scan_id and s.user_id = new.user_id
  ) then
    raise exception 'feedback user does not own scan';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_scan_owner_trigger on public.feedback;
create trigger feedback_scan_owner_trigger
before insert or update on public.feedback
for each row execute function public.enforce_feedback_scan_owner();

/* ================================================================
   8. NOTIFICATIONS AND USER PREFERENCES
   ================================================================ */

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.custom_users(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  type text not null check (type in ('SCAN_COMPLETED', 'DANGEROUS_RESULT', 'SYSTEM')),
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, is_read, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.custom_users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  dangerous_scan_enabled boolean not null default true,
  weekly_summary_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

/* ================================================================
   9. PRIVACY CONSENTS AND AUDIT LOGS
   ================================================================ */

create table if not exists public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.custom_users(id) on delete restrict,
  consent_type text not null
    check (consent_type in ('PRIVACY_POLICY', 'DATA_RETENTION', 'MODEL_IMPROVEMENT', 'TERMS_OF_USE')),
  version text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, consent_type, version)
);

create index if not exists idx_privacy_consents_user
  on public.privacy_consents (user_id, consent_type, granted_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.custom_users(id) on delete set null,
  action text not null
    check (action in ('LOGIN', 'REGISTER', 'VERIFY_EMAIL', 'DELETE_SCAN', 'CHANGE_ROLE', 'UPDATE_PRIVACY', 'ADMIN_ACTION', 'OTHER')),
  resource_type text,
  resource_id uuid,
  metadata_masked jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor_created
  on public.audit_logs (actor_user_id, created_at desc);
create index if not exists idx_audit_logs_action_created
  on public.audit_logs (action, created_at desc);

/* Audit log is append-only for non-service roles. */
revoke update, delete on public.audit_logs from anon, authenticated;

/* ================================================================
   10. DANGEROUS INDICATORS
   ================================================================ */

create table if not exists public.dangerous_indicators (
  id uuid primary key default gen_random_uuid(),
  indicator_type text not null check (indicator_type in ('DOMAIN', 'URL_HASH', 'IP', 'EMAIL', 'KEYWORD')),
  indicator_value_hash char(64) not null,
  display_value_masked text,
  severity smallint not null default 3 check (severity between 1 and 5),
  source text not null default 'SYSTEM',
  is_active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (indicator_type, indicator_value_hash)
);

create index if not exists idx_dangerous_indicators_lookup
  on public.dangerous_indicators (indicator_type, indicator_value_hash)
  where is_active = true;

/* ================================================================
   11. FUTURE FILE AND EMAIL MODULES
   ================================================================ */

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.custom_users(id) on delete restrict,
  storage_path text not null,
  original_name_masked text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 char(64),
  scan_status text not null default 'PENDING'
    check (scan_status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'QUARANTINED')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_uploaded_files_user_created
  on public.uploaded_files (user_id, created_at desc);

create table if not exists public.email_header_analyses (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  spf_result text,
  dkim_result text,
  dmarc_result text,
  sender_domain_masked text,
  authentication_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_email_header_analysis_scan
  on public.email_header_analyses (scan_id);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.custom_users(id) on delete cascade,
  key_prefix varchar(16) not null,
  key_hash char(64) not null unique,
  scopes jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user_active
  on public.api_keys (user_id, created_at desc)
  where revoked_at is null;

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.custom_users(id) on delete cascade,
  provider text not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'PAUSED', 'REVOKED')),
  scopes jsonb not null default '[]'::jsonb,
  token_reference text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, provider)
);

/* ================================================================
   12. SYSTEM SETTINGS AND SUPPORT
   ================================================================ */

create table if not exists public.system_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.custom_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.custom_users(id) on delete set null,
  email text,
  subject text not null,
  message text not null,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  priority text not null default 'NORMAL'
    check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  assigned_to uuid references public.custom_users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_support_requests_status_created
  on public.support_requests (status, created_at desc);

/* ================================================================
   13. COMMON TIMESTAMP TRIGGER
   ================================================================ */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists custom_users_set_updated_at on public.custom_users;
create trigger custom_users_set_updated_at
before update on public.custom_users
for each row execute function public.set_updated_at();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

/* ================================================================
   14. RLS AND PRIVILEGES
   ================================================================
   The custom FastAPI JWT is not a Supabase Auth JWT, so auth.uid() would be
   incorrect for the current application. FastAPI enforces ownership and uses
   service_role. RLS blocks direct anon/authenticated table access.
*/

alter table public.custom_users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.custom_auth_otps enable row level security;
alter table public.model_versions enable row level security;
alter table public.scans enable row level security;
alter table public.scan_signals enable row level security;
alter table public.scan_explanations enable row level security;
alter table public.fraud_types enable row level security;
alter table public.scan_fraud_types enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.privacy_consents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.dangerous_indicators enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.email_header_analyses enable row level security;
alter table public.api_keys enable row level security;
alter table public.integrations enable row level security;
alter table public.system_settings enable row level security;
alter table public.support_requests enable row level security;

/* Remove direct table privileges from public client roles. */
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

/* ================================================================
   15. BASIC SEED DATA
   ================================================================ */

insert into public.system_settings (key, value_json, description, is_public)
values
  ('privacy_policy_version', '"1.0"'::jsonb, 'Current privacy policy version', true),
  ('default_language', '"ar"'::jsonb, 'Default application language', true),
  ('guest_scans_persisted', 'false'::jsonb, 'Guest scans are not saved by current backend', true)
on conflict (key) do nothing;

commit;

/* ================================================================
   VERIFICATION QUERIES - run after the transaction if desired
   ================================================================

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'custom_users','user_profiles','custom_auth_otps','model_versions','scans',
    'scan_signals','scan_explanations','fraud_types','scan_fraud_types','feedback',
    'notifications','notification_preferences','privacy_consents','audit_logs',
    'dangerous_indicators','uploaded_files','email_header_analyses','api_keys',
    'integrations','system_settings','support_requests'
  )
order by table_name;

select conrelid::regclass as table_name, conname, confrelid::regclass as references_table
from pg_constraint
where conname in (
  'user_profiles_user_id_fkey','custom_auth_otps_user_id_fkey',
  'scans_user_id_fkey','scans_model_version_id_fkey',
  'scan_explanations_scan_id_fkey'
)
order by table_name, conname;
*/
