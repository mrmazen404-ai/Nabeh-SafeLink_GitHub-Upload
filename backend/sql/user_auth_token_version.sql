-- Apply before deploying the backend code that validates auth_token_version.
begin;

alter table public.custom_users
  add column if not exists auth_token_version integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'custom_users_auth_token_version_nonnegative'
      and conrelid = 'public.custom_users'::regclass
  ) then
    alter table public.custom_users
      add constraint custom_users_auth_token_version_nonnegative
      check (auth_token_version >= 0) not valid;
  end if;
end $$;

alter table public.custom_users
  validate constraint custom_users_auth_token_version_nonnegative;

commit;
