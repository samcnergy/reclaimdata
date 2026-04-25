import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        404
      </p>
      <h1 className="mt-4 max-w-xl font-serif text-5xl font-medium leading-[1.05] text-foreground">
        That page didn't survive the filing cabinet.
      </h1>
      <p className="mt-6 max-w-md text-lg text-muted-foreground">
        We couldn't find what you were looking for. The link may have moved
        or the page may have been deleted.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" variant="accent">
          <Link href="/">Back to the home page</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="mailto:hello@reclaimdata.ai">Tell us what you expected</Link>
        </Button>
      </div>
    </main>
  );
}
