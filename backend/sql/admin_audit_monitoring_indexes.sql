/* Nabeh SafeLink — Audit and security monitoring indexes */

create index if not exists idx_admin_audit_logs_action_time
  on public.admin_audit_logs (action, created_at desc);

create index if not exists idx_admin_audit_logs_resource_time
  on public.admin_audit_logs (resource_type, created_at desc);

create index if not exists idx_admin_login_attempts_outcome_time
  on public.admin_login_attempts (outcome, created_at desc);

create index if not exists idx_admin_sessions_expiry_revoked
  on public.admin_sessions (expires_at, revoked_at);
