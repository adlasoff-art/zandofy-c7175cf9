import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock du client Supabase utilisé par freightQuoteCheckout.
const productsRows: any[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
    select: vi.fn(() => builder),
    in: vi.fn(() => Promise.resolve({ data: productsRows, error: null })),
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
    },
  };
});

import { groupCartByOriginAndStore } from "../freightQuoteCheckout";

function setProducts(rows: any[]) {
  productsRows.length = 0;
  rows.forEach((r) => productsRows.push(r));
}

describe("groupCartByOriginAndStore — Lot 11C Phase 2", () => {
  beforeEach(() => {
    productsRows.length = 0;
  });

  it("retourne [] pour panier vide", async () => {
    const r = await groupCartByOriginAndStore([]);
    expect(r).toEqual([]);
  });

  it("regroupe par (store_id, origin_country) effectif", async () => {
    setProducts([
      { id: "p1", store_id: "s1", origin_country: "CN", weight_grams: 1000, length_cm: 30, width_cm: 20, height_cm: 10, can_ship_air: true, can_ship_sea: true, store: { id: "s1", name: "Boutique A", country: "CN" } },
      { id: "p2", store_id: "s1", origin_country: "TR", weight_grams: 500, length_cm: 10, width_cm: 10, height_cm: 10, can_ship_air: true, can_ship_sea: false, store: { id: "s1", name: "Boutique A", country: "CN" } },
      { id: "p3", store_id: "s2", origin_country: null, weight_grams: 2000, length_cm: 40, width_cm: 30, height_cm: 20, can_ship_air: true, can_ship_sea: true, store: { id: "s2", name: "Boutique B", country: "AE" } },
    ]);

    const groups = await groupCartByOriginAndStore([
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
      { productId: "p3", quantity: 1 },
    ]);

    expect(groups).toHaveLength(3);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey["s1|CN"]).toBeDefined();
    expect(byKey["s1|TR"]).toBeDefined();
    expect(byKey["s2|AE"]).toBeDefined();
    // Origine produit > origine boutique (p3 fallback boutique AE).
    expect(byKey["s2|AE"].origin_country).toBe("AE");
  });

  it("calcule l'intersection des modes supportés (sea exclu si un produit can_ship_sea=false)", async () => {
    setProducts([
      { id: "a", store_id: "s1", origin_country: "CN", weight_grams: 500, length_cm: 10, width_cm: 10, height_cm: 10, can_ship_air: true, can_ship_sea: true, store: { id: "s1", name: "A", country: "CN" } },
      { id: "b", store_id: "s1", origin_country: "CN", weight_grams: 500, length_cm: 10, width_cm: 10, height_cm: 10, can_ship_air: true, can_ship_sea: false, store: { id: "s1", name: "A", country: "CN" } },
    ]);
    const groups = await groupCartByOriginAndStore([
      { productId: "a", quantity: 1 },
      { productId: "b", quantity: 1 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].supported_modes).toEqual(["air"]);
  });

  it("agrège poids et CBM correctement", async () => {
    setProducts([
      { id: "x", store_id: "s1", origin_country: "CN", weight_grams: 1000, length_cm: 100, width_cm: 100, height_cm: 100, can_ship_air: true, can_ship_sea: true, store: { id: "s1", name: "A", country: "CN" } },
    ]);
    const groups = await groupCartByOriginAndStore([{ productId: "x", quantity: 3 }]);
    expect(groups[0].total_weight_kg).toBeCloseTo(3, 5); // 3 × 1000g = 3kg
    expect(groups[0].total_cbm).toBeCloseTo(3, 5); // 3 × 1m³
  });
});