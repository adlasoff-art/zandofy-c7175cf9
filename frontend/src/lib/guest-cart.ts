/** Guest cart helpers — localStorage until login merge into cart_items. */

export const GUEST_CART_KEY = "zandofy_guest_cart";

export type GuestCartItem = {
  id: string;
  productId: string;
  name: string;
  nameFr: string;
  image: string;
  price: number;
  originalPrice?: number;
  color: string | null;
  size: string | null;
  quantity: number;
  moq: number;
  selected: boolean;
  storeId?: string | null;
  storeName?: string;
};

export function readGuestCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i: any) => i && typeof i.productId === "string" && typeof i.quantity === "number",
    ) as GuestCartItem[];
  } catch {
    return [];
  }
}

export function writeGuestCart(items: GuestCartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function clearGuestCart(): void {
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    /* ignore */
  }
}

export function guestCartLineId(productId: string, color: string | null, size: string | null): string {
  return `guest_${productId}_${color || ""}_${size || ""}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reject garbage product ids before DB merge (FK / injection surface). */
export function isLikelyProductId(id: string): boolean {
  return typeof id === "string" && UUID_RE.test(id.trim());
}

/** Merge incoming into existing guest lines (same product+variant). */
export function upsertGuestCartItem(
  items: GuestCartItem[],
  item: Omit<GuestCartItem, "id" | "selected"> & { selected?: boolean },
): { items: GuestCartItem[]; finalQty: number; wasExisting: boolean } {
  const id = guestCartLineId(item.productId, item.color, item.size);
  const idx = items.findIndex((i) => i.id === id);
  const addQty = Math.min(Math.max(1, Math.floor(item.quantity || 1)), 999);
  if (idx >= 0) {
    const next = [...items];
    const finalQty = Math.min(next[idx].quantity + addQty, 999);
    next[idx] = { ...next[idx], quantity: finalQty, selected: item.selected ?? next[idx].selected };
    return { items: next, finalQty, wasExisting: true };
  }
  const row: GuestCartItem = {
    id,
    productId: item.productId,
    name: item.name,
    nameFr: item.nameFr,
    image: item.image,
    price: item.price,
    originalPrice: item.originalPrice,
    color: item.color,
    size: item.size,
    quantity: addQty,
    moq: item.moq,
    selected: item.selected ?? true,
    storeId: item.storeId ?? null,
    storeName: item.storeName ?? "",
  };
  return { items: [...items, row], finalQty: addQty, wasExisting: false };
}
