import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/security/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,
  enabled:
    !!(process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN) &&
    process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    return scrubEvent(event);
  },
});
