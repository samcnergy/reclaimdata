/**
 * Orchestrates normalize → dedupe → load for every customer/contract the
 * extractor has produced in this workspace.
 *
 * Invoked by the pipeline.build-list Inngest function (from the user
 * clicking "Build my client list"). Pulls every extraction_run that isn't
 * yet attached to customer rows, walks them, and materializes customers +
 * phones + emails + addresses + contracts + line_items.
 *
 * Idempotent by construction:
 *   - Strong dedupe (E.164 phone, exact email) auto-merges.
 *   - Contacts are deduped internally before insert (a run that says the
 *     same phone twice writes one row).
 *   - Re-running the pipeline with no new extraction data is a no-op for
 *     customer rows (dedupe short-circuits) and just recomputes scores.
 *
 * Validation against third-party providers (Twilio, ZeroBounce, USPS)
 * runs as a separate step after this (milestone 11). This file only
 * handles format-level normalization.
 */

import postgres from "postgres";

import { findFuzzyMatch, findStrongMatch } from "@/lib/dedupe/matcher";
import { normalizeAddress } from "@/lib/normalization/address";
import { validateWorkspace, type ValidationStats } from "@/lib/pipeline/validate";
import { normalizeEmail } from "@/lib/normalization/email";
import { normalizeIsoDate } from "@/lib/normalization/date";
import { normalizeName } from "@/lib/normalization/name";
import { normalizePhone } from "@/lib/normalization/phone";
import { computeConfidenceScore } from "@/lib/scoring/confidence";
import { computeHealthScore } from "@/lib/scoring/health";
import type {
  ExtractedAddress,
  ExtractedContract,
  ExtractedCustomer,
  ExtractedDocument,
  ExtractedEmail,
  ExtractedPhone,
} from "@/lib/extraction/schemas";

export type BuildListStats = {
  runsProcessed: number;
  customersCreated: number;
  customersMerged: number;
  candidatesQueued: number;
  contractsCreated: number;
  validation: ValidationStats;
};

export async function buildClientList(args: {
  workspaceId: string;
  dbUrl: string;
}): Promise<BuildListStats> {
  const sql = postgres(args.dbUrl, { max: 1, prepare: false });
  const stats: BuildListStats = {
    runsProcessed: 0,
    customersCreated: 0,
    customersMerged: 0,
    candidatesQueued: 0,
    contractsCreated: 0,
    validation: { phonesChecked: 0, emailsChecked: 0, addressesChecked: 0 },
  };

  try {
    const runs = await sql<Array<{ id: string; upload_id: string; raw_response_storage_path: string | null }>>`
      SELECT id, upload_id, raw_response_storage_path
      FROM extraction_runs
      WHERE workspace_id = ${args.workspaceId}
        AND status = 'completed'
      ORDER BY created_at ASC
    `;

    for (const run of runs) {
      // Every completed run has its raw extraction in Storage. Pull it.
      const extracted = await loadExtraction(args.workspaceId, run.raw_response_storage_path);
      if (!extracted) continue;
      stats.runsProcessed++;

      for (const customer of extracted.customers) {
        const resolved = await resolveCustomer({
          sql,
          workspaceId: args.workspaceId,
          uploadId: run.upload_id,
          customer,
        });

        if (resolved.outcome === "created") stats.customersCreated++;
        else if (resolved.outcome === "merged") stats.customersMerged++;
        else if (resolved.outcome === "candidate-queued") stats.candidatesQueued++;

        // Attach all contracts from this document to the resolved customer.
        // Heuristic: if the document has N customers and M contracts, we
        // attach every contract to every customer. For the 1-customer case
        // (contracts, invoices) this is correct; for list/spreadsheet cases
        // there are 0 contracts so the loop is a no-op.
        if (resolved.customerId && extracted.contracts.length > 0) {
          for (const contract of extracted.contracts) {
            const created = await upsertContract({
              sql,
              workspaceId: args.workspaceId,
              customerId: resolved.customerId,
              uploadId: run.upload_id,
              contract,
            });
            if (created) stats.contractsCreated++;
          }
        }

        if (resolved.customerId) {
          await recomputeScores({
            sql,
            workspaceId: args.workspaceId,
            customerId: resolved.customerId,
            customerConfidence: customer.confidence,
          });
        }
      }
    }

    // Stage 4: validate every new phone / email / address against Twilio,
    // ZeroBounce, and USPS. Validation happens after materialization so
    // the DB is coherent even if one of the providers is throttled.
    stats.validation = await validateWorkspace({
      sql,
      workspaceId: args.workspaceId,
    });

    return stats;
  } finally {
    await sql.end();
  }
}

