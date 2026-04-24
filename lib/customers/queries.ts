import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CustomerListRow = {
  id: string;
  name: string;
  company_name: string | null;
  health_score: number;
  confidence_score: number;
  last_contract_date: string | null;
  total_contract_value: number | null;
  primary_phone: string | null;
  primary_email: string | null;
  primary_city: string | null;
  primary_state: string | null;
  do_not_contact: boolean;
  updated_at: string;
};

export type CustomerListFilters = {
  q?: string;
  healthMin?: number;
  healthMax?: number;
  needsPhone?: boolean;
  needsEmail?: boolean;
  needsAddress?: boolean;
  inactive12mo?: boolean;
  inactive5y?: boolean;
  doNotContact?: "hide" | "only";
  sort?: "health-asc" | "health-desc" | "name-asc" | "last-contract-desc";
  limit?: number;
  offset?: number;
};

/**
 * List customers for the active workspace. Uses the user-scoped server
 * client so RLS scopes the query. Joins through the primary_* IDs to
 * surface the top-level contact info the table row needs.
 */
export async function listCustomers(
  workspaceId: string,
  filters: CustomerListFilters = {},
): Promise<{ rows: CustomerListRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("customers")
    .select(
      `id, name, company_name, health_score, confidence_score,
       last_contract_date, total_contract_value, do_not_contact, updated_at,
       primary_phone_id, primary_email_id, primary_address_id`,
      { count: "exact" },
    )
    .eq("workspace_id", workspaceId);

  if (filters.q) {
    const q = `%${filters.q}%`;
    query = query.or(`name.ilike.${q},company_name.ilike.${q}`);
  }
  if (filters.healthMin !== undefined) {
    query = query.gte("health_score", filters.healthMin);
  }
  if (filters.healthMax !== undefined) {
    query = query.lte("health_score", filters.healthMax);
  }
  if (filters.needsPhone) query = query.is("primary_phone_id", null);
  if (filters.needsEmail) query = query.is("primary_email_id", null);
  if (filters.needsAddress) query = query.is("primary_address_id", null);
  if (filters.inactive12mo) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    query = query
      .or(
        `last_contract_date.is.null,last_contract_date.lt.${cutoff.toISOString().slice(0, 10)}`,
      );
  }
  if (filters.inactive5y) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 5);
    query = query
      .or(
        `last_contract_date.is.null,last_contract_date.lt.${cutoff.toISOString().slice(0, 10)}`,
      );
  }
  if (filters.doNotContact === "hide") {
    query = query.eq("do_not_contact", false);
  } else if (filters.doNotContact === "only") {
    query = query.eq("do_not_contact", true);
  }

  const sort = filters.sort ?? "health-asc";
  switch (sort) {
    case "health-asc":
      query = query.order("health_score", { ascending: true });
      break;
    case "health-desc":
      query = query.order("health_score", { ascending: false });
      break;
    case "name-asc":
      query = query.order("name", { ascending: true });
      break;
    case "last-contract-desc":
      query = query.order("last_contract_date", { ascending: false, nullsFirst: false });
      break;
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const rawRows = data ?? [];
  const phoneIds = rawRows.map((r) => r.primary_phone_id).filter(Boolean) as string[];
  const emailIds = rawRows.map((r) => r.primary_email_id).filter(Boolean) as string[];
  const addressIds = rawRows.map((r) => r.primary_address_id).filter(Boolean) as string[];

  // Two-pass fetch for primary contact info. We don't have a real FK from
  // customers.primary_*_id back to phones/emails/addresses (would create a
  // circular dependency at insert time), so PostgREST can't follow the
  // relation — fetch separately and stitch in JS.
  const [phonesRes, emailsRes, addressesRes] = await Promise.all([
    phoneIds.length
      ? supabase.from("phones").select("id, e164_value, raw_value").in("id", phoneIds)
      : { data: [] },
    emailIds.length
      ? supabase.from("emails").select("id, normalized_value, raw_value").in("id", emailIds)
      : { data: [] },
    addressIds.length
      ? supabase.from("addresses").select("id, city, state").in("id", addressIds)
      : { data: [] },
  ]);

  const phoneMap = new Map((phonesRes.data ?? []).map((p) => [p.id, p]));
  const emailMap = new Map((emailsRes.data ?? []).map((e) => [e.id, e]));
  const addressMap = new Map((addressesRes.data ?? []).map((a) => [a.id, a]));

  const rows = rawRows.map((d) => {
    const ph = d.primary_phone_id ? phoneMap.get(d.primary_phone_id) : null;
    const em = d.primary_email_id ? emailMap.get(d.primary_email_id) : null;
    const ad = d.primary_address_id ? addressMap.get(d.primary_address_id) : null;
    return {
      id: d.id,
      name: d.name,
      company_name: d.company_name,
      health_score: d.health_score,
      confidence_score: d.confidence_score,
      last_contract_date: d.last_contract_date,
      total_contract_value: d.total_contract_value,
      primary_phone: ph?.e164_value ?? ph?.raw_value ?? null,
      primary_email: em?.normalized_value ?? em?.raw_value ?? null,
      primary_city: ad?.city ?? null,
      primary_state: ad?.state ?? null,
      do_not_contact: d.do_not_contact,
      updated_at: d.updated_at,
    } satisfies CustomerListRow;
  });

  return { rows, total: count ?? rows.length };
}

