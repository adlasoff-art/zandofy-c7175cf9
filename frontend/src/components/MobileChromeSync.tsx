import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { shouldHideMobileBottomNav } from "@/lib/mobile-chrome";

/**
 * Syncs immersive-route chrome: body class for padding + short mobile page fade.
 */
export function MobileChromeSync() {
  const { pathname, key } = useLocation();

  useEffect(() => {
    const hideNav = shouldHideMobileBottomNav(pathname);
    document.body.classList.toggle("hide-mobile-bottom-nav", hideNav);
    return () => {
      document.body.classList.remove("hide-mobile-bottom-nav");
    };
  }, [pathname]);

  useEffect(() => {
    // Short fade only on mobile / PWA; skip if user prefers reduced motion
    const mq = window.matchMedia("(max-width: 1023px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!mq.matches || reduced.matches) return;

    document.documentElement.classList.remove("page-fade");
    // Force reflow so re-adding the class retriggers animation
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add("page-fade");

    const t = window.setTimeout(() => {
      document.documentElement.classList.remove("page-fade");
    }, 220);
    return () => window.clearTimeout(t);
  }, [key]);

  return null;
}
