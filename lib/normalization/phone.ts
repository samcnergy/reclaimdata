import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Best-effort E.164 normalization. Returns the parsed E.164 or null if the
 * raw string can't be resolved to a valid number. We default to US since
 * Reclaim Data v1 is US-only.
 */
export function normalizePhone(
  raw: string,
  defaultCountry: "US" = "US",
): { e164: string | null; isValid: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { e164: null, isValid: false };

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed) return { e164: null, isValid: false };
  return { e164: parsed.number, isValid: parsed.isValid() };
}
