import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyMountProps {
  children: ReactNode;
  /** Reserved space before mount to prevent CLS (px or any CSS height). */
  minHeight?: number | string;
  /** How far before viewport entry to start mounting. Default 400px. */
  rootMargin?: string;
  /** Optional className applied to the placeholder wrapper. */
  className?: string;
  /** Skip defer when restoring back navigation (keeps page height stable). */
  initialShown?: boolean;
}

/**
 * Mounts children only when the placeholder approaches the viewport.
 * Used to defer below-the-fold sections so the initial render stays light.
 */
export function LazyMount({
  children,
  minHeight = 200,
  rootMargin = "300px",
  className,
  initialShown = false,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(initialShown);

  useEffect(() => {
    if (initialShown) {
      setShown(true);
      return;
    }
    if (shown) return;
    const node = ref.current;
    if (!node) return;

    // Safety: if IntersectionObserver isn't available, mount immediately.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [initialShown, shown, rootMargin]);

  if (shown) {
    // After mount, keep content-visibility:auto so off-screen sections skip
    // rendering/painting work (saves main-thread time on long pages).
    const intrinsic = typeof minHeight === "number" ? `${minHeight}px` : minHeight;
    return (
      <div
        style={{
          contentVisibility: "auto",
          containIntrinsicSize: `1px ${intrinsic}`,
        } as React.CSSProperties}
        className={className}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight }}
      aria-hidden="true"
    />
  );
}
