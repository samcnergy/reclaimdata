import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/marketing/page-header";
import { ParentStrip } from "@/components/marketing/parent-strip";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Reclaim Data turns paper contracts, scanned PDFs, Word docs, spreadsheets, and phone photos into a clean, validated customer database.",
};

const steps = [
  {
    n: "01",
    title: "Log in",
    body: "Email + password or a magic link. No credit card on the free tier.",
    detail:
      "Your workspace is yours. Invite teammates later with owner, admin, or member roles.",
  },
  {
    n: "02",
    title: "Upload your files",
    body: "Drag in contracts, invoices, scanned PDFs, Word docs, spreadsheets, and phone photos. Up to 100 MB per file.",
    detail:
      "We turn physical records into structured customer data. Files are processed in your private workspace — never shared, never used to train AI models.",
  },
  {
    n: "03",
    title: "Build your client list",
    body: "Click 'Build my client list.' We classify each document, run OCR on scans, and extract structured customer data with a confidence score on every field.",
    detail:
      "Low-quality scans fall back to Google Document AI automatically. Phones are validated against Twilio Lookup, emails against ZeroBounce, addresses against USPS. Duplicates surface for your review.",
  },
  {
    n: "04",
    title: "Review and confirm",
    body: "Every field links back to the exact region of the original document. Edit inline. Merge duplicates. Mark records 'do not contact.'",
    detail:
      "Nothing is hidden behind an 'advanced' toggle — the default view is the honest view. Low-confidence fields are flagged visually and never pretend to know what they don't.",
  },
  {
    n: "05",
    title: "Audit for gaps",
    body: "Run a data completeness audit. See what's missing, what's invalid, who hasn't been touched in 12 months, and who hasn't been touched in 5 years.",
    detail:
      "The reactivation dashboard is the money section — it tells you exactly which old customers are worth a phone call, not a mass email.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="From filing cabinet to clean database in an afternoon."
        lede="Reclaim Data is a self-service tool. You upload, we extract, you review. No consultants, no setup fees, no training. The whole thing is five steps."
      />
      <section className="mx-auto w-full max-w-4xl px-6 py-20">
        <ol className="space-y-16">
          {steps.map((step) => (
            <li
              key={step.n}
              className="grid gap-8 border-t border-border/60 pt-12 first:border-0 first:pt-0 sm:grid-cols-[auto_1fr] sm:gap-12"
            >
              <div className="font-serif text-5xl leading-none text-accent sm:text-6xl">
                {step.n}
              </div>
              <div>
                <h2 className="font-serif text-3xl leading-tight text-foreground">
                  {step.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-foreground">
                  {step.body}
                </p>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-20 flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-10 text-center">
          <h3 className="font-serif text-3xl text-foreground">
            Ready to reclaim yours?
          </h3>
          <p className="max-w-lg text-muted-foreground">
            We onboard businesses in small cohorts. Leave your email and we'll
            reach out when your slot opens.
          </p>
          <Button asChild size="lg" variant="accent">
            <Link href="/#waitlist">Join the waitlist</Link>
          </Button>
        </div>
      </section>
      <ParentStrip />
    </>
  );
}
