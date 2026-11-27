-- Atomically consume a verified signup OTP and create/verify its account.
-- Apply after user_auth_token_version.sql and before deploying the corresponding auth route.
begin;

create or replace function public.nabeh_complete_signup_otp(
  p_otp_id uuid,
  p_user_id uuid,
  p_email text,
  p_code_hash text,
  p_attempts integer,
  p_create_user boolean,
  p_display_name text,
  p_password_hash text,
  p_language text,
  p_verified_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user public.custom_users%rowtype;
  v_otp_id uuid;
begin
  update public.custom_auth_otps
  set consumed_at = p_verified_at
  where id = p_otp_id
    and email = p_email
    and purpose = 'signup'
    and code_hash = p_code_hash
    and attempts = p_attempts
    and consumed_at is null
    and expires_at > p_verified_at
  returning id into v_otp_id;

  if v_otp_id is null then
    raise exception 'signup otp unavailable or already consumed';
  end if;

  select * into v_user
  from public.custom_users
  where email = p_email
  limit 1
  for update;

  if p_create_user then
    if v_user.id is not null then
      if v_user.email_verified then
        raise exception 'email is already verified';
      end if;
      update public.custom_users
      set display_name = p_display_name,
          password_hash = p_password_hash,
          email_verified = true,
          preferred_language = p_language,
          updated_at = p_verified_at
      where id = v_user.id and email_verified = false
      returning * into v_user;
      if not found then
        raise exception 'pending user changed concurrently';
      end if;
    else
      insert into public.custom_users (
        id, email, display_name, password_hash, email_verified,
        preferred_language, auth_token_version, created_at, updated_at
      ) values (
        p_user_id, p_email, p_display_name, p_password_hash, true,
        p_language, 0, p_verified_at, p_verified_at
      ) returning * into v_user;
    end if;
  else
    update public.custom_users
    set email_verified = true, updated_at = p_verified_at
    where email = p_email and email_verified = false
    returning * into v_user;
    if not found then
      raise exception 'pending user unavailable or changed concurrently';
    end if;
  end if;

  return jsonb_build_object(
    'id', v_user.id,
    'email', v_user.email,
    'auth_token_version', coalesce(v_user.auth_token_version, 0)
  );
end;
$$;

revoke all on function public.nabeh_complete_signup_otp(uuid, uuid, text, text, integer, boolean, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.nabeh_complete_signup_otp(uuid, uuid, text, text, integer, boolean, text, text, text, timestamptz) to service_role;

commit;
