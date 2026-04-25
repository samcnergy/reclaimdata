type Event = {
  message?: string | undefined;
  request?: { url?: string; headers?: unknown; data?: unknown } | undefined;
  extra?: Record<string, unknown> | undefined;
  contexts?: Record<string, unknown> | undefined;
  breadcrumbs?: Array<{ message?: string | undefined; data?: unknown } & Record<string, unknown>> | undefined;
  user?: { id?: string | number; email?: string; ip_address?: string } | undefined;
  type?: string | undefined;
};

/**
 * Strip likely-PII from Sentry events before they leave the process.
 *
 * The product handles small businesses' customer records — phones,
 * emails, addresses, contract notes — and we promised not to leak it.
 * This is belt-and-suspenders: the application code is supposed to log
 * IDs, not values, but if a stack trace catches a bare `customer.email`
 * in a breadcrumb we'd rather scrub than ship.
 */

const PII_PATTERNS: Array<{ name: string; re: RegExp; mask: string }> = [
  {
    name: "email",
    re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    mask: "[email]",
  },
  {
    name: "phone-e164",
    re: /\+?\d{10,15}/g,
    mask: "[phone]",
  },
  {
    name: "phone-formatted",
    re: /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
    mask: "[phone]",
  },
  {
    name: "ssn",
    re: /\b\d{3}-\d{2}-\d{4}\b/g,
    mask: "[ssn]",
  },
];

const SENSITIVE_KEYS = new Set([
  "email",
  "raw_value",
  "normalized_value",
  "e164_value",
  "line1",
  "line2",
  "city",
  "state",
  "postal_code",
  "address",
  "phone",
  "name",
  "full_name",
  "company_name",
  "scope_of_work",
  "body",
  "access_token",
  "refresh_token",
  "encrypted_access_token",
  "encrypted_refresh_token",
]);

function scrubString(value: string): string {
  let result = value;
  for (const p of PII_PATTERNS) {
    result = result.replace(p.re, p.mask);
  }
  return result;
}

function deepScrub(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(deepScrub);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[redacted]";
      } else {
        out[k] = deepScrub(v);
      }
    }
    return out;
  }
  return value;
}

export function scrubEvent<T>(input: T): T {
  const event = input as unknown as Event;
  if (event.message) event.message = scrubString(event.message);

  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubString(event.request.url);
    }
    if (event.request.headers) {
      const h = event.request.headers as Record<string, string>;
      for (const k of Object.keys(h)) {
        if (k.toLowerCase() === "cookie" || k.toLowerCase() === "authorization") {
          h[k] = "[redacted]";
        }
      }
    }
    if (event.request.data) {
      event.request.data = deepScrub(event.request.data) as typeof event.request.data;
    }
  }

  if (event.extra) event.extra = deepScrub(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = deepScrub(event.contexts) as typeof event.contexts;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrubString(b.message) : b.message,
      data: deepScrub(b.data) as typeof b.data,
    }));
  }

  // Drop user identity except a stable hash if present.
  if (event.user) {
    const id = event.user.id;
    event.user = id !== undefined ? { id } : undefined;
  }

  return input;
}
