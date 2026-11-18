/* Nabeh SafeLink — unique support ticket identifiers.
   Apply to Supabase before deploying code that writes ticket_id.
   Existing missing/duplicate identifiers are replaced before constraints are set. */
begin;

alter table public.support_requests
  add column if not exists ticket_id text;

update public.support_requests
set ticket_id = 'TK-' || upper(replace(gen_random_uuid()::text, '-', ''))
where ticket_id is null or btrim(ticket_id) = '';

with duplicate_tickets as (
  select id, row_number() over (partition by ticket_id order by created_at, id) as row_number
  from public.support_requests
)
update public.support_requests as support
set ticket_id = 'TK-' || upper(replace(gen_random_uuid()::text, '-', ''))
from duplicate_tickets as duplicate
where support.id = duplicate.id
  and duplicate.row_number > 1;

alter table public.support_requests
  alter column ticket_id set default ('TK-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  alter column ticket_id set not null;

create unique index if not exists support_requests_ticket_id_unique
  on public.support_requests(ticket_id);

commit;
