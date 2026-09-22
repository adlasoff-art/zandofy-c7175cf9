/** Marketing hub links injected into header category nav (before /stores). */

export type MarketingNavLink = {
  label: string;
  href: string;
  hasMega: boolean;
  highlight: boolean;
};

export const MARKETING_NAV_HREFS = ["/discover", "/become-vendor"] as const;

/** Pathname only — strips origin/query/hash for stable matching (CMS may store absolute URLs). */
export function normalizeNavHref(href: string): string {
  const raw = String(href || "").trim();
  if (!raw || raw === "#") return raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      return (u.pathname.replace(/\/+$/, "") || "/") as string;
    }
  } catch {
    /* fall through */
  }
  const path = raw.split("?")[0].split("#")[0];
  if (!path.startsWith("/")) return path;
  return path.replace(/\/+$/, "") || "/";
}

export function buildMarketingNavLinks(labels: {
  discover: string;
  becomeVendor: string;
}): MarketingNavLink[] {
  return [
    {
      label: labels.discover,
      href: "/discover",
      hasMega: false,
      highlight: false,
    },
    {
      label: labels.becomeVendor,
      href: "/become-vendor",
      hasMega: false,
      highlight: false,
    },
  ];
}

function isStoresLink(link: { href: string; label: string }): boolean {
  const path = normalizeNavHref(link.href);
  if (path === "/stores") return true;
  return /fournisseur/i.test(link.label) || /reliable\s*suppliers?/i.test(link.label);
}

function isSoldesLink(link: { href: string; label: string }): boolean {
  const path = normalizeNavHref(link.href);
  if (path.includes("/soldes")) return true;
  // Exact label only — avoid matching "Sales analytics" etc.
  return /^(soldes|sales)$/i.test(link.label.trim());
}

/**
 * Insert marketing links immediately before Fournisseurs (/stores).
 * Dedupes by normalized href so CMS absolute URLs are not doubled.
 */
export function injectMarketingNav<T extends { href: string; label: string }>(
  links: T[],
  marketing: T[],
): T[] {
  const marketingPaths = new Set(marketing.map((m) => normalizeNavHref(m.href)));
  const cleaned = links.filter((l) => !marketingPaths.has(normalizeNavHref(l.href)));

  const storesIdx = cleaned.findIndex(isStoresLink);
  if (storesIdx >= 0) {
    return [...cleaned.slice(0, storesIdx), ...marketing, ...cleaned.slice(storesIdx)];
  }

  const soldesIdx = cleaned.findIndex(isSoldesLink);
  if (soldesIdx >= 0) {
    return [...cleaned.slice(0, soldesIdx + 1), ...marketing, ...cleaned.slice(soldesIdx + 1)];
  }

  if (cleaned.length > 0) {
    return [cleaned[0], ...marketing, ...cleaned.slice(1)];
  }

  return [...marketing];
}

/**
 * Convert CMS menu URL to a React Router `to` (relative path).
 * Absolute https same-site URLs become pathnames; unsafe schemes → "#".
 */
export function cmsUrlToRouterHref(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "#";
  if (raw === "#") return "#";
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return "#";
    return raw;
  }
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      return `${u.pathname}${u.search}${u.hash}` || "/";
    }
  } catch {
    return "#";
  }
  return "#";
}
