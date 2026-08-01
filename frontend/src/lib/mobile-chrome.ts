/**
 * Routes where the mobile bottom nav should be hidden (immersive flows).
 */
export function shouldHideMobileBottomNav(pathname: string): boolean {
  if (pathname === "/checkout" || pathname.startsWith("/checkout/")) return true;
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;
  if (pathname === "/reset-password") return true;
  if (pathname === "/banned") return true;
  // Full-screen chat / messages thread
  if (pathname === "/messages" || pathname.startsWith("/messages/")) return true;
  return false;
}
