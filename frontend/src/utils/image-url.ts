/** Responsive image URLs for Supabase Storage, Unsplash, and other CDNs. */

export const PRODUCT_CARD_WIDTHS = [200, 400, 600, 800] as const;
export const PRODUCT_DETAIL_WIDTHS = [400, 800, 1200] as const;
export const HERO_LCP_WIDTH = 900;

export function optimizeImageUrl(
  url: string,
  width: number,
  quality = 80
): string {
  if (!url || url.startsWith("/") || url.includes("placeholder")) {
    return url;
  }

  try {
    const parsed = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "https://www.zandofy.com"
    );

    const objectPrefix = "/storage/v1/object/public/";
    const renderPrefix = "/storage/v1/render/image/public/";
    if (parsed.pathname.includes(objectPrefix)) {
      const renderPath = parsed.pathname.replace(objectPrefix, renderPrefix);
      return `${parsed.origin}${renderPath}?width=${width}&quality=${quality}&resize=contain`;
    }

    if (parsed.hostname.includes("images.unsplash.com")) {
      parsed.searchParams.set("w", String(width));
      parsed.searchParams.set("q", String(quality));
      parsed.searchParams.set("auto", "format");
      if (!parsed.searchParams.has("fit")) {
        parsed.searchParams.set("fit", "crop");
      }
      return parsed.toString();
    }

    if (!parsed.searchParams.has("w")) {
      parsed.searchParams.set("w", String(width));
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildImageSrcSet(
  url: string,
  widths: readonly number[],
  quality = 80
): string | undefined {
  if (!url || url.startsWith("/")) return undefined;
  const parts = widths.map((w) => `${optimizeImageUrl(url, w, quality)} ${w}w`);
  return parts.length > 1 ? parts.join(", ") : undefined;
}
