"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.24em] text-destructive">
        Something went wrong
      </p>
      <h1 className="mt-4 max-w-xl font-serif text-5xl font-medium leading-[1.05] text-foreground">
        We hit an unexpected error.
      </h1>
      <p className="mt-6 max-w-md text-lg text-muted-foreground">
        We've logged it and we're looking into it. Try reloading the page —
        if it keeps happening, let us know.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-muted-foreground">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} size="lg" variant="accent">
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Back to the home page</Link>
        </Button>
      </div>
    </main>
  );
}
