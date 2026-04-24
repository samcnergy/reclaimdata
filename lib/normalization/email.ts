const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): {
  normalized: string | null;
  isValid: boolean;
} {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return { normalized: null, isValid: false };
  if (!EMAIL_RE.test(trimmed)) return { normalized: null, isValid: false };
  return { normalized: trimmed, isValid: true };
}
