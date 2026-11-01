/*
  Nabeh SafeLink — Dashboard operational indexes
  Scope: read-performance only; no data or permissions are changed.
  Run in Supabase staging first, then production.
*/

create index if not exists idx_scans_classification_created
  on public.scans (classification, created_at desc);

create index if not exists idx_scans_status_created
  on public.scans (status, created_at desc);

create index if not exists idx_feedback_status_created
  on public.feedback (status, created_at desc);

create index if not exists idx_support_status_priority_created
  on public.support_requests (status, priority, created_at desc);

create index if not exists idx_admin_audit_logs_created_action
  on public.admin_audit_logs (created_at desc, action);
