import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Square webhook signature. Square signs requests with HMAC-
 * SHA256 over `notificationUrl + body`. The header is base64-encoded.
 *
 * https://developer.squareup.com/docs/webhooks/step3validate
 */
export function verifySquareSignature(args: {
  signatureHeader: string | null;
  notificationUrl: string;
  bodyText: string;
  signatureKey: string;
}): boolean {
  if (!args.signatureHeader) return false;
  const hmac = createHmac("sha256", args.signatureKey);
  hmac.update(args.notificationUrl + args.bodyText);
  const expected = hmac.digest("base64");

  // Compare in constant time. Lengths must match for timingSafeEqual.
  const a = Buffer.from(args.signatureHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
