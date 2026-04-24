import Link from "next/link";
import { Lock } from "lucide-react";

export function TrustStrip() {
  return (
    <section className="bg-primary py-16 text-primary-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-accent">
          <Lock className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <p className="text-balance font-serif text-2xl leading-snug sm:text-3xl">
          Your data stays yours. We process it on your behalf, we never sell
          it, and we never use it to train AI models.
        </p>
        <Link
          href="/privacy"
          className="text-sm text-primary-foreground/80 underline-offset-4 transition hover:text-primary-foreground hover:underline"
        >
          Read our privacy policy
        </Link>
      </div>
    </section>
  );
}