export type CustomerDetail = {
  id: string;
  name: string;
  name_prefix: string | null;
  name_suffix: string | null;
  company_name: string | null;
  health_score: number;
  confidence_score: number;
  tags: string[];
  do_not_contact: boolean;
  last_contract_date: string | null;
  total_contract_value: number | null;
  primary_phone_id: string | null;
  primary_email_id: string | null;
  primary_address_id: string | null;
  phones: Array<{
    id: string;
    raw_value: string;
    e164_value: string | null;
    line_type: string | null;
    carrier: string | null;
    validation_status: string;
    validation_checked_at: string | null;
    confidence: number;
    source_refs: Array<{ uploadId: string; kind: string; page?: number }>;
  }>;
  emails: Array<{
    id: string;
    raw_value: string;
    normalized_value: string | null;
    validation_status: string;
    validation_checked_at: string | null;
    confidence: number;
    source_refs: Array<{ uploadId: string; kind: string }>;
  }>;
  addresses: Array<{
    id: string;
    raw_value: string;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    validation_status: string;
    validation_checked_at: string | null;
    confidence: number;
    source_refs: Array<{ uploadId: string; kind: string }>;
  }>;
  contracts: Array<{
    id: string;
    contract_date: string | null;
    amount_cents: number | null;
    scope_of_work: string | null;
    confidence: number;
    source_refs: Array<{ uploadId: string; kind: string }>;
    line_items: Array<{
      id: string;
      product_type: string | null;
      size: string | null;
      color: string | null;
      quantity: string | null;
      unit_price_cents: number | null;
    }>;
  }>;
  notes: Array<{
    id: string;
    body: string;
    created_at: string;
    author_email: string;
  }>;
};

export async function getCustomerDetail(
  workspaceId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const supabase = await createSupabaseServerClient();

  const [
    { data: customer },
    { data: phones },
    { data: emails },
    { data: addresses },
    { data: contracts },
    { data: notes },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select(
        `id, name, name_prefix, name_suffix, company_name,
         health_score, confidence_score, tags, do_not_contact,
         last_contract_date, total_contract_value,
         primary_phone_id, primary_email_id, primary_address_id`,
      )
      .eq("id", customerId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("phones")
      .select(
        "id, raw_value, e164_value, line_type, carrier, validation_status, validation_checked_at, confidence, source_refs",
      )
      .eq("customer_id", customerId)
      .order("confidence", { ascending: false }),
    supabase
      .from("emails")
      .select(
        "id, raw_value, normalized_value, validation_status, validation_checked_at, confidence, source_refs",
      )
      .eq("customer_id", customerId)
      .order("confidence", { ascending: false }),
    supabase
      .from("addresses")
      .select(
        "id, raw_value, line1, line2, city, state, postal_code, validation_status, validation_checked_at, confidence, source_refs",
      )
      .eq("customer_id", customerId)
      .order("confidence", { ascending: false }),
    supabase
      .from("contracts")
      .select(
        "id, contract_date, amount_cents, scope_of_work, confidence, source_refs, line_items(id, product_type, size, color, quantity, unit_price_cents)",
      )
      .eq("customer_id", customerId)
      .order("contract_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("notes")
      .select("id, body, created_at, author_id")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) return null;

  const noteRows = notes ?? [];
  const authorIds = Array.from(new Set(noteRows.map((n) => n.author_id).filter(Boolean) as string[]));
  const { data: authors } = authorIds.length
    ? await supabase.from("users").select("id, email").in("id", authorIds)
    : { data: [] };
  const authorEmails = new Map((authors ?? []).map((u) => [u.id, u.email]));

  const normalizedNotes = noteRows.map((n) => ({
    id: n.id,
    body: n.body,
    created_at: n.created_at,
    author_email: authorEmails.get(n.author_id) ?? "",
  }));

  return {
    ...customer,
    tags: customer.tags ?? [],
    phones: (phones ?? []) as CustomerDetail["phones"],
    emails: (emails ?? []) as CustomerDetail["emails"],
    addresses: (addresses ?? []) as CustomerDetail["addresses"],
    contracts: (contracts ?? []) as CustomerDetail["contracts"],
    notes: normalizedNotes,
  } as CustomerDetail;
}