/* ------------------------------------------------------------------- */
/* Helpers                                                             */
/* ------------------------------------------------------------------- */

async function loadExtraction(
  workspaceId: string,
  path: string | null,
): Promise<ExtractedDocument | null> {
  if (!path) return null;
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const { STORAGE_BUCKET } = await import("@/lib/storage/upload");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) return null;
  const text = await data.text();
  const wrapper = JSON.parse(text) as { extracted: ExtractedDocument };
  // Safety check: the raw response is under {workspaceId}/_extraction/ —
  // the download would fail if the caller didn't belong here, but we also
  // validate we're not accidentally crossing workspaces.
  if (!path.startsWith(`${workspaceId}/`)) return null;
  return wrapper.extracted;
}

type ResolveResult =
  | { outcome: "created"; customerId: string }
  | { outcome: "merged"; customerId: string }
  | { outcome: "candidate-queued"; customerId: string }
  | { outcome: "skipped-no-signal"; customerId: null };

async function resolveCustomer(args: {
  sql: postgres.Sql;
  workspaceId: string;
  uploadId: string;
  customer: ExtractedCustomer;
}): Promise<ResolveResult> {
  const { sql, workspaceId, uploadId, customer } = args;

  // Build normalized signals up front.
  const phones = customer.phones
    .map((p) => ({
      raw: p.raw_value,
      e164: normalizePhone(p.raw_value).e164,
      confidence: p.confidence,
    }))
    .filter((p, i, arr) => arr.findIndex((o) => (o.e164 ?? o.raw) === (p.e164 ?? p.raw)) === i);

  const emails = customer.emails
    .map((e) => ({
      raw: e.raw_value,
      normalized: normalizeEmail(e.raw_value).normalized,
      confidence: e.confidence,
    }))
    .filter((e, i, arr) => arr.findIndex((o) => (o.normalized ?? o.raw) === (e.normalized ?? e.raw)) === i);

  const addresses = customer.addresses.map((a) => ({
    raw: a.raw_value,
    normalized: normalizeAddress({
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postal_code,
      country: a.country,
    }),
    confidence: a.confidence,
  }));

  const normalizedName = customer.name ? normalizeName(customer.name) : null;

  // Skip customers with no distinguishing signal at all.
  if (!normalizedName && !customer.company_name && phones.length === 0 && emails.length === 0) {
    return { outcome: "skipped-no-signal", customerId: null };
  }

  const strong = await findStrongMatch({
    sql,
    workspaceId,
    e164Phones: phones.map((p) => p.e164).filter(Boolean) as string[],
    normalizedEmails: emails.map((e) => e.normalized).filter(Boolean) as string[],
  });

  let customerId: string;
  let outcome: ResolveResult["outcome"];

  if (strong) {
    customerId = strong.customerId;
    outcome = "merged";
  } else {
    const fuzzy = await findFuzzyMatch({
      sql,
      workspaceId,
      name: normalizedName?.full ?? customer.company_name ?? null,
      addressLine1: addresses[0]?.normalized.line1 ?? null,
      city: addresses[0]?.normalized.city ?? null,
    });

    if (fuzzy && fuzzy.score >= 90) {
      customerId = fuzzy.customerId;
      outcome = "merged";
    } else if (fuzzy && fuzzy.score >= 70) {
      // Medium confidence: create the new record AND surface for review.
      customerId = await insertCustomer({
        sql,
        workspaceId,
        normalizedName,
        customer,
      });
      await sql`
        INSERT INTO duplicate_candidates (workspace_id, customer_a_id, customer_b_id, score, reason)
        VALUES (${workspaceId}, ${customerId}, ${fuzzy.customerId}, ${fuzzy.score}, ${fuzzy.reason})
      `;
      outcome = "candidate-queued";
    } else {
      customerId = await insertCustomer({
        sql,
        workspaceId,
        normalizedName,
        customer,
      });
      outcome = "created";
    }
  }

  // Attach new phones / emails / addresses to the resolved customer.
  for (const p of phones) {
    await sql`
      INSERT INTO phones (customer_id, workspace_id, raw_value, e164_value, confidence, source_refs)
      SELECT ${customerId}, ${workspaceId}, ${p.raw}, ${p.e164}, ${p.confidence},
             ${sql.json([{ uploadId, kind: "extracted" }])}
      WHERE NOT EXISTS (
        SELECT 1 FROM phones
        WHERE customer_id = ${customerId}
          AND (
            (${p.e164}::text IS NOT NULL AND e164_value = ${p.e164})
            OR raw_value = ${p.raw}
          )
      )
    `;
  }
  for (const e of emails) {
    await sql`
      INSERT INTO emails (customer_id, workspace_id, raw_value, normalized_value, confidence, source_refs)
      SELECT ${customerId}, ${workspaceId}, ${e.raw}, ${e.normalized}, ${e.confidence},
             ${sql.json([{ uploadId, kind: "extracted" }])}
      WHERE NOT EXISTS (
        SELECT 1 FROM emails
        WHERE customer_id = ${customerId}
          AND (
            (${e.normalized}::text IS NOT NULL AND normalized_value = ${e.normalized})
            OR raw_value = ${e.raw}
          )
      )
    `;
  }
  for (const a of addresses) {
    await sql`
      INSERT INTO addresses (
        customer_id, workspace_id, raw_value, line1, line2, city, state, postal_code, country, confidence, source_refs
      )
      SELECT ${customerId}, ${workspaceId}, ${a.raw},
             ${a.normalized.line1}, ${a.normalized.line2}, ${a.normalized.city},
             ${a.normalized.state}, ${a.normalized.postalCode}, ${a.normalized.country},
             ${a.confidence},
             ${sql.json([{ uploadId, kind: "extracted" }])}
      WHERE NOT EXISTS (
        SELECT 1 FROM addresses
        WHERE customer_id = ${customerId}
          AND raw_value = ${a.raw}
      )
    `;
  }

  return { outcome, customerId };
}

