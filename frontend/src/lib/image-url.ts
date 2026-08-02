/**
 * image-url — helpers pour servir les images Supabase.
 *
 * Par défaut (VITE_USE_IMAGE_TRANSFORM !== "true") : URL Storage originale
 * `/object/public/...` — pas de Image Transformations (quota Pro 100).
 * Si VITE_USE_IMAGE_TRANSFORM=true : `/render/image/...` avec resize + WebP.
 *
 * Utilisation :
 *   <img src={imgUrl(product.main_image_url, { width: 400 })} />
 *   <img srcSet={imgSrcSet(url, [400, 800])} sizes="(max-width:768px) 50vw, 25vw" />
 */

const SUPABASE_OBJECT_RE = /\/storage\/v1\/object\/public\//;

export interface ImgOptions {
  width?: number;
  height?: number;
  quality?: number; // 20-100, default 75
  format?: "webp" | "avif" | "origin";
  resize?: "cover" | "contain" | "fill";
}

/** Strict opt-in — absent or any value other than "true" disables transforms. */
export function imageTransformsEnabled(): boolean {
  return import.meta.env.VITE_USE_IMAGE_TRANSFORM === "true";
}

export function imgUrl(url: string | null | undefined, opts: ImgOptions = {}): string {
  if (!url) return "";
  if (!SUPABASE_OBJECT_RE.test(url)) return url; // Non-Supabase → tel quel
  if (!imageTransformsEnabled()) return url;

  const transformed = url.replace(SUPABASE_OBJECT_RE, "/storage/v1/render/image/public/");
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  params.set("quality", String(opts.quality ?? 75));
  if (opts.format && opts.format !== "origin") params.set("format", opts.format);
  else if (!opts.format) params.set("format", "webp");
  if (opts.resize) params.set("resize", opts.resize);

  const qs = params.toString();
  return qs ? `${transformed}?${qs}` : transformed;
}

/**
 * Generate a srcSet for responsive images.
 * widths: [400, 800] → "<url@400> 400w, <url@800> 800w"
 * When transforms are off, returns a single entry with the raw URL (or "").
 */
export function imgSrcSet(
  url: string | null | undefined,
  widths: number[],
  opts: Omit<ImgOptions, "width"> = {}
): string {
  if (!url) return "";
  if (!imageTransformsEnabled()) {
    return `${url} ${widths[0] ?? 800}w`;
  }
  return widths
    .map((w) => `${imgUrl(url, { ...opts, width: w })} ${w}w`)
    .join(", ");
}
