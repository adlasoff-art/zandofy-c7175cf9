/**
 * Sanitize a filename for use in Supabase Storage paths (or any URL-sensitive sink).
 *
 * - Strips diacritics (é → e, à → a, ñ → n, …) via NFD normalization
 * - Replaces any non [a-zA-Z0-9._-] character with "-"
 * - Collapses repeated separators
 * - Lowercases the result
 * - Preserves the original extension (lowercased, max 8 chars)
 *
 * Supabase Storage object keys reject characters outside a safe ASCII subset;
 * passing accented or spaced filenames raises "Invalid key" errors. Always run
 * user-provided file names through this helper before building a storage path.
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName) return "file";

  const lastDot = rawName.lastIndexOf(".");
  const base = lastDot > 0 ? rawName.slice(0, lastDot) : rawName;
  const rawExt = lastDot > 0 ? rawName.slice(lastDot + 1) : "";

  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-zA-Z0-9._-]+/g, "-") // unsafe → dash
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .toLowerCase();

  const safeBase = clean(base) || "file";
  const safeExt = clean(rawExt).slice(0, 8);

  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

/**
 * Extract a sanitized lowercase extension from a filename, with a fallback.
 * Useful when the storage path only needs the extension (most upload sites).
 */
export function sanitizeExtension(rawName: string, fallback = "bin"): string {
  const lastDot = rawName.lastIndexOf(".");
  if (lastDot < 0) return fallback;
  const ext = rawName
    .slice(lastDot + 1)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase()
    .slice(0, 8);
  return ext || fallback;
}
