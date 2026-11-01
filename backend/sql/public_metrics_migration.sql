/* Privacy-preserving Welcome metrics. Run after the core schema. */
begin;

create table if not exists public.site_visitors (
  id uuid primary key default gen_random_uuid(),
  visitor_hash char(64) not null unique,
  last_page varchar(80) not null default 'welcome',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists site_visitors_last_seen_idx
  on public.site_visitors (last_seen_at desc);

alter table public.site_visitors enable row level security;
revoke all on public.site_visitors from anon, authenticated;
grant all on public.site_visitors to service_role;

commit;

-- Verification
select count(*) as tracked_unique_visitors from public.site_visitors;
