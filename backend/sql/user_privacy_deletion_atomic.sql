-- Atomic privacy deletion operations. Apply before deploying the backend routes that call these RPCs.
begin;

create or replace function public.nabeh_delete_user_scan(
  p_user_id uuid,
  p_scan_id uuid,
  p_deleted_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_scan_id uuid;
  v_table text;
begin
  select id into v_scan_id
  from public.scans
  where id = p_scan_id and user_id = p_user_id and user_deleted_at is null
  for update;

  if v_scan_id is null then
    return false;
  end if;

  foreach v_table in array array['scan_signals', 'scan_explanations', 'scan_fraud_types', 'email_header_analyses'] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('delete from public.%I where scan_id = $1', v_table) using v_scan_id;
    end if;
  end loop;

  update public.scans
  set user_deleted_at = p_deleted_at,
      user_hidden_at = p_deleted_at,
      input_value_masked = null,
      analysis_snapshot = null,
      recommendation = null
  where id = v_scan_id and user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.nabeh_delete_user_account(
  p_user_id uuid,
  p_deletion_id uuid,
  p_replacement_email text,
  p_replacement_password_hash text,
  p_deleted_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request_id uuid;
  v_table text;
begin
  select id into v_request_id
  from public.account_deletion_requests
  where id = p_deletion_id and user_id = p_user_id and status in ('PENDING', 'CONFIRMED')
  for update;
  if v_request_id is null then
    raise exception 'deletion request unavailable';
  end if;

  -- Delete scan-specific details before de-identifying the parent scan rows.
  foreach v_table in array array['scan_signals', 'scan_explanations', 'scan_fraud_types', 'email_header_analyses'] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format(
        'delete from public.%I where scan_id in (select id from public.scans where user_id = $1)',
        v_table
      ) using p_user_id;
    end if;
  end loop;

  update public.scans
  set user_id = null,
      input_value_masked = null,
      analysis_snapshot = null,
      recommendation = null,
      user_hidden_at = p_deleted_at,
      user_deleted_at = p_deleted_at
  where user_id = p_user_id;

  foreach v_table in array array[
    'feedback', 'notifications', 'notification_preferences', 'privacy_consents',
    'custom_auth_otps', 'api_keys', 'integrations', 'uploaded_files', 'user_profiles'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('delete from public.%I where user_id = $1', v_table) using p_user_id;
    end if;
  end loop;

  if to_regclass('public.support_requests') is not null then
    update public.support_requests
    set user_id = null,
        email = null,
        message = 'تمت إزالة بيانات صاحب الحساب بناءً على طلب الحذف.',
        status = 'CLOSED',
        resolved_at = p_deleted_at
    where user_id = p_user_id;
  end if;
  if to_regclass('public.audit_logs') is not null then
    update public.audit_logs
    set actor_user_id = null,
        metadata_masked = '{"event":"ACCOUNT_DELETED","user_reference":"removed"}'::jsonb
    where actor_user_id = p_user_id;
  end if;

  update public.custom_users
  set email = p_replacement_email,
      display_name = 'Deleted user',
      password_hash = p_replacement_password_hash,
      status = 'DELETED',
      email_verified = false,
      auth_token_version = coalesce(auth_token_version, 0) + 1,
      updated_at = p_deleted_at
  where id = p_user_id;
  if not found then
    raise exception 'user unavailable';
  end if;

  update public.account_deletion_requests
  set status = 'COMPLETED',
      confirmed_at = p_deleted_at,
      completed_at = p_deleted_at
  where id = v_request_id;

  return true;
end;
$$;

revoke all on function public.nabeh_delete_user_scan(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.nabeh_delete_user_account(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.nabeh_delete_user_scan(uuid, uuid, timestamptz) to service_role;
grant execute on function public.nabeh_delete_user_account(uuid, uuid, text, text, timestamptz) to service_role;

commit;
