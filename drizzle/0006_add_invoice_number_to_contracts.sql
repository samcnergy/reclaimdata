-- Adds an `invoice_number` column to contracts so the extractor can record
-- the document-level identifier (Invoice #, INV-…, Job #, Work Order #,
-- Quote #, Contract No.) verbatim from each scanned source.
--
-- Nullable: most pre-digital paper jobs predate consistent numbering and
-- many one-off work orders have no number at all. Null is honest.
--
-- Not added to the contract idempotency key in build-list.ts at v1 — the
-- existing (customer_id, contract_date, amount_cents) key still wins, and
-- mixing in a sometimes-null invoice_number would cause spurious duplicates
-- when one extraction catches the number and a re-run misses it.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS invoice_number text;
