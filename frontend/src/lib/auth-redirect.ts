/**
 * Safe in-app redirect paths after auth (blocks open redirects).
 * Allows only same-origin relative paths: single leading `/`, no `//`, no scheme.
 * Hash fragments (e.g. `/become-vendor#candidater`) are preserved.
 */
export function sanitizeAuthRedirect(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  let path = String(raw).trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://") || path.includes("\\")) {
    return fallback;
  }
  // Reject weird "/http:..." or encoded tricks
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(path)) return fallback;
  // Reject javascript: / data: smuggled after hash is not an open redirect; path before hash must stay relative
  const beforeHash = path.split("#")[0] || "/";
  if (!beforeHash.startsWith("/") || beforeHash.startsWith("//")) return fallback;
  return path;
}
