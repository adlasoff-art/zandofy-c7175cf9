/** True when the app runs as an installed PWA (standalone). */
export function isPWAStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Mobile or installed PWA — prefer same-tab deep links over popup tabs. */
export function isMobileOrPWA(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const pwa = isPWAStandalone();
  const coarseTouch = window.matchMedia("(max-width: 768px)").matches;
  return mobileUa || pwa || (coarseTouch && "ontouchstart" in window);
}
