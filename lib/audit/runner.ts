/**
 * Compute the workspace audit and persist a row in `audits`.
 * One SQL query per metric — keeps the logic readable and lets Postgres
 * use the per-workspace indexes already in place.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditReport = {
  id: string;
  totalCustomers: number;
  completeCustomers: number;
  missingPhone: number;
  missingEmail: number;
  missingAddress: number;
  invalidPhones: number;
  invalidEmails: number;
  invalidAddresses: number;
  duplicatesDetected: number;
  inactiveOver12Months: number;
  inactiveOver5Years: number;
  reactivationCandidates: {
    over12Months: number;
    over5Years: number;
  };
  runAt: string;
  runBy: string | null;
};

export async function runAudit(args: {
  workspaceId: string;
  runBy: string | null;
}): Promise<AuditReport> {
  const admin = createSupabaseAdminClient();

  const sinceDays = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  const cutoff12mo = sinceDays(365);
  const cutoff5y = sinceDays(365 * 5);

  const [
    totalRes,
    completeRes,
    missingPhoneRes,
    missingEmailRes,
    missingAddressRes,
    invalidPhoneRes,
    invalidEmailRes,
    invalidAddressRes,
    duplicateRes,
    inactive12moRes,
    inactive5yRes,
  ] = await Promise.all([
    admin.from("customers").select("id", { count: "exact", head: true }).eq("workspace_id", args.workspaceId),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .not("primary_phone_id", "is", null)
      .not("primary_email_id", "is", null)
      .not("primary_address_id", "is", null),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .is("primary_phone_id", null),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .is("primary_email_id", null),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .is("primary_address_id", null),
    admin
      .from("phones")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .in("validation_status", ["invalid", "disconnected"]),
    admin
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .in("validation_status", ["invalid", "disposable"]),
    admin
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .in("validation_status", ["invalid", "vacant"]),
    admin
      .from("duplicate_candidates")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .eq("status", "pending"),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .or(`last_contract_date.is.null,last_contract_date.lt.${cutoff12mo.slice(0, 10)}`),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", args.workspaceId)
      .or(`last_contract_date.is.null,last_contract_date.lt.${cutoff5y.slice(0, 10)}`),
  ]);

  const total = totalRes.count ?? 0;
  const complete = completeRes.count ?? 0;
  const inactive12mo = inactive12moRes.count ?? 0;
  const inactive5y = inactive5yRes.count ?? 0;

  const reactivationCandidates = {
    over12Months: Math.max(0, inactive12mo - inactive5y),
    over5Years: inactive5y,
  };

  const report = {
    totalCustomers: total,
    completeCustomers: complete,
    missingPhone: missingPhoneRes.count ?? 0,
    missingEmail: missingEmailRes.count ?? 0,
    missingAddress: missingAddressRes.count ?? 0,
    invalidPhones: invalidPhoneRes.count ?? 0,
    invalidEmails: invalidEmailRes.count ?? 0,
    invalidAddresses: invalidAddressRes.count ?? 0,
    duplicatesDetected: duplicateRes.count ?? 0,
    inactiveOver12Months: inactive12mo,
    inactiveOver5Years: inactive5y,
    reactivationCandidates,
  };

  const { data: inserted, error } = await admin
    .from("audits")
    .insert({
      workspace_id: args.workspaceId,
      total_customers: report.totalCustomers,
      complete_customers: report.completeCustomers,
      missing_phone: report.missingPhone,
      missing_email: report.missingEmail,
      missing_address: report.missingAddress,
      invalid_phones: report.invalidPhones,
      invalid_emails: report.invalidEmails,
      invalid_addresses: report.invalidAddresses,
      duplicates_detected: report.duplicatesDetected,
      inactive_over_12_months: report.inactiveOver12Months,
      inactive_over_5_years: report.inactiveOver5Years,
      report_json: report,
      run_by: args.runBy,
    })
    .select("id, run_at")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to persist audit: ${error?.message}`);
  }

  return {
    id: inserted.id,
    runAt: inserted.run_at,
    runBy: args.runBy,
    ...report,
  };
}
