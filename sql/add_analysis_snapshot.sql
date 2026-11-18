-- Add analysis_snapshot jsonb column to public.scans table
-- Additive, non-destructive migration supporting if not exists
alter table public.scans
add column if not exists analysis_snapshot jsonb;
