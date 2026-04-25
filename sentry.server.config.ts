import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/security/sentry-scrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  beforeSend(event) {
    return scrubEvent(event);
  },
  ignoreErrors: [
    // Postgres "no rows" we use intentionally for maybeSingle()
    "PGRST116",
  ],
});
