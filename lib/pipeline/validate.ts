/**
 * Stage 4 of the pipeline (per the build spec).
 *
 * For every phone / email / address row in the workspace that hasn't been
 * validated yet, call the matching external validator and write the
 * result back. We intentionally batch *after* customer materialization
 * so the DB is already in a consistent state — if validation bogs down
 * or quotas run out, the customer records are still usable.
 *
 * Failures are logged and treated as "unvalidated" so one flaky row
 * doesn't stall the entire run.
 */

import type postgres from "postgres";

import { validateAddress } from "@/lib/validation/address";
import { validateEmail } from "@/lib/validation/email";
import { validatePhone } from "@/lib/validation/phone";

export type ValidationStats = {
  phonesChecked: number;
  emailsChecked: number;
  addressesChecked: number;
};

export async function validateWorkspace(args: {
  sql: postgres.Sql;
  workspaceId: string;
  // Guard against runaway spend in the free tiers we're on.
  caps?: {
    phones?: number;
    emails?: number;
    addresses?: number;
  };
}): Promise<ValidationStats> {
  const { sql, workspaceId } = args;
  const caps = {
    phones: args.caps?.phones ?? 500,
    emails: args.caps?.emails ?? 500,
    addresses: args.caps?.addresses ?? 500,
  };

  const stats: ValidationStats = {
    phonesChecked: 0,
    emailsChecked: 0,
    addressesChecked: 0,
  };

  const phones = await sql<Array<{ id: string; e164_value: string }>>`
    SELECT id, e164_value FROM phones
    WHERE workspace_id = ${workspaceId}
      AND validation_status = 'unvalidated'
      AND e164_value IS NOT NULL
    LIMIT ${caps.phones}
  `;
  for (const p of phones) {
    const result = await validatePhone(p.e164_value);
    await sql`
      UPDATE phones
      SET validation_status = ${result.status},
          line_type = ${result.lineType},
          carrier = ${result.carrier},
          validation_checked_at = now()
      WHERE id = ${p.id}
    `;
    stats.phonesChecked++;
  }

  const emails = await sql<Array<{ id: string; normalized_value: string }>>`
    SELECT id, normalized_value FROM emails
    WHERE workspace_id = ${workspaceId}
      AND validation_status = 'unvalidated'
      AND normalized_value IS NOT NULL
    LIMIT ${caps.emails}
  `;
  for (const e of emails) {
    const result = await validateEmail(e.normalized_value);
    await sql`
      UPDATE emails
      SET validation_status = ${result.status},
          validation_checked_at = now()
      WHERE id = ${e.id}
    `;
    stats.emailsChecked++;
  }

  const addresses = await sql<
    Array<{
      id: string;
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    }>
  >`
    SELECT id, line1, line2, city, state, postal_code FROM addresses
    WHERE workspace_id = ${workspaceId}
      AND validation_status = 'unvalidated'
      AND (line1 IS NOT NULL OR postal_code IS NOT NULL)
    LIMIT ${caps.addresses}
  `;
  for (const a of addresses) {
    const result = await validateAddress({
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postal_code,
    });
    const s = result.standardized;
    if (s) {
      // USPS wins: when USPS resolved a value, overwrite ours. The model
      // sometimes guesses ("RSM") or omits a field; the USPS canonical
      // form is the source of truth. We only fall back to existing data
      // for fields USPS didn't return.
      await sql`
        UPDATE addresses
        SET validation_status = ${result.status},
            line1 = COALESCE(${s.line1}, line1),
            line2 = COALESCE(${s.line2}, line2),
            city = COALESCE(${s.city}, city),
            state = COALESCE(${s.state}, state),
            postal_code = COALESCE(${s.postalCode}, postal_code),
            validation_checked_at = now()
        WHERE id = ${a.id}
      `;
    } else {
      await sql`
        UPDATE addresses
        SET validation_status = ${result.status},
            validation_checked_at = now()
        WHERE id = ${a.id}
      `;
    }
    stats.addressesChecked++;
  }

  return stats;
}
