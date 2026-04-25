-- Race-safe single workspace bootstrap. The two-step "check then insert"
-- in JS could create duplicates under concurrent first-load requests
-- (e.g. session refresh + initial /app render firing in parallel). This
-- function holds an advisory lock per user during the check + insert so
-- only one workspace can ever be auto-created for a given user.

CREATE OR REPLACE FUNCTION public.ensure_default_workspace(
  p_user_id uuid,
  p_workspace_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key bigint := hashtextextended(p_user_id::text, 0);
  v_workspace_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT workspace_id INTO v_workspace_id
  FROM workspace_members
  WHERE user_id = p_user_id
  ORDER BY joined_at ASC
  LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    RETURN v_workspace_id;
  END IF;

  INSERT INTO workspaces (name, owner_id)
  VALUES (p_workspace_name, p_user_id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, p_user_id, 'owner');

  RETURN v_workspace_id;
END;
$$;
