-- Atomic cascade-delete of an upload + everything sourced from its
-- extraction. Removes:
--   * phones / emails / addresses / contracts whose source_refs reference
--     ONLY this upload (single-source rows).
--   * For multi-source rows, just strips this upload from source_refs.
--   * Customers that end up with zero remaining child rows are orphans
--     and get deleted too.
--   * The uploads row itself (extraction_runs cascades via FK).
--
-- Returns the workspace_id (or NULL if the upload didn't exist) so the
-- caller can decide whether to redirect / refresh affected views.

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

  -- 1. Single-source children: delete outright.
  DELETE FROM public.phones
  WHERE workspace_id = v_workspace_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' = p_upload_id::text)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' <> p_upload_id::text);

  DELETE FROM public.emails
  WHERE workspace_id = v_workspace_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' = p_upload_id::text)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' <> p_upload_id::text);

  DELETE FROM public.addresses
  WHERE workspace_id = v_workspace_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' = p_upload_id::text)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' <> p_upload_id::text);

  DELETE FROM public.contracts
  WHERE workspace_id = v_workspace_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' = p_upload_id::text)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(source_refs) e WHERE e->>'uploadId' <> p_upload_id::text);

  -- 2. Multi-source rows: strip this upload from source_refs but keep the row.
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

  -- 3. Sweep customers that lost everything.
  DELETE FROM public.customers c
  WHERE c.workspace_id = v_workspace_id
    AND NOT EXISTS (SELECT 1 FROM public.phones    WHERE customer_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.emails    WHERE customer_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.addresses WHERE customer_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.contracts WHERE customer_id = c.id);

  -- 4. The upload itself. extraction_runs cascades on the FK.
  DELETE FROM public.uploads WHERE id = p_upload_id;

  RETURN v_workspace_id;
END;
$$;
