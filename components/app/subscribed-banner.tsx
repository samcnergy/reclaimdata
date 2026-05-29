"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-dismissing banner shown once when a user lands on /app?subscribed=1
 * after completing the Square checkout. Clears the query param from the URL
 * so a page refresh doesn't repeat it.
 */
export function SubscribedBanner() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // Strip the ?subscribed=1 param from the URL without a navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("subscribed");
    window.history.replaceState(null, "", url.toString());

    // Auto-dismiss after 8 seconds.
    const t = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(t);
  }, [router]);

  if (!visible) return null;

  return (
    <div className="mb-8 flex items-start justify-between gap-4 rounded-xl border border-confidence-high/40 bg-confidence-high/10 px-5 py-4">
      <div>
        <p className="font-medium text-foreground">
          🎉 You&rsquo;re subscribed!
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your workspace is now active. Upload your first documents to start
          building your client list.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
