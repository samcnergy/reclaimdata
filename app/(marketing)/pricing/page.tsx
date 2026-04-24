import type { Metadata } from "next";

import { PageHeader } from "@/components/marketing/page-header";
import { ParentStrip } from "@/components/marketing/parent-strip";
import { PricingCards } from "@/components/marketing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple monthly pricing for Reclaim Data. Starter $99, Professional $249, Legacy $499. Free tier available.",
};

const faqs = [
  {
    q: "Is there a free tier?",
    a: "Yes. Up to 100 customers, 50 uploads. CSV export is gated behind a paid plan. You can keep using the free tier indefinitely — no trial clock.",
  },
  {
    q: "Can I switch plans mid-month?",
    a: "Yes. Upgrades take effect immediately and are prorated. Downgrades apply at the end of your current billing cycle so you don't lose the time you already paid for.",
  },
  {
    q: "What happens if I exceed my customer limit?",
    a: "We soft-block new additions and prompt you to upgrade. Your existing data is never deleted or held hostage. You can also export a full ZIP of CSVs at any time.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes — annual plans save two months (about 17%). They're available on any paid tier.",
  },
  {
    q: "How do I cancel?",
    a: "One button from Settings → Billing. We don't require a phone call or a reason. Your data stays available for export for 30 days after cancellation.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Plain pricing. No seat games. No usage traps."
        lede="Pick the tier that fits your customer count. Upgrade when it pays for itself — most do within a week."
      />
      <PricingCards />
      <section className="mx-auto w-full max-w-3xl px-6 pb-24">
        <h2 className="font-serif text-3xl text-foreground">Common questions</h2>
        <dl className="mt-8 divide-y divide-border">
          {faqs.map((faq) => (
            <div key={faq.q} className="py-6">
              <dt className="font-semibold text-foreground">{faq.q}</dt>
              <dd className="mt-2 text-muted-foreground">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <ParentStrip />
    </>
  );
}
