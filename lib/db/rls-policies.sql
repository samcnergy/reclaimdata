-- =========================================================================
-- Reclaim Data — Row-Level Security policies
-- =========================================================================
-- This is the defense-in-depth enforcement layer for multi-tenancy. Even if
-- an API route forgets to scope a query by workspace_id, RLS will still
-- block cross-workspace reads and writes.
--
-- Applied via `drizzle-kit push` (hand-rolled migration) against both the
-- DEV and PROD Supabase projects. Policies reference `auth.uid()`, which
-- Supabase populates from the JWT on every request against the Postgres API.
--
-- Model:
--   - `workspace_members` is the authority on who belongs to which workspace.
--   - Tenant-scoped tables filter on `workspace_id IN (SELECT workspace_id
--     FROM workspace_members WHERE user_id = auth.uid())`.
--   - `users` row is readable by its owner only.
--   - `waitlist` is writable only by the service role (public signups go
--     through a server action that uses the admin client).
-- =========================================================================

-- ---- helpers ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = ws
      AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_workspace_member IS
  'Returns true if the current auth.uid() belongs to the given workspace. '
  'SECURITY DEFINER so policy predicates can call it without recursing into '
  'workspace_members own RLS.';

-- ---- enable RLS on every tenant-scoped table ----------------------------

ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_connections    ENABLE ROW LEVEL SECURITY;

-- ---- users --------------------------------------------------------------

DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERTs into users go through the auth hook (server action with service
-- role); no authenticated-user INSERT policy.

-- ---- workspaces ---------------------------------------------------------

DROP POLICY IF EXISTS workspaces_member_select ON public.workspaces;
CREATE POLICY workspaces_member_select ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS workspaces_owner_update ON public.workspaces;
CREATE POLICY workspaces_owner_update ON public.workspaces
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspaces.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS workspaces_owner_delete ON public.workspaces;
CREATE POLICY workspaces_owner_delete ON public.workspaces
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS workspaces_self_insert ON public.workspaces;
CREATE POLICY workspaces_self_insert ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- ---- workspace_members --------------------------------------------------

DROP POLICY IF EXISTS workspace_members_self_select ON public.workspace_members;
CREATE POLICY workspace_members_self_select ON public.workspace_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS workspace_members_admin_write ON public.workspace_members;
CREATE POLICY workspace_members_admin_write ON public.workspace_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- ---- tenant-scoped tables (uniform policy) ------------------------------
-- For these tables, any workspace member can SELECT/INSERT/UPDATE/DELETE.
-- Role gating (member vs admin vs owner) happens at the application layer.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'uploads',
    'extraction_runs',
    'customers',
    'phones',
    'emails',
    'addresses',
    'contracts',
    'line_items',
    'notes',
    'duplicate_candidates',
    'audits',
    'email_connections'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_member_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_member_all ON public.%I '
      'FOR ALL TO authenticated '
      'USING (public.is_workspace_member(workspace_id)) '
      'WITH CHECK (public.is_workspace_member(workspace_id))',
      t, t
    );
  END LOOP;
END $$;

-- ---- waitlist -----------------------------------------------------------
-- Waitlist is a public-intake table. Writes come exclusively from the
-- /api/waitlist route handler using the service-role admin client. No
-- policy grants anon/authenticated access; RLS denies everything by default.

-- =========================================================================
-- Storage bucket policies (reclaimdata-uploads)
-- =========================================================================
-- Supabase Storage stores policies against the `storage.objects` table.
-- File paths are `{workspaceId}/{uuid}-{filename}` — the leading path
-- segment is the workspace id.

DROP POLICY IF EXISTS reclaimdata_uploads_member_select ON storage.objects;
CREATE POLICY reclaimdata_uploads_member_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reclaimdata-uploads'
    AND public.is_workspace_member((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS reclaimdata_uploads_member_insert ON storage.objects;
CREATE POLICY reclaimdata_uploads_member_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reclaimdata-uploads'
    AND public.is_workspace_member((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS reclaimdata_uploads_member_update ON storage.objects;
CREATE POLICY reclaimdata_uploads_member_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'reclaimdata-uploads'
    AND public.is_workspace_member((string_to_array(name, '/'))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'reclaimdata-uploads'
    AND public.is_workspace_member((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS reclaimdata_uploads_member_delete ON storage.objects;
CREATE POLICY reclaimdata_uploads_member_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reclaimdata-uploads'
    AND public.is_workspace_member((string_to_array(name, '/'))[1]::uuid)
  );

-- =========================================================================
-- Auth trigger: mirror auth.users into public.users on signup.
-- =========================================================================
-- Keeps FK joins working from application tables to a real `public.users`
-- row (audit trails, uploaded_by, author_id, invited_by, run_by).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
