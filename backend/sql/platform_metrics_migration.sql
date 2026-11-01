/* Privacy-preserving aggregate metrics for Welcome and public overview. */
begin;

create table if not exists public.platform_daily_metrics (
  metric_date date primary key default current_date,
  total_scans bigint not null default 0 check (total_scans >= 0),
  safe_scans bigint not null default 0 check (safe_scans >= 0),
  suspicious_scans bigint not null default 0 check (suspicious_scans >= 0),
  dangerous_scans bigint not null default 0 check (dangerous_scans >= 0),
  unknown_scans bigint not null default 0 check (unknown_scans >= 0),
  updated_at timestamptz not null default now()
);

alter table public.platform_daily_metrics enable row level security;
revoke all on public.platform_daily_metrics from anon, authenticated;
grant all on public.platform_daily_metrics to service_role;

create or replace function public.record_platform_scan_metric(p_classification text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  normalized text := upper(coalesce(p_classification, 'UNKNOWN'));
  safe_increment bigint := 0;
  suspicious_increment bigint := 0;
  dangerous_increment bigint := 0;
  unknown_increment bigint := 0;
begin
  if normalized not in ('SAFE', 'SUSPICIOUS', 'DANGEROUS', 'UNKNOWN') then
    normalized := 'UNKNOWN';
  end if;

  if normalized = 'SAFE' then safe_increment := 1;
  elsif normalized = 'SUSPICIOUS' then suspicious_increment := 1;
  elsif normalized = 'DANGEROUS' then dangerous_increment := 1;
  else unknown_increment := 1;
  end if;

  insert into public.platform_daily_metrics (
    metric_date, total_scans, safe_scans, suspicious_scans, dangerous_scans, unknown_scans
  ) values (
    current_date, 1, safe_increment, suspicious_increment, dangerous_increment, unknown_increment
  )
  on conflict (metric_date) do update set
    total_scans = public.platform_daily_metrics.total_scans + 1,
    safe_scans = public.platform_daily_metrics.safe_scans + excluded.safe_scans,
    suspicious_scans = public.platform_daily_metrics.suspicious_scans + excluded.suspicious_scans,
    dangerous_scans = public.platform_daily_metrics.dangerous_scans + excluded.dangerous_scans,
    unknown_scans = public.platform_daily_metrics.unknown_scans + excluded.unknown_scans,
    updated_at = now();
end;
$$;

revoke all on function public.record_platform_scan_metric(text) from public, anon, authenticated;
grant execute on function public.record_platform_scan_metric(text) to service_role;

/* Backfill historical completed authenticated scans once, without duplicating existing dates. */
insert into public.platform_daily_metrics (
  metric_date, total_scans, safe_scans, suspicious_scans, dangerous_scans, unknown_scans
)
select
  created_at::date,
  count(*)::bigint,
  count(*) filter (where classification = 'SAFE')::bigint,
  count(*) filter (where classification = 'SUSPICIOUS')::bigint,
  count(*) filter (where classification = 'DANGEROUS')::bigint,
  count(*) filter (where classification is null or classification = 'UNKNOWN')::bigint
from public.scans
where status = 'COMPLETED'
group by created_at::date
on conflict (metric_date) do nothing;

commit;

-- Verification
select * from public.platform_daily_metrics order by metric_date desc limit 10;
