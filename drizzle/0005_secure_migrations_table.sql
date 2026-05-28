-- Enable RLS on the migration journal. The table was created by
-- scripts/apply-migrations.ts and exposed to PostgREST without a
-- policy, which Supabase's security advisor (correctly) flags as
-- "Table publicly accessible".
--
-- No policy is added → default deny for the `authenticated` role.
-- The journal is only touched by the apply-migrations script, which
-- connects with the service-role / direct DB credentials and so
-- bypasses RLS by design.

ALTER TABLE public.__migrations ENABLE ROW LEVEL SECURITY;

-- An explicit deny policy so the intent is visible in pg_policies.
DROP POLICY IF EXISTS __migrations_deny_all ON public.__migrations;
CREATE POLICY __migrations_deny_all ON public.__migrations
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);
