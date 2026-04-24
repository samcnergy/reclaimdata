import { Link2 } from "lucide-react";

const fields = [
  "Customer name",
  "Company",
  "Phone numbers",
  "Email addresses",
  "Mailing addresses",
  "Last order date",
  "Scope of work",
  "Products purchased",
  "Contract history",
  "Notes and follow-ups",
];

export function WhatWeExtract() {
  return (
    <section className="bg-card/60 py-24">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-16 px-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            What we extract
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            Every piece of customer data, traceable to the page it came from.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Every field is labeled with a confidence score. Click any value to
            see the exact region of the original document it was extracted
            from — so you can always verify.
          </p>
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-sm text-foreground">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
            <p>
              <strong className="font-semibold">Source linkback:</strong> click
              a phone number, see the contract. Click a name, see the email
              that mentioned it. Nothing is automatic — everything is
              verifiable.
            </p>
          </div>
        </div>
        <div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
            {fields.map((field) => (
              <li
                key={field}
                className="flex items-center gap-2 border-b border-border/60 pb-2 text-sm text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                {field}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
