-- pg_trgm for fuzzy name/address dedupe (trigram similarity).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes over the low-cardinality fields dedupe queries against.
-- Using the pg_trgm gin_trgm_ops opclass so `similarity(a, b) > threshold`
-- runs over the index rather than scanning.
CREATE INDEX IF NOT EXISTS customers_name_trgm_idx
  ON public.customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customers_company_trgm_idx
  ON public.customers USING gin (company_name gin_trgm_ops);

-- Strong-signal dedupe indexes.
CREATE INDEX IF NOT EXISTS phones_e164_idx
  ON public.phones (workspace_id, e164_value)
  WHERE e164_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS emails_normalized_idx
  ON public.emails (workspace_id, normalized_value)
  WHERE normalized_value IS NOT NULL;
