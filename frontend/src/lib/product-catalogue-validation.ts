/** Pure helpers for vendor catalogue media / SEO validation (I3). */

const DEFAULT_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "de", "la", "le",
  "les", "un", "une", "des", "du", "et", "ou", "à", "au", "aux", "en", "par", "pour",
  "sur", "dans", "ce", "cette", "ces", "son", "sa", "ses", "est", "are", "is",
]);

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export function imageCount(
  items: { type?: string }[],
  ...more: { type?: string }[][]
): number {
  return [items, ...more]
    .flat()
    .filter((m) => (m.type ?? "image") === "image").length;
}

/** Derive comma-separated SEO keywords from free text (short description). */
export function deriveSeoKeywords(
  text: string,
  options?: { maxKeywords?: number; stopwords?: Set<string> }
): string {
  const maxKeywords = options?.maxKeywords ?? 12;
  const stopwords = options?.stopwords ?? DEFAULT_STOPWORDS;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    const word = raw.replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase();
    if (word.length < 3 || stopwords.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= maxKeywords) break;
  }
  return out.join(", ");
}

export function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}
