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

/** Count still photos only (exclude video URLs). */
export function countProductPhotoUrls(
  urls: Array<string | null | undefined>
): number {
  return urls.filter((u) => !!u && !isVideoMediaUrl(u)).length;
}

/** Default product photo ceiling (cover + gallery). Videos excluded by callers. */
export const MAX_PRODUCT_PHOTOS = 5;
/** Minimum photos to submit / keep publish-quality listing. */
export const MIN_PRODUCT_PHOTOS_FOR_SUBMIT = 1;

export type PhotoQuotaResult =
  | { ok: true }
  | { ok: false; reason: "too_few" | "too_many"; count: number; min: number; max: number };

/**
 * Validate product photo count (images only). Ceiling is a hard max, not a target.
 */
export function validatePhotoQuota(
  count: number,
  options?: { min?: number; max?: number }
): PhotoQuotaResult {
  const min = options?.min ?? MIN_PRODUCT_PHOTOS_FOR_SUBMIT;
  const max = options?.max ?? MAX_PRODUCT_PHOTOS;
  if (count < min) {
    return { ok: false, reason: "too_few", count, min, max };
  }
  if (count > max) {
    return { ok: false, reason: "too_many", count, min, max };
  }
  return { ok: true };
}

export function photoQuotaMessageFr(result: Exclude<PhotoQuotaResult, { ok: true }>): string {
  if (result.reason === "too_few") {
    return "Ajoutez au moins une photo pour continuer.";
  }
  return `Vous pouvez ajouter jusqu’à ${result.max} photos par article.`;
}

/** Soft SEO coverage hints for vendor publish UI (non-blocking). */
export type ProductSeoCoverage = {
  hasMetaTitle: boolean;
  hasMetaDescription: boolean;
  hasSeoKeywords: boolean;
  shortDescriptionOk: boolean;
  score: number;
  maxScore: number;
  warningsFr: string[];
};

export function assessProductSeoCoverage(input: {
  metaTitle?: string | null;
  metaDescription?: string | null;
  seoKeywords?: string | null;
  shortDescription?: string | null;
  minShortWords?: number;
}): ProductSeoCoverage {
  const minShortWords = input.minShortWords ?? 15;
  const hasMetaTitle = !!String(input.metaTitle || "").trim();
  const hasMetaDescription = String(input.metaDescription || "").trim().length >= 50;
  const hasSeoKeywords = !!String(input.seoKeywords || "").trim();
  const shortDescriptionOk = countWords(String(input.shortDescription || "")) >= minShortWords;
  const flags = [hasMetaTitle, hasMetaDescription, hasSeoKeywords, shortDescriptionOk];
  const score = flags.filter(Boolean).length;
  const warningsFr: string[] = [];
  if (!hasMetaTitle) {
    warningsFr.push("Titre SEO vide — Google utilisera le nom du produit.");
  }
  if (!hasMetaDescription) {
    warningsFr.push("Meta description courte ou vide (visez ~120–160 caractères).");
  }
  if (!hasSeoKeywords) {
    warningsFr.push("Ajoutez quelques mots-clés (ex. import Chine, Kinshasa).");
  }
  if (!shortDescriptionOk) {
    warningsFr.push(`Description courte trop courte (min. ${minShortWords} mots).`);
  }
  return {
    hasMetaTitle,
    hasMetaDescription,
    hasSeoKeywords,
    shortDescriptionOk,
    score,
    maxScore: flags.length,
    warningsFr,
  };
}
