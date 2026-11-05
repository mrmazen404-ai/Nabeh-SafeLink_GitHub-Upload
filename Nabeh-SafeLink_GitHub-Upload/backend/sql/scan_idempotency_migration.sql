/* Nabeh SafeLink — authenticated scan idempotency.
   Apply before deploying clients that send the Idempotency-Key header.
   The raw key is never stored; only a keyed SHA-256 digest is persisted. */
begin;

alter table public.scans
  add column if not exists idempotency_key_hash char(64),
  add column if not exists input_hash char(64),
  add column if not exists analysis_snapshot jsonb;

/* Older schema snapshots declared input_hash as unbounded/one-character CHAR.
   Widen it without changing the stored value. */
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scans'
      and column_name = 'input_hash'
      and data_type = 'character'
      and character_maximum_length = 1
  ) then
    alter table public.scans
      alter column input_hash type character(64)
      using rtrim(input_hash::text)::character(64);
  end if;
end $$;

create unique index if not exists scans_user_idempotency_key_unique
  on public.scans(user_id, idempotency_key_hash)
  where idempotency_key_hash is not null;

create index if not exists scans_input_hash_idx
  on public.scans(user_id, input_hash)
  where input_hash is not null;

commit;
