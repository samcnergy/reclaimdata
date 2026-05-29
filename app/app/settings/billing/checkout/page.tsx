import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getActiveWorkspaceContext } from "@/lib/workspaces/active";
import { CheckoutForm } from "@/components/app/checkout-form";

export const metadata: Metadata = { title: "Subscribe" };

export default async function CheckoutPage() {
  const ctx = await getActiveWorkspaceContext();

  // Already subscribed — send straight to the app.
  if (ctx.workspace.plan !== "free") {
    redirect("/app");
  }

  const planVariationId = process.env.SQUARE_PLAN_ID_PROFESSIONAL_MONTHLY;
  if (!planVariationId) {
    // Square not configured yet — fall back to billing settings page
    redirect("/app/settings/billing");
  }

  // These are NEXT_PUBLIC_* so they reach the client bundle safely.
  const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? "";
  const squareLocationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";
  const squareEnv =
    process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

  return (
    <div className="mx-auto w-full max-w-lg px-8 py-16 space-y-8">
      <header>
        <Link
          href="/app/settings/billing"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Billing
        </Link>
        <h1 className="mt-3 font-serif text-4xl font-medium text-foreground">
          Subscribe
        </h1>
        <p className="mt-2 text-muted-foreground">
          Reclaim Data — $249 / month. Cancel any time.
        </p>
      </header>

      <CheckoutForm
        workspaceId={ctx.workspace.id}
        planVariationId={planVariationId}
        squareAppId={squareAppId}
        squareLocationId={squareLocationId}
        squareEnv={squareEnv as "sandbox" | "production"}
      />
    </div>
  );
}
