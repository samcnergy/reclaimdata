import type { Metadata } from "next";

import { PageHeader } from "@/components/marketing/page-header";
import { ParentStrip } from "@/components/marketing/parent-strip";
import { PricingCards } from "@/components/marketing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Reclaim Data is $249 per month. One plan, everything included — up to 2,500 customers, unlimited uploads, CSV export, priority processing, and handwritten note support.",
};

const faqs = [
  {
    q: "What happens if I exceed 2,500 customers?",
    a: "We soft-block new additions and email you about it. Your existing data is never deleted or held hostage, and you can export a full ZIP of CSVs at any time. If you need a higher cap, email hello@reclaimdata.ai and we'll work out a custom plan.",
  },
  {
    q: "How do I cancel?",
    a: "One button from Settings → Billing. We don't require a phone call or a reason. Your data stays available for export for 30 days after cancellation.",
  },
  {
    q: "Do you offer a trial?",
    a: "No. We charge for the work from day one because the work is real on day one — we process your documents, validate phones and addresses, and stand up your database. If it isn't worth $249, cancel before your next billing cycle.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="One plan. Everything included."
        lede="$249 per month. No seat games, no usage traps, no upsells. Cancel any time from your account settings."
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
