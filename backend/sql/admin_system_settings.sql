/*
  Nabeh SafeLink — centralized Admin system settings.
  Run after nabeh_complete_database_study_schema.sql and admin_schema.sql.
  The Admin API uses service_role; anon/authenticated clients receive no table access.
*/
begin;

create table if not exists public.system_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;
revoke all on public.system_settings from anon, authenticated;
grant all on public.system_settings to service_role;

/* The original core schema referenced custom_users; settings rows are owned by Admin. */
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.system_settings'::regclass
      and conname = 'system_settings_updated_by_fkey'
  ) then
    alter table public.system_settings drop constraint system_settings_updated_by_fkey;
    update public.system_settings set updated_by = null where updated_by is not null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.system_settings'::regclass
      and conname = 'system_settings_updated_by_admin_fkey'
  ) then
    alter table public.system_settings
      add constraint system_settings_updated_by_admin_fkey
      foreign key (updated_by) references public.admin_users(id) on delete set null;
  end if;
end
$$;

insert into public.system_settings (key, value_json, description, is_public)
values
  ('ui.default_theme', '"light"'::jsonb, 'Default theme for new or unset user preferences', true),
  ('ui.default_language', '"ar"'::jsonb, 'Default interface language', true),
  ('ui.allow_theme_override', 'true'::jsonb, 'Allow users to change their theme', true),
  ('ui.allow_language_override', 'true'::jsonb, 'Allow users to change their language', true),
  ('system.maintenance_mode', 'false'::jsonb, 'Block ordinary application use while maintenance is active', true),
  ('features.registration_enabled', 'true'::jsonb, 'Allow new account registration', true),
  ('features.guest_scans_enabled', 'true'::jsonb, 'Allow scans without an account', true),
  ('features.public_metrics_enabled', 'true'::jsonb, 'Expose public platform statistics', true),
  ('features.ai_explanations_enabled', 'true'::jsonb, 'Allow Gemini explanations; local analysis remains available when disabled', true),
  ('legal.require_latest_terms', 'false'::jsonb, 'Require an explicit consent to the current Terms of Use', true)
on conflict (key) do nothing;

create or replace function public.admin_update_system_settings(
  p_admin_id uuid,
  p_settings jsonb,
  p_ip_hash text,
  p_user_agent_hash text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_value jsonb;
  v_before jsonb;
  v_is_public boolean;
begin
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' or p_settings = '{}'::jsonb then
    raise exception 'settings payload must be a non-empty object';
  end if;
  if not exists (select 1 from public.admin_users where id = p_admin_id and status = 'ACTIVE') then
    raise exception 'active administrator required';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_settings) loop
    if v_key = 'ui.default_theme' then
      if v_value not in ('"light"'::jsonb, '"dark"'::jsonb) then raise exception 'invalid default theme'; end if;
    elsif v_key = 'ui.default_language' then
      if v_value not in ('"ar"'::jsonb, '"en"'::jsonb) then raise exception 'invalid default language'; end if;
    elsif v_key in (
      'ui.allow_theme_override', 'ui.allow_language_override',
      'system.maintenance_mode', 'features.registration_enabled',
      'features.guest_scans_enabled', 'features.public_metrics_enabled',
      'features.ai_explanations_enabled', 'legal.require_latest_terms'
    ) then
      if jsonb_typeof(v_value) <> 'boolean' then raise exception 'setting must be boolean'; end if;
    else
      raise exception 'setting key is not allow-listed';
    end if;
  end loop;

  perform 1
    from public.system_settings
    where key in (select jsonb_object_keys(p_settings))
    for update;

  select coalesce(jsonb_object_agg(requested.key, current_setting.value_json)
                  filter (where current_setting.key is not null), '{}'::jsonb)
    into v_before
    from jsonb_object_keys(p_settings) as requested(key)
    left join public.system_settings as current_setting on current_setting.key = requested.key;

  for v_key, v_value in select key, value from jsonb_each(p_settings) loop
    v_is_public := v_key = any(array[
      'ui.default_theme', 'ui.default_language', 'ui.allow_theme_override',
      'ui.allow_language_override', 'system.maintenance_mode',
      'features.registration_enabled', 'features.guest_scans_enabled',
      'features.public_metrics_enabled', 'features.ai_explanations_enabled',
      'legal.require_latest_terms'
    ]);
    insert into public.system_settings (key, value_json, description, is_public, updated_by)
    values (v_key, v_value, 'Managed by the Admin system settings panel', v_is_public, p_admin_id)
    on conflict (key) do update set
      value_json = excluded.value_json,
      is_public = excluded.is_public,
      updated_by = excluded.updated_by,
      updated_at = now();
  end loop;

  insert into public.admin_audit_logs (
    admin_user_id, action, resource_type, before_data, after_data,
    metadata_masked, ip_hash, user_agent_hash, request_id
  ) values (
    p_admin_id, 'SYSTEM_SETTINGS_UPDATED', 'system_settings', v_before, p_settings,
    jsonb_build_object('updated_keys', (select jsonb_agg(key order by key) from jsonb_object_keys(p_settings) as keys(key))),
    p_ip_hash, p_user_agent_hash, p_request_id
  );

  return jsonb_build_object('before', v_before, 'after', p_settings);
end;
$$;

revoke all on function public.admin_update_system_settings(uuid, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_update_system_settings(uuid, jsonb, text, text, uuid) to service_role;

/* Explicit latest-terms consent is append-only and does not touch user JWTs. */
alter table public.privacy_consents drop constraint if exists privacy_consents_consent_type_check;
alter table public.privacy_consents
  add constraint privacy_consents_consent_type_check
  check (consent_type in ('PRIVACY_POLICY', 'DATA_RETENTION', 'MODEL_IMPROVEMENT', 'TERMS_OF_USE'));

commit;

/* Verification:
select key, value_json, is_public, updated_by, updated_at
from public.system_settings order by key;
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'admin_update_system_settings';
*/
