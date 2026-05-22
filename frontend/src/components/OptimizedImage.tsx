/**
 * OptimizedImage — wrapper léger autour de <img> qui ajoute :
 *  - srcset/sizes automatiques pour les images servies par Supabase Storage
 *    (transformations `?width=…&quality=…`),
 *  - loading/lazy + decoding=async par défaut,
 *  - support `priority` pour les LCP (eager + fetchpriority=high),
 *  - fallback transparent si l'URL n'est pas reconnue (rendu <img> simple).
 *
 * Aucune dépendance externe — drop-in pour <img>.
 */
import React, { useMemo } from "react";

const SUPABASE_OBJECT_RE = /\/storage\/v1\/object\/(public|sign)\/([^?]+)/;
const DEFAULT_WIDTHS = [200, 400, 600, 900, 1200];

function isSupabaseStorageUrl(url: string): boolean {
  return /\/storage\/v1\/object\/(public|sign)\//.test(url);
}

/**
 * Transforme une URL Supabase `/object/public/...` en `/render/image/public/...?width=…`.
 * Pour `sign`, on bascule vers `/render/image/sign/...`.
 */
function buildSupabaseRenderUrl(
  url: string,
  width: number,
  quality = 70,
  resize: "cover" | "contain" = "cover",
  height?: number,
): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(SUPABASE_OBJECT_RE);
    if (!m) return url;
    const kind = m[1]; // public | sign
    const rest = m[2]; // bucket/path
    u.pathname = `/storage/v1/render/image/${kind}/${rest}`;
    u.searchParams.set("width", String(width));
    if (height != null) u.searchParams.set("height", String(height));
    u.searchParams.set("quality", String(quality));
    u.searchParams.set("resize", resize);
    u.searchParams.set("format", "webp");
    return u.toString();
  } catch {
    return url;
  }
}

export interface OptimizedImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> {
  src: string;
  alt: string;
  /** Marque cette image comme LCP (eager + fetchpriority=high). */
  priority?: boolean;
  /** Largeurs candidates (px) pour le srcset Supabase. */
  widths?: number[];
  /** sizes attribute (par défaut 100vw). */
  sizes?: string;
  /** Qualité Supabase (1-100). */
  quality?: number;
  /** Supabase resize mode — use contain for product/category thumbnails. */
  resize?: "cover" | "contain";
  /** Optional height (px) for contain transforms (e.g. 3:4 cards). */
  fitHeight?: number;
}

export const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  function OptimizedImage(
    {
      src,
      alt,
      priority,
      widths = DEFAULT_WIDTHS,
      sizes,
      quality = 70,
      resize = "cover",
      fitHeight,
      ...rest
    },
    ref,
  ) {
    const { srcSet, finalSrc } = useMemo(() => {
      if (!src || !isSupabaseStorageUrl(src)) {
        return { srcSet: undefined, finalSrc: src };
      }
      const mid = widths[Math.floor(widths.length / 2)] ?? 600;
      const set = widths
        .map((w) => {
          const h =
            fitHeight != null && widths.length > 0
              ? Math.round((fitHeight * w) / mid)
              : fitHeight;
          return `${buildSupabaseRenderUrl(src, w, quality, resize, h)} ${w}w`;
        })
        .join(", ");
      const fallback = buildSupabaseRenderUrl(src, mid, quality, resize, fitHeight);
      return { srcSet: set, finalSrc: fallback };
    }, [src, widths, quality, resize, fitHeight]);

    const loading = priority ? "eager" : (rest as any).loading ?? "lazy";
    const fetchPriority = priority ? "high" : (rest as any).fetchPriority ?? "auto";

    return (
      <img
        ref={ref}
        src={finalSrc}
        srcSet={srcSet}
        sizes={sizes ?? (srcSet ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" : undefined)}
        alt={alt}
        loading={loading}
        decoding={(rest as any).decoding ?? "async"}
        // @ts-expect-error fetchpriority is valid HTML but not yet in DOM types
        fetchpriority={fetchPriority}
        {...rest}
      />
    );
  },
);