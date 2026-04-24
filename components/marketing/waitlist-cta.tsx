import { WaitlistForm } from "./waitlist-form";

export function WaitlistCta() {
  return (
    <section id="waitlist" className="py-24">
      <div className="mx-auto grid w-full max-w-5xl items-start gap-12 px-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Join the waitlist
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            We're onboarding businesses in small cohorts.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Reclaim Data processes sensitive customer records. We open access
            to a handful of teams at a time so every onboarding gets real
            attention. Leave your email and we'll be in touch.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li>· No credit card required</li>
            <li>· Free tier up to 100 customers</li>
            <li>· You can cancel anytime, and export your data in one click</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
