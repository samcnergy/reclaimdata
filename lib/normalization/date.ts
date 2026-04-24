/**
 * Narrow date normalizer. The extractor already emits ISO 8601 strings
 * (or null when ambiguous). This module just validates and returns a Date
 * or null — never guesses.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!ISO_DATE_RE.test(trimmed)) return null;
  const d = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return trimmed;
}
