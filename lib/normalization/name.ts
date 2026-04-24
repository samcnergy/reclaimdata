/**
 * Minimal name parser. We don't need a full PersonName-style library — the
 * only downstream consumer is dedupe (trigram match on the full string)
 * and the occasional UI display of prefix + name. Anything more exotic
 * (e.g. "John & Mary Smith" → two people) is already surfaced by the
 * extractor as separate customer entries.
 */

const PREFIXES = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "mx",
  "dr",
  "prof",
  "fr",
  "sr",
  "rev",
]);

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md", "esq"]);

export type ParsedName = {
  full: string;
  prefix: string | null;
  suffix: string | null;
};

export function normalizeName(raw: string): ParsedName | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;

  let parts = collapsed.split(" ");
  let prefix: string | null = null;
  let suffix: string | null = null;

  if (parts.length > 1) {
    const head = parts[0].replace(/\.$/, "").toLowerCase();
    if (PREFIXES.has(head)) {
      prefix = parts[0].replace(/\.$/, "");
      parts = parts.slice(1);
    }
  }

  if (parts.length > 1) {
    const tail = parts[parts.length - 1].replace(/[.,]$/g, "").toLowerCase();
    if (SUFFIXES.has(tail)) {
      suffix = parts[parts.length - 1].replace(/[.,]$/g, "");
      parts = parts.slice(0, -1);
    }
  }

  const full = parts.join(" ");
  if (!full) return null;

  return { full, prefix, suffix };
}
