-- Rewrites delete_upload_cascade so deleting an upload no longer
-- deletes the customer data that came from it.
--
-- v0.1 (migration 0003) cascaded everything: child rows + orphan
-- customers were swept. That was wrong — once data is in the workspace
-- it's part of the contractor's CRM and should persist independently
-- of whether the source PDF still exists.
--
-- New behavior: when an upload is deleted, every phone / email /
-- address / contract that referenced it has just THIS upload stripped
-- from its source_refs. The row itself stays. Customers stay. The
-- upload row + extraction_runs (FK cascade) + storage objects (handled
-- in the route) are still removed.

CREATE OR REPLACE FUNCTION public.delete_upload_cascade(p_upload_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.uploads WHERE id = p_upload_id;

  IF v_workspace_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Strip this upload from source_refs on every child row that
  -- referenced it. Keep the row regardless of whether it had other
  -- sources.
  UPDATE public.phones
  SET source_refs = COALESCE(
    (SELECT jsonb_agg(e) FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' <> p_upload_id::text),
    '[]'::jsonb
  )
  WHERE workspace_id = v_workspace_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' = p_upload_id::text);

  UPDATE public.emails
  SET source_refs = COALESCE(
    (SELECT jsonb_agg(e) FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' <> p_upload_id::text),
    '[]'::jsonb
  )
  WHERE workspace_id = v_workspace_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' = p_upload_id::text);

  UPDATE public.addresses
  SET source_refs = COALESCE(
    (SELECT jsonb_agg(e) FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' <> p_upload_id::text),
    '[]'::jsonb
  )
  WHERE workspace_id = v_workspace_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' = p_upload_id::text);

  UPDATE public.contracts
  SET source_refs = COALESCE(
    (SELECT jsonb_agg(e) FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' <> p_upload_id::text),
    '[]'::jsonb
  )
  WHERE workspace_id = v_workspace_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' = p_upload_id::text);

  -- Drop the upload itself. extraction_runs cascades via FK.
  DELETE FROM public.uploads WHERE id = p_upload_id;

  RETURN v_workspace_id;
END;
$$;
