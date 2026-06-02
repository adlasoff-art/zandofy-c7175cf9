const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://zandofy.com").replace(/\/$/, "");

/** Absolute HTTPS URL for Open Graph (crawlers and client meta tags). */
export function toAbsoluteOgImage(url: string | null | undefined): string {
  const raw = (url || "").trim();
  if (!raw || raw === "/placeholder.svg") return `${SITE_URL}/og-default.jpg`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${SITE_URL}${path}`;
}

/** Featured product image for share previews; platform OG only when no real image. */
export function resolveProductOgImage(
  primaryUrl: string | null | undefined,
  fallbackUrl?: string | null,
): string {
  const candidate = (primaryUrl || fallbackUrl || "").trim();
  return toAbsoluteOgImage(candidate);
}
