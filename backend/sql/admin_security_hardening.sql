/*
  Nabeh SafeLink — Admin security hardening migration.
  Run after admin_schema.sql. The Admin API calls these functions through service_role.
*/
begin;

create or replace function public.admin_bootstrap_first(
  p_email text,
  p_display_name text,
  p_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_email text;
begin
  perform pg_advisory_xact_lock(hashtext('nabeh-safelink-admin-bootstrap'));
  if exists (select 1 from public.admin_users limit 1) then
    raise exception 'admin bootstrap already completed';
  end if;

  insert into public.admin_users (
    email, display_name, password_hash, role, status, email_verified, two_factor_required
  ) values (
    lower(trim(p_email)), trim(p_display_name), p_password_hash,
    'SUPER_ADMIN', 'ACTIVE', true, true
  ) returning id, email into v_id, v_email;

  return jsonb_build_object('id', v_id, 'email', v_email, 'role', 'SUPER_ADMIN', 'status', 'ACTIVE');
end;
$$;

create or replace function public.admin_accept_invitation(
  p_token_hash text,
  p_email text,
  p_display_name text,
  p_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.admin_invitations%rowtype;
  v_id uuid;
  v_email text;
begin
  select * into v_invitation
  from public.admin_invitations
  where token_hash = p_token_hash
    and lower(email) = lower(trim(p_email))
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invitation is invalid or expired';
  end if;
  if exists (select 1 from public.admin_users where email = lower(trim(p_email))) then
    raise exception 'administrator email already exists';
  end if;

  insert into public.admin_users (
    email, display_name, password_hash, role, status, email_verified, two_factor_required
  ) values (
    lower(trim(p_email)), trim(p_display_name), p_password_hash,
    v_invitation.role, 'ACTIVE', true, true
  ) returning id, email into v_id, v_email;

  update public.admin_invitations
  set accepted_at = now()
  where id = v_invitation.id and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'invitation was accepted concurrently';
  end if;

  return jsonb_build_object(
    'id', v_id, 'email', v_email, 'role', v_invitation.role,
    'status', 'ACTIVE', 'invitation_id', v_invitation.id
  );
end;
$$;

revoke all on function public.admin_bootstrap_first(text, text, text) from public, anon, authenticated;
revoke all on function public.admin_accept_invitation(text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_bootstrap_first(text, text, text) to service_role;
grant execute on function public.admin_accept_invitation(text, text, text, text) to service_role;

commit;