async function insertCustomer(args: {
  sql: postgres.Sql;
  workspaceId: string;
  normalizedName: ReturnType<typeof normalizeName>;
  customer: ExtractedCustomer;
}): Promise<string> {
  const { sql, workspaceId, normalizedName, customer } = args;

  const displayName =
    normalizedName?.full ??
    customer.company_name ??
    customer.emails[0]?.raw_value ??
    customer.phones[0]?.raw_value ??
    "Unknown";

  const row = await sql<Array<{ id: string }>>`
    INSERT INTO customers (
      workspace_id, name, name_prefix, name_suffix, company_name, confidence_score
    )
    VALUES (
      ${workspaceId}, ${displayName}, ${normalizedName?.prefix ?? null},
      ${normalizedName?.suffix ?? null}, ${customer.company_name}, ${customer.confidence}
    )
    RETURNING id
  `;
  return row[0].id;
}

async function upsertContract(args: {
  sql: postgres.Sql;
  workspaceId: string;
  customerId: string;
  uploadId: string;
  contract: ExtractedContract;
}): Promise<boolean> {
  const { sql, workspaceId, customerId, uploadId, contract } = args;

  const contractDate = normalizeIsoDate(contract.contract_date);

  // Idempotency: (customer_id, contract_date, amount_cents) is our key.
  const existing = await sql<Array<{ id: string }>>`
    SELECT id FROM contracts
    WHERE customer_id = ${customerId}
      AND workspace_id = ${workspaceId}
      AND COALESCE(contract_date::text, '') = COALESCE(${contractDate}::text, '')
      AND COALESCE(amount_cents, -1) = COALESCE(${contract.amount_cents}, -1)
    LIMIT 1
  `;
  if (existing.length > 0) return false;

  const inserted = await sql<Array<{ id: string }>>`
    INSERT INTO contracts (
      customer_id, workspace_id, contract_date, amount_cents, scope_of_work, confidence, source_refs
    )
    VALUES (
      ${customerId}, ${workspaceId}, ${contractDate}, ${contract.amount_cents},
      ${contract.scope_of_work}, ${contract.confidence},
      ${sql.json([{ uploadId, kind: "extracted" }])}
    )
    RETURNING id
  `;
  const contractId = inserted[0].id;

  for (const li of contract.line_items) {
    await sql`
      INSERT INTO line_items (
        contract_id, workspace_id, product_type, size, color, quantity, unit_price_cents
      )
      VALUES (
        ${contractId}, ${workspaceId}, ${li.product_type}, ${li.size}, ${li.color},
        ${li.quantity}, ${li.unit_price_cents}
      )
    `;
  }
  return true;
}

