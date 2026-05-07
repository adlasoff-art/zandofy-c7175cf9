/**
 * image-url — helpers pour servir les images Supabase via le endpoint
 * Storage Image Transformation (`/render/image/public/...`) avec resize +
 * conversion WebP à la volée. Bypass automatique pour les URLs externes.
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

export function imgUrl(url: string | null | undefined, opts: ImgOptions = {}): string {
  if (!url) return "";
  if (!SUPABASE_OBJECT_RE.test(url)) return url; // Non-Supabase → tel quel

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
 */
export function imgSrcSet(
  url: string | null | undefined,
  widths: number[],
  opts: Omit<ImgOptions, "width"> = {}
): string {
  if (!url) return "";
  return widths
    .map((w) => `${imgUrl(url, { ...opts, width: w })} ${w}w`)
    .join(", ");
}