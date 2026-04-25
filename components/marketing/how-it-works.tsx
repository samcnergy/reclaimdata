const steps = [
  {
    n: "01",
    title: "Log in",
    body: "Sign up with your email. No credit card for the free tier.",
  },
  {
    n: "02",
    title: "Upload your files",
    body: "Drag in contracts, invoices, scanned PDFs, Word docs, spreadsheets, and phone photos.",
  },
  {
    n: "03",
    title: "Build your client list",
    body: "We read each document, extract customers, normalize phones and addresses, and flag likely duplicates.",
  },
  {
    n: "04",
    title: "Review and confirm",
    body: "Every field links back to the original document. Edit inline. Nothing is hidden, nothing is automatic.",
  },
  {
    n: "05",
    title: "Audit for gaps",
    body: "See who's missing a phone, who hasn't ordered in five years, who's worth re-engaging.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            How it works
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            Five steps from filing cabinet to clean database.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            No training, no setup, no consultants. Upload, review, confirm —
            that's the whole thing.
          </p>
        </div>
        <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step) => (
            <li key={step.n} className="bg-card p-6">
              <p className="font-serif text-3xl text-accent">{step.n}</p>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
