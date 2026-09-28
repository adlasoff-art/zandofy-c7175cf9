import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { useBranding } from "@/hooks/use-branding";

interface BrandLogoProps {
  variant?: "header" | "footer";
  /** Visual size — hero is larger for marketing landings; never affects other instances. */
  size?: "header" | "footer" | "hero";
  /** Layout only (alignment/margins). Do not pass height/width sizing here. */
  className?: string;
}

/** Static fallbacks when CMS image URL is missing or broken (order matters). */
const STATIC_LOGO_FALLBACKS = ["/icons/icon-192.png", "/favicon.ico"] as const;

export function BrandLogo({
  variant = "header",
  size,
  className = "",
}: BrandLogoProps) {
  const { data: branding } = useBranding();
  const [fallbackIndex, setFallbackIndex] = useState(0);

  const resolvedSize = size ?? (variant === "footer" ? "footer" : "header");

  const cmsUrlRaw =
    variant === "footer"
      ? branding?.footer_logo_url || branding?.header_logo_url
      : branding?.header_logo_url || branding?.footer_logo_url;
  const cmsUrl = cmsUrlRaw?.trim() || null;
  const pwaUrl = branding?.pwa_icon_192_url?.trim() || null;

  const rawMode = branding?.logo_mode || "text";
  // CMS URL present but mode still "text" → show image (common CMS pitfall)
  const mode = cmsUrl && rawMode === "text" ? "logo_and_text" : rawMode;
  const wantsImage = mode === "logo_only" || mode === "logo_and_text";

  const candidates = useMemo(() => {
    if (!wantsImage && !cmsUrl) return [] as string[];
    return [cmsUrl, pwaUrl, ...STATIC_LOGO_FALLBACKS].filter(
      (u): u is string => Boolean(u),
    );
  }, [wantsImage, cmsUrl, pwaUrl]);

  const logoUrl = candidates[Math.min(fallbackIndex, Math.max(candidates.length - 1, 0))] ?? null;
  const showLogo = Boolean(logoUrl) && fallbackIndex < candidates.length;

  useEffect(() => {
    setFallbackIndex(0);
  }, [cmsUrl, pwaUrl, mode]);

  const textStyle =
    resolvedSize === "footer"
      ? "text-base tracking-[0.08em] text-foreground"
      : resolvedSize === "hero"
        ? "text-2xl md:text-3xl tracking-[0.08em] text-foreground"
        : "text-xl md:text-2xl tracking-[0.08em] text-foreground";

  const imgClass =
    resolvedSize === "footer"
      ? "h-7 w-auto max-w-[160px] object-contain"
      : resolvedSize === "hero"
        ? "h-10 md:h-12 w-auto max-w-[220px] object-contain"
        : "h-8 md:h-10 w-auto max-w-[180px] object-contain";
  const imgHeight = resolvedSize === "footer" ? 28 : resolvedSize === "hero" ? 48 : 40;
  const ratio =
    Number((branding as { logo_aspect_ratio?: number } | null)?.logo_aspect_ratio) > 0
      ? Number((branding as { logo_aspect_ratio?: number }).logo_aspect_ratio)
      : 1;
  const imgWidth = Math.round(imgHeight * Math.max(ratio, 1));
  const wrapperStyle: CSSProperties =
    ratio > 1.2 ? { aspectRatio: String(ratio) } : undefined;
  const linkHeightClass =
    resolvedSize === "footer" ? "h-7" : resolvedSize === "hero" ? "h-10 md:h-12" : "h-8 md:h-10";

  const onImgError = () => {
    setFallbackIndex((i) => i + 1);
  };

  const textOnlyFooter = (
    <span className={`${textStyle} ${className}`} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 400 }}>
      Zandofy
    </span>
  );

  const textOnlyHeader = (
    <Link
      to="/"
      className={`${textStyle} shrink-0 ${className}`}
      style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}
    >
      Zandofy
    </Link>
  );

  if (mode === "logo_only" && showLogo) {
    return (
      <Link
        to="/"
        className={`shrink-0 inline-block ${linkHeightClass} ${className}`}
        style={wrapperStyle}
      >
        <img
          src={logoUrl!}
          alt="Zandofy"
          width={imgWidth}
          height={imgHeight}
          className={imgClass}
          fetchPriority="high"
          onError={onImgError}
        />
      </Link>
    );
  }

  if (mode === "logo_and_text" && showLogo) {
    return (
      <Link to="/" className={`flex items-center gap-1.5 shrink-0 ${className}`}>
        <img
          src={logoUrl!}
          alt="Zandofy"
          width={imgWidth}
          height={imgHeight}
          className={imgClass}
          fetchPriority="high"
          onError={onImgError}
        />
        <span
          className={textStyle}
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: variant === "footer" ? 400 : 700,
            lineHeight: 1,
          }}
        >
          Zandofy
        </span>
      </Link>
    );
  }

  if (variant === "footer") {
    return textOnlyFooter;
  }

  return textOnlyHeader;
}
