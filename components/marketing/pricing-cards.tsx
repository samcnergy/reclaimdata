import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: "$99",
    cadence: "per month",
    tagline: "For a single owner with a couple decades of records.",
    features: [
      "Up to 2,500 customers",
      "Unlimited uploads",
      "CSV export",
      "1 user",
    ],
  },
  {
    name: "Professional",
    price: "$249",
    cadence: "per month",
    tagline: "For growing shops with a small team.",
    featured: true,
    features: [
      "Up to 15,000 customers",
      "Unlimited uploads",
      "5 users",
      "Priority processing",
    ],
  },
  {
    name: "Legacy",
    price: "$499",
    cadence: "per month",
    tagline: "For long-running businesses with deep archives.",
    features: [
      "Up to 50,000 customers",
      "Unlimited users",
      "Handwritten note support",
    ],
  },
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
            Try it free with up to 100 customers. Upgrade when it pays for
            itself — most do within a week.
          </p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-8 shadow-sm",
                plan.featured
                  ? "border-accent shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.4)]"
                  : "border-border",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-8 inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                  Most popular
                </span>
              )}
              <h3 className="font-serif text-2xl text-foreground">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-serif text-4xl text-foreground">
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.cadence}
                </span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-foreground">
                {plan.features.map((feature) => (
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
              <Button
                asChild
                size="lg"
                variant={plan.featured ? "accent" : "outline"}
                className="mt-2 w-full"
              >
                <Link href="#waitlist">Join the waitlist</Link>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Free tier available — try it with up to 100 customers. Annual plans
          save two months.
        </p>
      </div>
    </section>
  );
}
