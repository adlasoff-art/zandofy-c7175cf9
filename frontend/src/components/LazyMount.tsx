import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyMountProps {
  children: ReactNode;
  /** Reserved space before mount to prevent CLS (px or any CSS height). */
  minHeight?: number | string;
  /** How far before viewport entry to start mounting. Default 400px. */
  rootMargin?: string;
  /** Optional className applied to the placeholder wrapper. */
  className?: string;
}

/**
 * Mounts children only when the placeholder approaches the viewport.
 * Used to defer below-the-fold sections so the initial render stays light.
 */
export function LazyMount({
  children,
  minHeight = 200,
  rootMargin = "400px",
  className,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
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
  }, [shown, rootMargin]);

  if (shown) return <>{children}</>;

  return (
    <div
      ref={ref}
      className={className}
      style={{ minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight }}
      aria-hidden="true"
    />
  );
}
