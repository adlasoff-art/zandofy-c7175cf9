/** Guest wishlist helpers — localStorage until login merge into wishlists. */

import { isLikelyProductId } from "@/lib/guest-cart";

export const GUEST_WISHLIST_KEY = "zandofy_guest_wishlist";

export function readGuestWishlist(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && isLikelyProductId(id)))];
  } catch {
    return [];
  }
}

export function writeGuestWishlist(ids: string[]): void {
  try {
    const clean = [...new Set(ids.filter((id) => isLikelyProductId(id)))];
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(clean));
  } catch {
    /* ignore */
  }
}

export function clearGuestWishlist(): void {
  try {
    localStorage.removeItem(GUEST_WISHLIST_KEY);
  } catch {
    /* ignore */
  }
}

export function toggleGuestWishlistId(ids: string[], productId: string): string[] {
  if (!isLikelyProductId(productId)) return ids;
  if (ids.includes(productId)) return ids.filter((id) => id !== productId);
  return [...ids, productId];
}
