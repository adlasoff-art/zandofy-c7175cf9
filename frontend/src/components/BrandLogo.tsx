import { useEffect, useState } from "react";
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

export function BrandLogo({
  variant = "header",
  size,
  className = "",
}: BrandLogoProps) {
  const { data: branding } = useBranding();
  const [logoFailed, setLogoFailed] = useState(false);
  const resolvedSize = size ?? (variant === "footer" ? "footer" : "header");

  const logoUrlRaw =
    variant === "footer"
      ? branding?.footer_logo_url || branding?.header_logo_url
      : branding?.header_logo_url;
  const logoUrl = logoUrlRaw?.trim() || null;

  // If an image URL is configured but mode stayed at default "text", treat as logo+text
  // so CMS uploads are visible without forcing admins to flip logo_mode manually.
  const rawMode = branding?.logo_mode || "text";
  const mode = logoUrl && rawMode === "text" ? "logo_and_text" : rawMode;

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

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
      : 3.5;
  const imgWidth = Math.round(imgHeight * ratio);
  const wrapperStyle: CSSProperties = { aspectRatio: String(ratio) };
  const linkHeightClass =
    resolvedSize === "footer" ? "h-7" : resolvedSize === "hero" ? "h-10 md:h-12" : "h-8 md:h-10";

  const showLogo = Boolean(logoUrl) && !logoFailed;

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
          onError={() => setLogoFailed(true)}
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
          onError={() => setLogoFailed(true)}
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
