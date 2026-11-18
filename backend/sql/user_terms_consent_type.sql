-- Align the consent_type constraint with the current TermsConsentGate API.
-- Existing rows are retained; this only replaces checks on consent_type.
begin;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.privacy_consents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%consent_type%'
  loop
    execute format('alter table public.privacy_consents drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.privacy_consents
  add constraint privacy_consents_consent_type_check
  check (consent_type in ('PRIVACY_POLICY', 'DATA_RETENTION', 'MODEL_IMPROVEMENT', 'TERMS_OF_USE')) not valid;

alter table public.privacy_consents
  validate constraint privacy_consents_consent_type_check;

commit;
