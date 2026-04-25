/**
 * Creates the 6 subscription plans + variations Reclaim Data uses, via
 * the Square Catalog API. Writes the resulting variation IDs back into
 * ~/reclaimdata-secrets/.env.local so the running app's env can pick
 * them up on next deploy.
 *
 * Why a script: per SETUP_LOG Service 9, the Sandbox Seller Dashboard
 * does not expose Plan IDs in the URL when plans are created via the
 * UI, and the public Catalog API returned empty for those. Programmatic
 * creation is the supported path.
 *
 * Idempotent: if a plan with the same name already exists, we use it.
 *
 * Run:  npx tsx scripts/bootstrap-square-plans.ts
 */

import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { SquareClient, SquareEnvironment } from "square";

config({ path: ".env.local", override: true });

type PlanSpec = {
  envKey: string;
  planName: string;
  variationName: string;
  amountCents: number;
  cadence: "MONTHLY" | "ANNUAL";
};

const SPECS: PlanSpec[] = [
  { envKey: "SQUARE_PLAN_ID_STARTER_MONTHLY", planName: "Starter", variationName: "Starter Monthly", amountCents: 9900, cadence: "MONTHLY" },
  { envKey: "SQUARE_PLAN_ID_PROFESSIONAL_MONTHLY", planName: "Professional", variationName: "Professional Monthly", amountCents: 24900, cadence: "MONTHLY" },
  { envKey: "SQUARE_PLAN_ID_LEGACY_MONTHLY", planName: "Legacy", variationName: "Legacy Monthly", amountCents: 49900, cadence: "MONTHLY" },
  { envKey: "SQUARE_PLAN_ID_STARTER_ANNUAL", planName: "Starter", variationName: "Starter Annual", amountCents: 99000, cadence: "ANNUAL" },
  { envKey: "SQUARE_PLAN_ID_PROFESSIONAL_ANNUAL", planName: "Professional", variationName: "Professional Annual", amountCents: 249000, cadence: "ANNUAL" },
  { envKey: "SQUARE_PLAN_ID_LEGACY_ANNUAL", planName: "Legacy", variationName: "Legacy Annual", amountCents: 499000, cadence: "ANNUAL" },
];

async function main() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not set");

  const env =
    process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;

  const client = new SquareClient({ token, environment: env });

  const created: Record<string, string> = {};

  for (const spec of SPECS) {
    const planId = await ensurePlan(client, spec.planName);
    const variationId = await ensureVariation(client, {
      planId,
      name: spec.variationName,
      amountCents: spec.amountCents,
      cadence: spec.cadence,
    });
    created[spec.envKey] = variationId;
    console.log(`  ${spec.envKey} = ${variationId}`);
  }

  // Write back to ~/reclaimdata-secrets/.env.local so the values land in
  // the canonical ledger; the user pastes them into Render manually.
  const ledgerPath = join(homedir(), "reclaimdata-secrets", ".env.local");
  if (existsSync(ledgerPath)) {
    let text = readFileSync(ledgerPath, "utf8");
    for (const [key, val] of Object.entries(created)) {
      const re = new RegExp(`^${key}=.*$`, "m");
      if (re.test(text)) {
        text = text.replace(re, `${key}=${val}`);
      } else {
        text += `\n${key}=${val}`;
      }
    }
    writeFileSync(ledgerPath, text);
    console.log(`\nUpdated ${ledgerPath}`);
  } else {
    console.log(`\nLedger not found at ${ledgerPath} — print the IDs above and paste them yourself.`);
  }

  console.log(
    "\nNext: paste the same values into Render's Environment tab on the production service.",
  );
}

async function ensurePlan(client: SquareClient, name: string): Promise<string> {
  // List existing subscription plans by listing catalog and filtering.
  const list = await client.catalog.list({ types: "SUBSCRIPTION_PLAN" });
  const existing: { id?: string; subscriptionPlanData?: { name?: string } } | undefined = list.data?.find(
    (o) =>
      o.type === "SUBSCRIPTION_PLAN" &&
      (o as { subscriptionPlanData?: { name?: string } }).subscriptionPlanData?.name === name,
  ) as { id?: string; subscriptionPlanData?: { name?: string } } | undefined;
  if (existing?.id) return existing.id;

  const { catalogObject } = await client.catalog.object.upsert({
    idempotencyKey: randomUUID(),
    object: {
      type: "SUBSCRIPTION_PLAN",
      id: `#${name.toLowerCase()}_plan`,
      subscriptionPlanData: { name },
    },
  });
  if (!catalogObject?.id) throw new Error(`Plan create failed for ${name}`);
  return catalogObject.id;
}

async function ensureVariation(
  client: SquareClient,
  args: { planId: string; name: string; amountCents: number; cadence: "MONTHLY" | "ANNUAL" },
): Promise<string> {
  const list = await client.catalog.list({ types: "SUBSCRIPTION_PLAN_VARIATION" });
  const existing: { id?: string; subscriptionPlanVariationData?: { name?: string } } | undefined = list.data?.find(
    (o) =>
      o.type === "SUBSCRIPTION_PLAN_VARIATION" &&
      (o as { subscriptionPlanVariationData?: { name?: string } }).subscriptionPlanVariationData?.name === args.name,
  ) as { id?: string; subscriptionPlanVariationData?: { name?: string } } | undefined;
  if (existing?.id) return existing.id;

  // Square's catalog cadence enum literally accepts "MONTHLY" / "ANNUAL"
  // (and many others). Pass through unchanged.
  const cadence = args.cadence;

  const { catalogObject } = await client.catalog.object.upsert({
    idempotencyKey: randomUUID(),
    object: {
      type: "SUBSCRIPTION_PLAN_VARIATION",
      id: `#${args.name.toLowerCase().replace(/\s+/g, "_")}_variation`,
      subscriptionPlanVariationData: {
        name: args.name,
        phases: [
          {
            ordinal: 0n,
            cadence,
            pricing: {
              type: "STATIC",
              priceMoney: {
                amount: BigInt(args.amountCents),
                currency: "USD",
              },
            },
          },
        ],
        subscriptionPlanId: args.planId,
      },
    },
  });
  if (!catalogObject?.id) throw new Error(`Variation create failed for ${args.name}`);
  return catalogObject.id;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
