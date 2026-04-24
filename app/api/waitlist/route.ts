import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Stub for milestone 3. Milestone 5 wires persistence (Drizzle insert into
 * public.waitlist via service-role client) and sends the Brevo transactional
 * confirmation email. Validation here mirrors the client-side schema so the
 * endpoint still rejects malformed submissions cleanly.
 */

const schema = z.object({
  email: z.string().email(),
  company: z.string().max(120).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  approximateCustomerCount: z
    .enum(["<500", "500-2500", "2500-10000", ">10000"])
    .optional()
    .or(z.literal("")),
  source: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