async function recomputeScores(args: {
  sql: postgres.Sql;
  workspaceId: string;
  customerId: string;
  customerConfidence: number;
}): Promise<void> {
  const { sql, workspaceId, customerId, customerConfidence } = args;

  const [stats] = await sql<Array<{
    has_phone: boolean;
    has_email: boolean;
    has_address: boolean;
    latest_contract_date: string | null;
    has_scope: boolean;
    has_line_item: boolean;
    phone_confidence: number | null;
    email_confidence: number | null;
    address_confidence: number | null;
    contract_confidence: number | null;
    phone_id: string | null;
    email_id: string | null;
    address_id: string | null;
    total_contract_cents: number | null;
  }>>`
    WITH p AS (
      SELECT id, confidence FROM phones
      WHERE customer_id = ${customerId} AND workspace_id = ${workspaceId}
      ORDER BY confidence DESC, created_at ASC LIMIT 1
    ),
    e AS (
      SELECT id, confidence FROM emails
      WHERE customer_id = ${customerId} AND workspace_id = ${workspaceId}
      ORDER BY confidence DESC, created_at ASC LIMIT 1
    ),
    a AS (
      SELECT id, confidence FROM addresses
      WHERE customer_id = ${customerId} AND workspace_id = ${workspaceId}
      ORDER BY confidence DESC, created_at ASC LIMIT 1
    ),
    c AS (
      SELECT contract_date, scope_of_work, amount_cents, confidence,
             EXISTS(SELECT 1 FROM line_items WHERE line_items.contract_id = contracts.id) AS has_li
      FROM contracts
      WHERE customer_id = ${customerId} AND workspace_id = ${workspaceId}
      ORDER BY contract_date DESC NULLS LAST, created_at DESC
      LIMIT 1
    ),
    totals AS (
      SELECT SUM(amount_cents)::int AS total
      FROM contracts
      WHERE customer_id = ${customerId} AND workspace_id = ${workspaceId}
    )
    SELECT
      (SELECT id FROM p) AS phone_id,
      (SELECT id FROM e) AS email_id,
      (SELECT id FROM a) AS address_id,
      (SELECT confidence FROM p) AS phone_confidence,
      (SELECT confidence FROM e) AS email_confidence,
      (SELECT confidence FROM a) AS address_confidence,
      (SELECT confidence FROM c) AS contract_confidence,
      (SELECT contract_date::text FROM c) AS latest_contract_date,
      (SELECT scope_of_work IS NOT NULL FROM c) AS has_scope,
      COALESCE((SELECT has_li FROM c), false) AS has_line_item,
      (SELECT id FROM p) IS NOT NULL AS has_phone,
      (SELECT id FROM e) IS NOT NULL AS has_email,
      (SELECT id FROM a) IS NOT NULL AS has_address,
      (SELECT total FROM totals) AS total_contract_cents
  `;

  const health = computeHealthScore({
    hasName: true,
    hasPrimaryPhone: stats.has_phone,
    hasPrimaryEmail: stats.has_email,
    hasPrimaryAddress: stats.has_address,
    hasLastContractDate: stats.latest_contract_date !== null,
    hasScope: stats.has_scope,
    hasLineItem: stats.has_line_item,
  });

  const confidence = computeConfidenceScore({
    customerConfidence,
    primaryPhoneConfidence: stats.phone_confidence,
    primaryEmailConfidence: stats.email_confidence,
    primaryAddressConfidence: stats.address_confidence,
    contractConfidence: stats.contract_confidence,
  });

  await sql`
    UPDATE customers
    SET health_score = ${health},
        confidence_score = ${confidence},
        primary_phone_id = ${stats.phone_id},
        primary_email_id = ${stats.email_id},
        primary_address_id = ${stats.address_id},
        last_contract_date = ${stats.latest_contract_date},
        total_contract_value = ${stats.total_contract_cents},
        updated_at = now()
    WHERE id = ${customerId}
  `;
}
