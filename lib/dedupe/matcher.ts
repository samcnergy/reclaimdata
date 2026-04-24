/**
 * Dedupe resolution for a single incoming (extracted) customer against
 * the workspace's existing customers.
 *
 * Strategy:
 *   1. Strong signals (E.164 phone match OR exact normalized email match)
 *      → auto-merge into the existing customer (score 100).
 *   2. Fuzzy signal (trigram similarity on name AND address both above
 *      threshold) → write a duplicate_candidates row for user review.
 *   3. Otherwise → create a new customer.
 *
 * Uses pg_trgm for (2) — relies on the 0001 migration.
 */

import type postgres from "postgres";

export type DedupeCandidate = {
  customerId: string;
  score: number; // 0–100
  reason: string;
};

export async function findStrongMatch(args: {
  sql: postgres.Sql;
  workspaceId: string;
  e164Phones: string[];
  normalizedEmails: string[];
}): Promise<DedupeCandidate | null> {
  const { sql, workspaceId, e164Phones, normalizedEmails } = args;

  if (e164Phones.length > 0) {
    const phoneHit = await sql<Array<{ customer_id: string }>>`
      SELECT DISTINCT customer_id
      FROM phones
      WHERE workspace_id = ${workspaceId}
        AND e164_value = ANY(${e164Phones})
      LIMIT 1
    `;
    if (phoneHit.length > 0) {
      return {
        customerId: phoneHit[0].customer_id,
        score: 100,
        reason: "matching phone number (E.164)",
      };
    }
  }

  if (normalizedEmails.length > 0) {
    const emailHit = await sql<Array<{ customer_id: string }>>`
      SELECT DISTINCT customer_id
      FROM emails
      WHERE workspace_id = ${workspaceId}
        AND normalized_value = ANY(${normalizedEmails})
      LIMIT 1
    `;
    if (emailHit.length > 0) {
      return {
        customerId: emailHit[0].customer_id,
        score: 100,
        reason: "matching email address",
      };
    }
  }

  return null;
}

/**
 * Weaker signal: fuzzy trigram match on name AND address. Only fires when
 * we have both to compare — name alone is too noisy.
 */
export async function findFuzzyMatch(args: {
  sql: postgres.Sql;
  workspaceId: string;
  name: string | null;
  addressLine1: string | null;
  city: string | null;
  threshold?: number; // default 0.8
}): Promise<DedupeCandidate | null> {
  const { sql, workspaceId, name, addressLine1, city } = args;
  const threshold = args.threshold ?? 0.8;

  if (!name || !addressLine1) return null;

  const nameCompact = name.toLowerCase();
  const addrCompact = [addressLine1, city ?? ""].filter(Boolean).join(" ").toLowerCase();

  const rows = await sql<
    Array<{ id: string; name_sim: number; addr_sim: number }>
  >`
    SELECT c.id,
           similarity(lower(c.name), ${nameCompact}) AS name_sim,
           similarity(
             lower(COALESCE(a.line1, '') || ' ' || COALESCE(a.city, '')),
             ${addrCompact}
           ) AS addr_sim
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT line1, city FROM addresses
      WHERE customer_id = c.id AND workspace_id = ${workspaceId}
      LIMIT 1
    ) a ON true
    WHERE c.workspace_id = ${workspaceId}
      AND similarity(lower(c.name), ${nameCompact}) > ${threshold}
    ORDER BY similarity(lower(c.name), ${nameCompact}) DESC
    LIMIT 5
  `;

  for (const row of rows) {
    if (row.addr_sim > threshold) {
      const combined = Math.round((row.name_sim * 0.5 + row.addr_sim * 0.5) * 100);
      return {
        customerId: row.id,
        score: combined,
        reason: `fuzzy name+address match (name ${Math.round(row.name_sim * 100)}%, address ${Math.round(row.addr_sim * 100)}%)`,
      };
    }
  }

  return null;
}
