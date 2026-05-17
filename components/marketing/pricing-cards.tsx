import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  "Up to 2,500 customers",
  "1 user",
  "Unlimited uploads",
  "CSV export",
  "Priority processing",
  "Handwritten note support",
];

export function PricingCards() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Pricing
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            Straightforward pricing. No seat games.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            One plan. Everything you need to digitize your back office and turn
            decades of records into a database you can use.
          </p>
        </div>
        <div className="mt-14 flex justify-center">
          <div className="relative flex w-full max-w-md flex-col rounded-xl border border-accent bg-card p-8 shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.4)]">
            <h3 className="font-serif text-2xl text-foreground">Reclaim Data</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything in one plan. No upsells, no add-ons.
            </p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-serif text-4xl text-foreground">$249</span>
              <span className="text-sm text-muted-foreground">per month</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-foreground">
              {features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-confidence-high"
                    strokeWidth={2.25}
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex-1" />
            <Button asChild size="lg" variant="accent" className="mt-2 w-full">
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
