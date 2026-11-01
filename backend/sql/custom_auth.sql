-- Nabeh SafeLink custom authentication schema.
-- Run this once in Supabase SQL Editor before deploying the custom-auth code.
-- Supabase remains the database provider; Supabase Auth is not used.

create extension if not exists pgcrypto;

create table if not exists public.custom_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  email_verified boolean not null default false,
  preferred_language text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_auth_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  purpose text not null check (purpose in ('signup', 'recovery')),
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists custom_users_email_idx on public.custom_users (lower(email));
create index if not exists custom_auth_otps_lookup_idx
  on public.custom_auth_otps (user_id, purpose, created_at desc)
  where consumed_at is null;

-- The backend uses the service key and enforces ownership from its JWT.
-- custom_users is the only identity table used by the custom-auth backend.
-- Existing installations may still have user_profiles.user_id pointing to
-- the old public.users or auth.users table. That legacy relationship must not
-- be used by registration; the profile table is optional and unused by the
-- current backend because custom_users stores display_name and language.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.user_profiles'::regclass
      and conname is not null
  loop
    execute format('alter table %s drop constraint if exists %I', constraint_row.table_name, constraint_row.conname);
  end loop;
end $$;
