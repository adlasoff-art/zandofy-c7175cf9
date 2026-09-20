import { describe, expect, it } from "vitest";
import {
  mergeDiscoveryPrefs,
  normalizeDiscoveryPrefs,
  purchaseScopeToHomeMarket,
  rankProductsByDiscoveryPrefs,
  shouldShowReceiptStep,
  emptyDiscoveryPrefs,
} from "@/lib/discovery-prefs";
import { upsertGuestCartItem } from "@/lib/guest-cart";

describe("discovery-prefs", () => {
  it("maps purchase_scope to home market", () => {
    expect(purchaseScopeToHomeMarket("city")).toBe("local");
    expect(purchaseScopeToHomeMarket("country")).toBe("local");
    expect(purchaseScopeToHomeMarket("any_country")).toBe("all");
    expect(purchaseScopeToHomeMarket(null)).toBe("all");
  });

  it("shows receipt step only for city/country", () => {
    expect(shouldShowReceiptStep("city")).toBe(true);
    expect(shouldShowReceiptStep("country")).toBe(true);
    expect(shouldShowReceiptStep("any_country")).toBe(false);
    expect(shouldShowReceiptStep("city", { receipt: false })).toBe(false);
  });

  it("ranks ~65/25/10 with interests and audience", () => {
    const products = [
      { id: "1", category_id: "watches", gender_target: "male", rating: 5 },
      { id: "2", category_id: "watches", gender_target: "male", rating: 4 },
      { id: "3", category_id: "shoes", gender_target: "male", rating: 4 },
      { id: "4", category_id: "bags", gender_target: "female", rating: 5 },
      { id: "5", category_id: "phones", gender_target: "unisex", rating: 3 },
      { id: "6", category_id: "watches", gender_target: "male", rating: 3 },
      { id: "7", category_id: "beauty", gender_target: "female", rating: 4 },
      { id: "8", category_id: "tools", gender_target: "male", rating: 2 },
      { id: "9", category_id: "watches", gender_target: "male", rating: 2 },
      { id: "10", category_id: "decor", gender_target: "unisex", rating: 1 },
    ];
    const prefs = normalizeDiscoveryPrefs({
      ...emptyDiscoveryPrefs(),
      audience: "male",
      interest_category_ids: ["watches"],
      completed_at: new Date().toISOString(),
    });
    const ranked = rankProductsByDiscoveryPrefs(products, prefs, 10);
    expect(ranked.length).toBe(10);
    expect(ranked.filter((p) => p.category_id === "watches").length).toBeGreaterThanOrEqual(3);
  });

  it("merge prefers completed over incomplete even if incomplete is newer", () => {
    const completed = normalizeDiscoveryPrefs({
      ...emptyDiscoveryPrefs(),
      audience: "male",
      completed_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const incomplete = normalizeDiscoveryPrefs({
      ...emptyDiscoveryPrefs(),
      audience: "female",
      completed_at: null,
      updated_at: "2026-09-01T00:00:00.000Z",
    });
    expect(mergeDiscoveryPrefs(completed, incomplete).audience).toBe("male");
    expect(mergeDiscoveryPrefs(incomplete, completed).audience).toBe("male");
  });

  it("merge prefers newer completed_at", () => {
    const a = normalizeDiscoveryPrefs({
      ...emptyDiscoveryPrefs(),
      audience: "male",
      completed_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const b = normalizeDiscoveryPrefs({
      ...emptyDiscoveryPrefs(),
      audience: "female",
      completed_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    });
    expect(mergeDiscoveryPrefs(a, b).audience).toBe("female");
  });
});

describe("guest-cart", () => {
  it("upserts same variant quantities", () => {
    const first = upsertGuestCartItem([], {
      productId: "p1",
      name: "A",
      nameFr: "A",
      image: "",
      price: 10,
      color: "red",
      size: "M",
      quantity: 2,
      moq: 1,
    });
    expect(first.items).toHaveLength(1);
    expect(first.finalQty).toBe(2);
    const second = upsertGuestCartItem(first.items, {
      productId: "p1",
      name: "A",
      nameFr: "A",
      image: "",
      price: 10,
      color: "red",
      size: "M",
      quantity: 3,
      moq: 1,
    });
    expect(second.items).toHaveLength(1);
    expect(second.finalQty).toBe(5);
    expect(second.wasExisting).toBe(true);
  });

  it("isLikelyProductId accepts uuid only", async () => {
    const { isLikelyProductId } = await import("@/lib/guest-cart");
    expect(isLikelyProductId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isLikelyProductId("not-a-uuid")).toBe(false);
    expect(isLikelyProductId("")).toBe(false);
  });
});
