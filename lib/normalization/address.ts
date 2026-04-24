/**
 * Light address normalization. Full USPS validation + standardization
 * lives in milestone 11 (lib/validation/address.ts). Here we just trim,
 * uppercase the state, and reshape components if the extractor already
 * parsed them.
 */

const STATE_RE = /^[A-Za-z]{2}$/;

export type NormalizedAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
};

export function normalizeAddress(parts: {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}): NormalizedAddress {
  const trim = (s: string | null): string | null => {
    if (!s) return null;
    const t = s.trim();
    return t.length > 0 ? t : null;
  };

  const state = trim(parts.state);
  const country = (trim(parts.country) ?? "US").toUpperCase();

  return {
    line1: trim(parts.line1),
    line2: trim(parts.line2),
    city: trim(parts.city),
    state: state && STATE_RE.test(state) ? state.toUpperCase() : state,
    postalCode: trim(parts.postalCode),
    country,
  };
}
