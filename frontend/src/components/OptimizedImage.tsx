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
function buildSupabaseRenderUrl(url: string, width: number, quality = 70): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(SUPABASE_OBJECT_RE);
    if (!m) return url;
    const kind = m[1]; // public | sign
    const rest = m[2]; // bucket/path
    u.pathname = `/storage/v1/render/image/${kind}/${rest}`;
    u.searchParams.set("width", String(width));
    u.searchParams.set("quality", String(quality));
    u.searchParams.set("resize", "contain");
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
}

export const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  function OptimizedImage(
    { src, alt, priority, widths = DEFAULT_WIDTHS, sizes, quality = 70, ...rest },
    ref,
  ) {
    const { srcSet, finalSrc } = useMemo(() => {
      if (!src || !isSupabaseStorageUrl(src)) {
        return { srcSet: undefined, finalSrc: src };
      }
      const set = widths
        .map((w) => `${buildSupabaseRenderUrl(src, w, quality)} ${w}w`)
        .join(", ");
      const fallback = buildSupabaseRenderUrl(src, widths[Math.floor(widths.length / 2)] ?? 600, quality);
      return { srcSet: set, finalSrc: fallback };
    }, [src, widths, quality]);

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