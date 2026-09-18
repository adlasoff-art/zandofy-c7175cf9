/**
 * Safe navigation targets for CMS / top-bar links.
 * Blocks javascript:, data:, vbscript:, and protocol-relative URLs.
 */

const RELATIVE_PATH = /^\/(?!\/)[\w\-./?#&=%+,;:@!~*'()[\]]*$/i;

export function sanitizeAppHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  // Relative app path only (single leading slash)
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    if (value.includes(":") && !value.startsWith("/?")) {
      // Reject "/foo:bar" style oddities that could confuse some parsers
      if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null;
    }
    try {
      // Ensure it parses as a path on our origin
      const u = new URL(value, "https://zandofy.local");
      if (u.pathname.startsWith("//")) return null;
      return `${u.pathname}${u.search}${u.hash}` || "/";
    } catch {
      return RELATIVE_PATH.test(value) ? value : null;
    }
  }

  // Absolute https only (http allowed on localhost for admin preview)
  try {
    const u = new URL(value);
    if (u.protocol === "https:") {
      return u.toString();
    }
    if (
      u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1")
    ) {
      return u.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/** For <a href> — returns "#" if unsafe (caller should prefer not rendering). */
export function safeExternalOrAppHref(raw: string | null | undefined): string | null {
  return sanitizeAppHref(raw);
}

/** React Router `to` — relative paths only. */
export function sanitizeRouterTo(raw: string | null | undefined): string | null {
  const href = sanitizeAppHref(raw);
  if (!href) return null;
  if (href.startsWith("http://") || href.startsWith("https://")) {
    // External — not valid for <Link to>; caller should use <a>
    return null;
  }
  return href;
}
