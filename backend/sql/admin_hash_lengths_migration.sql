/*
  Nabeh SafeLink — Admin Hash Lengths Migration

  Purpose:
    Normalize Admin hash columns to character(64), matching the Backend
    contract for SHA-256 hexadecimal hashes.

  Safety:
    - Admin tables only. No custom_users/scans/business data is changed.
    - Transactional and fail-fast.
    - Refuses to alter a column when existing non-null values are not exactly
      64 characters after trimming. This prevents silently accepting data that
      may already have been truncated by character(1).
    - Safe to run again after a successful run.
    - Enables RLS on every Admin table and removes direct anon/authenticated access.

  Run in Supabase SQL Editor after reviewing the verification output.
*/

begin;

/* Verify that the expected Admin tables and columns exist before changing any type. */
do $$
declare
  missing text;
begin
  select string_agg(x.item, ', ' order by x.item)
    into missing
  from (
    values
      ('admin_sessions.refresh_token_hash'),
      ('admin_sessions.ip_hash'),
      ('admin_sessions.user_agent_hash'),
      ('admin_2fa_recovery_codes.code_hash'),
      ('admin_login_attempts.email_hash'),
      ('admin_login_attempts.ip_hash'),
      ('admin_invitations.token_hash'),
      ('admin_audit_logs.ip_hash'),
      ('admin_audit_logs.user_agent_hash')
  ) as x(item)
  where to_regclass('public.' || split_part(x.item, '.', 1)) is null
     or not exists (
       select 1
       from information_schema.columns c
       where c.table_schema = 'public'
         and c.table_name = split_part(x.item, '.', 1)
         and c.column_name = split_part(x.item, '.', 2)
     );

  if missing is not null then
    raise exception 'Admin hash migration aborted; missing tables/columns: %', missing;
  end if;
end
$$;

/*
  Fail before ALTER TABLE if any existing value is not exactly 64 characters.
  rtrim is intentional because PostgreSQL character(n) values are space padded.
*/
do $$
declare
  item record;
  invalid_count bigint;
  actual_type text;
begin
  for item in
    select *
    from (values
      ('admin_sessions', 'refresh_token_hash'),
      ('admin_sessions', 'ip_hash'),
      ('admin_sessions', 'user_agent_hash'),
      ('admin_2fa_recovery_codes', 'code_hash'),
      ('admin_login_attempts', 'email_hash'),
      ('admin_login_attempts', 'ip_hash'),
      ('admin_invitations', 'token_hash'),
      ('admin_audit_logs', 'ip_hash'),
      ('admin_audit_logs', 'user_agent_hash')
    ) as v(table_name, column_name)
  loop
    execute format(
      'select count(*) from public.%I where %I is not null and length(rtrim(%I::text)) <> 64',
      item.table_name, item.column_name, item.column_name
    ) into invalid_count;

    if invalid_count > 0 then
      raise exception
        'Admin hash migration aborted: %.% contains % value(s) whose trimmed length is not 64. Inspect/truncate data must be resolved manually before migration.',
        item.table_name, item.column_name, invalid_count;
    end if;
  end loop;
end
$$;

/* Convert only columns that are not already character(64). */
do $$
declare
  item record;
  actual_type text;
begin
  for item in
    select *
    from (values
      ('admin_sessions', 'refresh_token_hash'),
      ('admin_sessions', 'ip_hash'),
      ('admin_sessions', 'user_agent_hash'),
      ('admin_2fa_recovery_codes', 'code_hash'),
      ('admin_login_attempts', 'email_hash'),
      ('admin_login_attempts', 'ip_hash'),
      ('admin_invitations', 'token_hash'),
      ('admin_audit_logs', 'ip_hash'),
      ('admin_audit_logs', 'user_agent_hash')
    ) as v(table_name, column_name)
  loop
    select format_type(a.atttypid, a.atttypmod)
      into actual_type
    from pg_attribute a
    join pg_class t on t.oid = a.attrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = item.table_name
      and a.attname = item.column_name
      and a.attnum > 0
      and not a.attisdropped;

    if actual_type <> 'character(64)' then
      execute format(
        'alter table public.%I alter column %I type character(64) using rtrim(%I::text)::character(64)',
        item.table_name, item.column_name, item.column_name
      );
    end if;
  end loop;
end
$$;

/*
  Lock down all Admin tables.
  There are intentionally no anon/authenticated policies: the Admin Backend
  is the only access path and uses the server-side service_role key.
*/
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_users',
    'admin_sessions',
    'admin_2fa_methods',
    'admin_2fa_recovery_codes',
    'admin_login_attempts',
    'admin_invitations',
    'admin_audit_logs',
    'admin_notifications'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Admin RLS hardening aborted; missing table: public.%', table_name;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end
$$;

commit;

/* Post-migration verification. */
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

select
  p.tablename,
  p.rowsecurity,
  c.relforcerowsecurity as forcerowsecurity
from pg_tables p
join pg_class c
  on c.relname = p.tablename
join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = p.schemaname
where p.schemaname = 'public'
  and p.tablename in (
    'admin_users',
    'admin_sessions',
    'admin_2fa_methods',
    'admin_2fa_recovery_codes',
    'admin_login_attempts',
    'admin_invitations',
    'admin_audit_logs',
    'admin_notifications'
  )
order by p.tablename;
