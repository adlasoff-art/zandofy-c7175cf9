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

/** Shipped brand mark (green Z / bag on black). */
export const DEFAULT_BRAND_LOGO = "/brand/zandofy-logo.webp";

/**
 * Site brand mark: shipped Zandofy Z logo (priority), then CMS URL if static fails.
 */
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
      : branding?.header_logo_url;
  const cmsUrl = cmsUrlRaw?.trim() || null;

  const candidates = useMemo(() => {
    // Shipped Z mark first so a stale CMS/PWA URL cannot replace the brand.
    const list = [DEFAULT_BRAND_LOGO, cmsUrl].filter(
      (u): u is string => Boolean(u),
    );
    return [...new Set(list)];
  }, [cmsUrl]);

  const logoUrl =
    candidates.length === 0
      ? null
      : candidates[Math.min(fallbackIndex, candidates.length - 1)] ?? null;
  const showLogo = Boolean(logoUrl) && fallbackIndex < candidates.length;

  const rawMode = branding?.logo_mode || "logo_and_text";
  // Ensure the mark is visible even if CMS still says "text"
  const mode =
    showLogo && (rawMode === "text" || !rawMode)
      ? "logo_and_text"
      : rawMode === "logo_only"
        ? "logo_only"
        : "logo_and_text";

  useEffect(() => {
    setFallbackIndex(0);
  }, [cmsUrl]);

  const onImgError = () => {
    setFallbackIndex((i) => {
      if (i + 1 >= candidates.length) return candidates.length;
      return i + 1;
    });
  };

  const textStyle =
    resolvedSize === "footer"
      ? "text-base tracking-[0.08em] text-foreground"
      : resolvedSize === "hero"
        ? "text-2xl md:text-3xl tracking-[0.08em] text-foreground"
        : "text-xl md:text-2xl tracking-[0.08em] text-foreground";

  const imgClass =
    resolvedSize === "footer"
      ? "h-7 w-7 object-contain rounded-sm"
      : resolvedSize === "hero"
        ? "h-10 md:h-12 w-10 md:w-12 object-contain rounded-sm"
        : "h-8 md:h-10 w-8 md:w-10 object-contain rounded-sm";
  const imgHeight = resolvedSize === "footer" ? 28 : resolvedSize === "hero" ? 48 : 40;
  const imgWidth = imgHeight;
  const linkHeightClass =
    resolvedSize === "footer" ? "h-7" : resolvedSize === "hero" ? "h-10 md:h-12" : "h-8 md:h-10";
  const wrapperStyle: CSSProperties | undefined = undefined;

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
