-- Locks down the migration-tracking journal.
--
-- scripts/apply-migrations.ts created public.__migrations to track which
-- SQL files have been applied (filename + sha256 + applied_at). The
-- table is purely operational metadata and is only ever written by
-- the apply script using the service-role connection — but it was
-- missing the workspace-table RLS treatment, which tripped Supabase's
-- public-table-readable security warning.
--
-- Fix: enable RLS with NO policies. anon and authenticated roles get
-- zero access. service_role bypasses RLS so the apply script keeps
-- working.

ALTER TABLE public.__migrations ENABLE ROW LEVEL SECURITY;
