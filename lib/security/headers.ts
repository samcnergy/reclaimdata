/**
 * Security headers applied to every response by proxy.ts.
 *
 * The CSP is intentionally tight:
 *   - default-src 'self'
 *   - script-src 'self' + Square Web Payments + posthog (when set)
 *   - connect-src 'self' + Supabase + Anthropic + ZeroBounce + Twilio +
 *     PostHog + Sentry
 *   - img-src 'self' data: + Supabase Storage signed URLs
 *
 * Tailwind v4 emits no inline <style> blocks at build time, but Next's
 * dev mode does inject inline scripts for HMR — we keep 'unsafe-inline'
 * for style-src and add 'nonce'-friendly script-src once we have a real
 * nonce middleware. For M16 we ship the strict prod CSP and relax just
 * enough so the dev server still works.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

const isDev = process.env.NODE_ENV !== "production";

export function buildCspHeader(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'", // Next inline boot script
      ...(isDev ? ["'unsafe-eval'"] : []),
      "https://js.squareup.com",
      "https://js.squareupsandbox.com",
      posthogHost,
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabaseUrl],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      supabaseUrl,
      "wss://*.supabase.co",
      "https://api.anthropic.com",
      "https://api.zerobounce.net",
      "https://lookups.twilio.com",
      "https://apis.usps.com",
      "https://api.brevo.com",
      "https://oauth2.googleapis.com",
      "https://accounts.google.com",
      "https://gmail.googleapis.com",
      "https://connect.squareup.com",
      "https://connect.squareupsandbox.com",
      posthogHost,
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
    ],
    "frame-src": ["'self'", "https://accounts.google.com", "https://js.squareup.com", "https://js.squareupsandbox.com"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://accounts.google.com"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([k, v]) => (v.length === 0 ? k : `${k} ${v.join(" ")}`))
    .join("; ");
}

export function applySecurityHeaders(headers: Headers): void {
  headers.set("content-security-policy", buildCspHeader());
  headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
}
