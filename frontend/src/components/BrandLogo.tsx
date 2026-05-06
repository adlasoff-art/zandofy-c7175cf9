import { Link } from "react-router-dom";
import { useBranding } from "@/hooks/use-branding";

interface BrandLogoProps {
  variant?: "header" | "footer";
  className?: string;
}

export function BrandLogo({ variant = "header", className = "" }: BrandLogoProps) {
  const { data: branding } = useBranding();

  const logoUrl = variant === "header" ? branding?.header_logo_url : (branding?.footer_logo_url || branding?.header_logo_url);
  const mode = branding?.logo_mode || "text";

  const textStyle = variant === "header"
    ? "text-xl md:text-2xl tracking-[0.08em] text-foreground"
    : "text-base tracking-[0.08em] text-foreground";

  // Reserve space with aspect-ratio so the image doesn't shift in once it loads.
  // Default ratio 3.5 ≈ "Zandofy" wordmark, override via branding settings if needed.
  const ratio = (branding as any)?.logo_aspect_ratio || 3.5;
  const imgClass = variant === "header" ? "h-8 md:h-10 w-auto" : "h-7 w-auto";
  const imgHeight = variant === "header" ? 40 : 28;
  const imgWidth = Math.round(imgHeight * ratio);
  const wrapperStyle = { aspectRatio: String(ratio) } as React.CSSProperties;

  // fetchpriority must be lowercase to be a valid HTML attribute (avoids React warning)
  const imgExtra = { fetchpriority: "high" } as any;

  if (mode === "logo_only" && logoUrl) {
    return (
      <Link to="/" className={`shrink-0 inline-block ${variant === "header" ? "h-8 md:h-10" : "h-7"} ${className}`} style={wrapperStyle}>
        <img src={logoUrl} alt="Zandofy" width={imgWidth} height={imgHeight} className={imgClass} {...imgExtra} />
      </Link>
    );
  }

  if (mode === "logo_and_text" && logoUrl) {
    return (
      <Link to="/" className={`flex items-end gap-2 shrink-0 ${className}`}>
        <span className={`inline-block ${variant === "header" ? "h-8 md:h-10" : "h-7"}`} style={wrapperStyle}>
          <img src={logoUrl} alt="Zandofy" width={imgWidth} height={imgHeight} className={imgClass} {...imgExtra} />
        </span>
        <span className={textStyle} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: variant === "header" ? 700 : 400, lineHeight: 1 }}>
          Zandofy
        </span>
      </Link>
    );
  }

  // Default: text only
  if (variant === "footer") {
    return (
      <span className={textStyle} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 400 }}>
        Zandofy
      </span>
    );
  }

  return (
    <Link to="/" className={`${textStyle} shrink-0 ${className}`} style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>
      Zandofy
    </Link>
  );
}
