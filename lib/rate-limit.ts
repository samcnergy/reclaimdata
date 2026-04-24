/**
 * Very small fixed-window rate limiter keyed by arbitrary string (typically
 * an IP address). In-memory — fine for a single Render instance; swap to
 * Redis / Upstash if we scale horizontally.
 *
 * Behaviour:
 *   - First hit: creates a window and allows the request.
 *   - Subsequent hits within the window: increment, allow until `limit`,
 *     then deny.
 *   - Old entries are lazily reaped when we encounter them.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * Best-effort client IP extraction for a Next.js Request. Trusts
 * `x-forwarded-for` first hop (Render sets this); falls back to
 * `x-real-ip`, then a constant so we still rate-limit something.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anonymous";
}
