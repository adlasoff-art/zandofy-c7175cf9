/** Group cart lines by store for mono-store checkout UX. */

export type CartStoreLine = {
  id: string;
  productId: string;
  storeId: string | null;
  storeName: string;
  selected: boolean;
  price: number;
  quantity: number;
};

export type CartStoreGroup = {
  storeId: string;
  storeName: string;
  items: CartStoreLine[];
  selectedCount: number;
  selectedSubtotal: number;
  allSelected: boolean;
  noneSelected: boolean;
};

const UNKNOWN_STORE = "__unknown__";

export function normalizeCartStoreId(storeId: string | null | undefined): string {
  const s = (storeId || "").trim();
  return s || UNKNOWN_STORE;
}

export function groupCartByStore(items: CartStoreLine[]): CartStoreGroup[] {
  const map = new Map<string, CartStoreGroup>();
  for (const item of items) {
    const storeId = normalizeCartStoreId(item.storeId);
    const storeName =
      storeId === UNKNOWN_STORE
        ? "Boutique"
        : item.storeName?.trim() || "Boutique";
    let g = map.get(storeId);
    if (!g) {
      g = {
        storeId,
        storeName,
        items: [],
        selectedCount: 0,
        selectedSubtotal: 0,
        allSelected: true,
        noneSelected: true,
      };
      map.set(storeId, g);
    }
    g.items.push(item);
    if (item.selected) {
      g.selectedCount += item.quantity;
      g.selectedSubtotal += item.price * item.quantity;
      g.noneSelected = false;
    } else {
      g.allSelected = false;
    }
  }
  for (const g of map.values()) {
    if (g.items.length === 0) continue;
    if (g.items.every((i) => i.selected)) g.allSelected = true;
    if (g.items.every((i) => !i.selected)) g.noneSelected = true;
  }
  return Array.from(map.values());
}

/** Selected lines span more than one store (blocks checkout). */
export function selectedSpansMultipleStores(items: CartStoreLine[]): boolean {
  const ids = new Set(
    items.filter((i) => i.selected).map((i) => normalizeCartStoreId(i.storeId))
  );
  return ids.size > 1;
}

export function uniqueSelectedStoreId(items: CartStoreLine[]): string | null {
  const ids = [
    ...new Set(
      items.filter((i) => i.selected).map((i) => normalizeCartStoreId(i.storeId))
    ),
  ];
  if (ids.length !== 1) return null;
  return ids[0] === UNKNOWN_STORE ? null : ids[0];
}
