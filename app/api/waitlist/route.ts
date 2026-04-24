import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";
import { sendWaitlistConfirmation } from "@/lib/brevo/transactional";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// 5 submissions per IP per minute — generous for normal humans, deters
// trivial flood attempts. Upgrade to a distributed limiter if we scale
// past one Render instance.
const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

const schema = z.object({
  email: z.string().email().max(254),
  company: z.string().max(120).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  approximateCustomerCount: z
    .enum(["<500", "500-2500", "2500-10000", ">10000"])
    .optional()
    .or(z.literal("")),
  source: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit(
    `waitlist:${clientIp(request)}`,
    RATE_LIMIT.limit,
    RATE_LIMIT.windowMs,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      {
        status: 429,
        headers: {
          "retry-after": Math.ceil((limit.resetAt - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, company, industry, approximateCustomerCount, source } =
    parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Insert, ignore duplicate-email conflict. `returning()` on conflict-do-
  // nothing returns an empty array, which is how we know this was a repeat
  // and therefore shouldn't trigger another confirmation send.
  const inserted = await db
    .insert(waitlist)
    .values({
      email: normalizedEmail,
      company: company || null,
      industry: industry || null,
      approximateCustomerCount: approximateCustomerCount || null,
      source: source ?? null,
    })
    .onConflictDoNothing({ target: waitlist.email })
    .returning({ id: waitlist.id });

  const isNew = inserted.length > 0;

  if (isNew) {
    try {
      await sendWaitlistConfirmation({ to: { email: normalizedEmail } });
    } catch (err) {
      // Don't fail the request if email delivery hiccups — the entry is
      // persisted and we can resend later.
      console.error(
        "[waitlist] Brevo send failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json({ ok: true, alreadyOnList: !isNew }, { status: 202 });
}
