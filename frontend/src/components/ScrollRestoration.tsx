import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const SCROLL_KEY_PREFIX = "scroll_";
const SCROLL_PATH_PREFIX = "scroll_path:";

function saveScrollPosition(pathname: string, key: string, y: number) {
  const value = String(y);
  sessionStorage.setItem(SCROLL_KEY_PREFIX + key, value);
  sessionStorage.setItem(SCROLL_PATH_PREFIX + pathname, value);
}

function readScrollPosition(pathname: string, key: string): number | null {
  const raw =
    sessionStorage.getItem(SCROLL_KEY_PREFIX + key) ??
    sessionStorage.getItem(SCROLL_PATH_PREFIX + pathname);
  if (raw == null) return null;
  const y = parseInt(raw, 10);
  return Number.isFinite(y) ? y : null;
}

/** Retry scroll until layout stabilizes (lazy sections, images, grid cache). */
function restoreScrollPosition(targetY: number) {
  let attempts = 0;
  const maxAttempts = 40;

  const tick = () => {
    window.scrollTo(0, targetY);
    attempts += 1;
    const diff = Math.abs(window.scrollY - targetY);
    if (diff <= 4 || attempts >= maxAttempts) return;
    const delay = attempts < 8 ? 16 : attempts < 20 ? 50 : 100;
    window.setTimeout(() => requestAnimationFrame(tick), delay);
  };

  requestAnimationFrame(tick);
}

export function ScrollRestoration() {
  const { pathname, key } = useLocation();
  const navType = useNavigationType();
  const prevPathRef = useRef(pathname);
  const restoredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const persist = () => saveScrollPosition(pathname, key, window.scrollY);

    window.addEventListener("beforeunload", persist);
    window.addEventListener("pagehide", persist);
    return () => {
      window.removeEventListener("beforeunload", persist);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [pathname, key]);

  useEffect(() => {
    const isNewNavigation = navType === "PUSH";
    const isBackOrForward = navType === "POP";
    const isReload = navType === "REPLACE" && pathname === prevPathRef.current;

    if (isNewNavigation) {
      window.scrollTo(0, 0);
      restoredKeyRef.current = null;
    } else if (isBackOrForward || isReload) {
      const targetY = readScrollPosition(pathname, key);
      if (targetY != null && restoredKeyRef.current !== key) {
        restoredKeyRef.current = key;
        restoreScrollPosition(targetY);
      }
    }

    prevPathRef.current = pathname;
  }, [pathname, key, navType]);

  return null;
}
