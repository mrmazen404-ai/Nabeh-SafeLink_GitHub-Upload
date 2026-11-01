/* Admin operations additions. Run after the core and privacy schemas. */
begin;

alter table public.feedback
  add column if not exists reviewed_by_admin_id uuid references public.admin_users(id) on delete set null;

alter table public.support_requests
  add column if not exists assigned_admin_id uuid references public.admin_users(id) on delete set null,
  add column if not exists admin_reply text,
  add column if not exists replied_at timestamptz;

alter table public.account_deletion_requests
  add column if not exists processed_by_admin_id uuid references public.admin_users(id) on delete set null,
  add column if not exists decision_reason text;

create index if not exists idx_feedback_admin_status
  on public.feedback (reviewed_by_admin_id, status, created_at desc);
create index if not exists idx_support_admin_status
  on public.support_requests (assigned_admin_id, status, created_at desc);
create index if not exists idx_deletion_admin_status
  on public.account_deletion_requests (processed_by_admin_id, status, requested_at desc);

alter table public.feedback enable row level security;
alter table public.support_requests enable row level security;
alter table public.account_deletion_requests enable row level security;
revoke all on public.feedback from anon, authenticated;
revoke all on public.support_requests from anon, authenticated;
revoke all on public.account_deletion_requests from anon, authenticated;
grant all on public.feedback to service_role;
grant all on public.support_requests to service_role;
grant all on public.account_deletion_requests to service_role;

commit;
