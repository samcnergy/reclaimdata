/**
 * Plan definitions and per-workspace limits.
 *
 * Limit enforcement happens at the application layer
 * (lib/billing/enforce.ts). The DB does not encode these limits — we
 * want soft-warn UX rather than hard rejects, and the limits change
 * with marketing decisions.
 */

export type Plan = "free" | "starter" | "professional" | "legacy";
export type Cadence = "monthly" | "annual";

type PlanRules = {
  customers: number;
  uploads: number; // 0 = unlimited
  users: number; // 0 = unlimited
  csvExport: boolean;
  priorityProcessing: boolean;
  handwrittenNoteSupport: boolean;
};

export const PLANS: Record<Plan, PlanRules> = {
  free: {
    customers: 100,
    uploads: 50,
    users: 1,
    csvExport: false,
    priorityProcessing: false,
    handwrittenNoteSupport: false,
  },
  starter: {
    customers: 2_500,
    uploads: 0,
    users: 1,
    csvExport: true,
    priorityProcessing: false,
    handwrittenNoteSupport: false,
  },
  professional: {
    // Single live plan: matches the marketing copy and the in-app billing
    // page ("$249/mo, up to 2,500 customers, 1 user, unlimited uploads,
    // CSV export, priority processing, handwritten note support").
    customers: 2_500,
    uploads: 0,
    users: 1,
    csvExport: true,
    priorityProcessing: true,
    handwrittenNoteSupport: true,
  },
  legacy: {
    customers: 50_000,
    uploads: 0,
    users: 0,
    csvExport: true,
    priorityProcessing: true,
    handwrittenNoteSupport: true,
  },
};

/** Maps a Square plan ID (env var) back to the canonical (plan, cadence). */
export function lookupPlanByVariationId(
  variationId: string,
): { plan: Plan; cadence: Cadence } | null {
  const map: Record<string, { plan: Plan; cadence: Cadence }> = {
    [process.env.SQUARE_PLAN_ID_STARTER_MONTHLY ?? ""]: { plan: "starter", cadence: "monthly" },
    [process.env.SQUARE_PLAN_ID_PROFESSIONAL_MONTHLY ?? ""]: { plan: "professional", cadence: "monthly" },
    [process.env.SQUARE_PLAN_ID_LEGACY_MONTHLY ?? ""]: { plan: "legacy", cadence: "monthly" },
    [process.env.SQUARE_PLAN_ID_STARTER_ANNUAL ?? ""]: { plan: "starter", cadence: "annual" },
    [process.env.SQUARE_PLAN_ID_PROFESSIONAL_ANNUAL ?? ""]: { plan: "professional", cadence: "annual" },
    [process.env.SQUARE_PLAN_ID_LEGACY_ANNUAL ?? ""]: { plan: "legacy", cadence: "annual" },
  };
  delete map[""]; // empty/unset env vars
  return map[variationId] ?? null;
}

// Marketing-visible plan: only `professional` is sold. `free` / `starter` /
// `legacy` remain in the type for DB-enum compatibility with existing rows,
// but they should never be assigned to new workspaces. A workspace stuck on
// `free` is treated as "not yet subscribed" — see /app/settings/billing.
export const PLAN_DISPLAY: Record<Plan, { name: string; tagline: string }> = {
  free: { name: "No plan", tagline: "Subscribe to activate your workspace." },
  starter: { name: "Reclaim Data", tagline: "$249 / month" },
  professional: { name: "Reclaim Data", tagline: "$249 / month" },
  legacy: { name: "Reclaim Data", tagline: "$249 / month" },
};
