import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const SCROLL_KEY_PREFIX = "scroll_";

export function ScrollRestoration() {
  const { pathname, key } = useLocation();
  const navType = useNavigationType();
  const prevPathRef = useRef(pathname);

  // Save scroll position before leaving
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem(
        SCROLL_KEY_PREFIX + key,
        String(window.scrollY)
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Save position when component unmounts (route change)
      sessionStorage.setItem(
        SCROLL_KEY_PREFIX + key,
        String(window.scrollY)
      );
    };
  }, [key]);

  useEffect(() => {
    const isNewNavigation = navType === "PUSH";
    const isBackOrForward = navType === "POP";
    const isReload = navType === "REPLACE" && pathname === prevPathRef.current;

    if (isNewNavigation) {
      // New page → scroll to top
      window.scrollTo(0, 0);
    } else if (isBackOrForward || isReload) {
      // Back/forward or reload → restore saved position
      const saved = sessionStorage.getItem(SCROLL_KEY_PREFIX + key);
      if (saved) {
        // Delay to let content render
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(saved, 10));
        });
      }
    }

    prevPathRef.current = pathname;
  }, [pathname, key, navType]);

  return null;
}
