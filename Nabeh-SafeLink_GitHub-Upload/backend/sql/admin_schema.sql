/*
  Nabeh SafeLink — Administrator Database Migration
  Scope: ADMINISTRATION ONLY

  This migration deliberately does not alter:
    - custom_users
    - custom_auth_otps
    - the existing user JWT authentication

  The Admin application uses its own identity, session, 2FA, login-attempt,
  invitation, notification, and audit tables while reading/writing the existing
  SafeLink business tables through a protected Admin Backend service role.

  Run this file in Supabase SQL Editor after reviewing it in staging.
  It is designed to be idempotent for a fresh or partially initialized schema.
*/

begin;

create extension if not exists pgcrypto;

/* ================================================================
   1. ADMIN IDENTITIES
   ================================================================ */

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'SUPERVISOR'
    check (role in ('SUPERVISOR', 'ADMIN', 'SUPER_ADMIN')),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SUSPENDED', 'DELETED')),
  email_verified boolean not null default false,
  two_factor_required boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_email_lower_check check (email = lower(email))
);

create unique index if not exists admin_users_email_lower_uidx
  on public.admin_users (lower(email));

create index if not exists admin_users_role_status_idx
  on public.admin_users (role, status, created_at desc);

/* ================================================================
   2. ADMIN SESSIONS
   ================================================================
   Only a hash of the refresh token is stored. The raw token never enters DB.
*/

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null
    references public.admin_users(id) on delete cascade,
  refresh_token_hash char(64) not null unique,
  token_family uuid not null,
  ip_hash char(64),
  user_agent_hash char(64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text
);

create index if not exists admin_sessions_user_idx
  on public.admin_sessions (admin_user_id, created_at desc);

create index if not exists admin_sessions_active_idx
  on public.admin_sessions (admin_user_id, expires_at)
  where revoked_at is null;

/* ================================================================
   3. ADMIN 2FA METHODS
   ================================================================
   secret_ciphertext must be encrypted by the Admin Backend before insert.
   It must not be a plaintext TOTP secret or a one-way hash.
*/

create table if not exists public.admin_2fa_methods (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null unique
    references public.admin_users(id) on delete cascade,
  method text not null default 'TOTP'
    check (method in ('TOTP')),
  secret_ciphertext text not null,
  secret_nonce text not null,
  is_enabled boolean not null default false,
  verified_at timestamptz,
  last_used_step bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* ================================================================
   4. ADMIN RECOVERY CODES
   ================================================================ */

create table if not exists public.admin_2fa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null
    references public.admin_users(id) on delete cascade,
  code_hash char(64) not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (admin_user_id, code_hash)
);

create index if not exists admin_recovery_codes_active_idx
  on public.admin_2fa_recovery_codes (admin_user_id, created_at desc)
  where used_at is null;

/* ================================================================
   5. LOGIN ATTEMPTS / BRUTE-FORCE EVIDENCE
   ================================================================ */

create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email_hash char(64),
  ip_hash char(64),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  outcome text not null
    check (outcome in ('SUCCESS', 'INVALID_CREDENTIALS', 'INVALID_2FA', 'LOCKED', 'SUSPENDED', 'RATE_LIMITED')),
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_lookup_idx
  on public.admin_login_attempts (email_hash, ip_hash, created_at desc);

/* ================================================================
   6. ADMIN INVITATIONS
   ================================================================ */

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'SUPERVISOR'
    check (role in ('SUPERVISOR', 'ADMIN', 'SUPER_ADMIN')),
  invited_by uuid not null
    references public.admin_users(id) on delete restrict,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_invitations_email_lower_check check (email = lower(email))
);

create index if not exists admin_invitations_active_idx
  on public.admin_invitations (lower(email), expires_at)
  where accepted_at is null and revoked_at is null;

/* ================================================================
   7. IMMUTABLE ADMIN AUDIT LOGS
   ================================================================
   target_user_id/target_scan_id are references to existing SafeLink data;
   they do not participate in authentication.
*/

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid
    references public.admin_users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  target_user_id uuid
    references public.custom_users(id) on delete set null,
  target_scan_id uuid
    references public.scans(id) on delete set null,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  metadata_masked jsonb not null default '{}'::jsonb,
  ip_hash char(64),
  user_agent_hash char(64),
  request_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_time_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (admin_user_id, created_at desc);

create index if not exists admin_audit_logs_resource_idx
  on public.admin_audit_logs (resource_type, resource_id, created_at desc);

/* ================================================================
   8. ADMIN NOTIFICATIONS
   ================================================================ */

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid
    references public.admin_users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_notifications_user_idx
  on public.admin_notifications (admin_user_id, created_at desc)
  where is_read = false;

/* ================================================================
   9. TIMESTAMP TRIGGERS
   ================================================================ */

create or replace function public.set_admin_updated_at()
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

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_admin_updated_at();

drop trigger if exists admin_2fa_methods_set_updated_at on public.admin_2fa_methods;
create trigger admin_2fa_methods_set_updated_at
before update on public.admin_2fa_methods
for each row execute function public.set_admin_updated_at();

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'admin_audit_logs is append-only';
end;
$$;

drop trigger if exists admin_audit_logs_immutable on public.admin_audit_logs;
create trigger admin_audit_logs_immutable
before update or delete on public.admin_audit_logs
for each row execute function public.prevent_admin_audit_mutation();

/* ================================================================
   10. RLS / PRIVILEGES
   ================================================================
   The Admin Backend is the only application path and uses service_role.
   No direct anon/authenticated access is granted to admin tables.
*/

alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_2fa_methods enable row level security;
alter table public.admin_2fa_recovery_codes enable row level security;
alter table public.admin_login_attempts enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_notifications enable row level security;

revoke all on public.admin_users from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;
revoke all on public.admin_2fa_methods from anon, authenticated;
revoke all on public.admin_2fa_recovery_codes from anon, authenticated;
revoke all on public.admin_login_attempts from anon, authenticated;
revoke all on public.admin_invitations from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
revoke all on public.admin_notifications from anon, authenticated;

grant all on public.admin_users to service_role;
grant all on public.admin_sessions to service_role;
grant all on public.admin_2fa_methods to service_role;
grant all on public.admin_2fa_recovery_codes to service_role;
grant all on public.admin_login_attempts to service_role;
grant all on public.admin_invitations to service_role;
grant all on public.admin_audit_logs to service_role;
grant all on public.admin_notifications to service_role;

/* Audit rows are append-only through the database trigger above. */

commit;

/* Verification queries (run separately after migration if desired):
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'admin_%'
order by table_name;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'admin_%'
order by tablename;
*/
