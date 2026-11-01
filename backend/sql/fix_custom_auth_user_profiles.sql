-- Run this once in Supabase SQL Editor on an existing installation.
-- Registration no longer writes user_profiles; custom_users is the identity source.

do $$
declare
  constraint_row record;
begin
  if to_regclass('public.user_profiles') is null then
    return;
  end if;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and contype = 'f'
  loop
    execute format('alter table public.user_profiles drop constraint if exists %I', constraint_row.conname);
  end loop;
end $$;

-- Optional cleanup: this table is not used by the custom-auth backend.
-- Do not drop it automatically if another application still depends on it.
