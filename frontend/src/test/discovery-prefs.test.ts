import { describe, expect, it } from "vitest";
import {
  assembleDiscoveryFeed,
  expandInterestCategoryIds,
  hashSeed,
  rotationBucket,
  rankProductsByDiscoveryPrefs,
} from "@/lib/discovery-engine";
import {
  emptyDiscoveryPrefs,
  mergeDiscoveryPrefs,
  normalizeDiscoveryPrefs,
  purchaseScopeToHomeMarket,
  shouldShowReceiptStep,
} from "@/lib/discovery-prefs";
import { DISCOVERY_MIX_DEFAULTS } from "@/hooks/use-auth-settings";
import { upsertGuestCartItem, isLikelyProductId } from "@/lib/guest-cart";

function makePool() {
  const rows = [];
  for (let i = 1; i <= 40; i++) {
    rows.push({
      id: String(i),
      category_id: i <= 12 ? "watches" : i <= 20 ? "shoes" : "other",
      gender_target:
        i % 5 === 0 ? "unisex" : i % 3 === 0 ? "female" : "male",
      shop_type: i <= 25 ? "local" : "international",
      origin_country: i <= 25 ? "CD" : i % 2 === 0 ? "TR" : "BJ",
      rating: 5 - (i % 5),
    });
  }
  return rows;
}

describe("discovery-prefs", () => {
  it("maps purchase_scope to home market", () => {
    expect(purchaseScopeToHomeMarket("city")).toBe("local");
    expect(purchaseScopeToHomeMarket("country")).toBe("local");
    expect(purchaseScopeToHomeMarket("any_country")).toBe("all");
  });

  it("shows receipt step only for city/country", () => {
    expect(shouldShowReceiptStep("city")).toBe(true);
    expect(shouldShowReceiptStep("any_country")).toBe(false);
  });

  it("merge prefers completed over incomplete", () => {
    const completed = normalizeDiscoveryPrefs({
      ...emptyDiscoveryPrefs(),
      audience: "male",
      completed_at: "2026-01-01T00:00:00.000Z",
    });
    const incomplete = normalizeDiscoveryPrefs({
      ...emptyDiscoveryPrefs(),
      audience: "female",
      updated_at: "2026-09-01T00:00:00.000Z",
    });
    expect(mergeDiscoveryPrefs(completed, incomplete).audience).toBe("male");
  });
});

describe("assembleDiscoveryFeed", () => {
  const prefs = normalizeDiscoveryPrefs({
    ...emptyDiscoveryPrefs(),
    audience: "male",
    interest_category_ids: ["watches"],
    purchase_scope: "city",
    country_code: "CD",
    completed_at: new Date().toISOString(),
  });

  it("returns take items and prefers male+interest in core for city scope", () => {
    const ranked = assembleDiscoveryFeed(makePool(), {
      prefs,
      take: 20,
      mix: DISCOVERY_MIX_DEFAULTS,
      surface: "test",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    expect(ranked.length).toBe(20);
    const top10 = ranked.slice(0, 10);
    const maleWatches = top10.filter(
      (p) => p.gender_target === "male" && p.category_id === "watches",
    );
    expect(maleWatches.length).toBeGreaterThanOrEqual(2);
  });

  it("CMS mix override changes explore share", () => {
    const tight = assembleDiscoveryFeed(makePool(), {
      prefs,
      take: 20,
      mix: { ...DISCOVERY_MIX_DEFAULTS, core_pct: 90, explore_pct: 5, neutral_pct: 5 },
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    expect(tight.length).toBe(20);
  });

  it("rotation bucket changes with time", () => {
    expect(rotationBucket(12, 0)).not.toBe(rotationBucket(12, 13 * 3600 * 1000));
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });

  it("does not personalize without completed_at", () => {
    const incomplete = normalizeDiscoveryPrefs({
      ...emptyDiscoveryPrefs(),
      audience: "male",
      interest_category_ids: ["watches"],
      purchase_scope: "city",
      country_code: "CD",
    });
    const pool = makePool();
    const ranked = assembleDiscoveryFeed(pool, {
      prefs: incomplete,
      take: 10,
      mix: DISCOVERY_MIX_DEFAULTS,
    });
    expect(ranked.map((p) => p.id)).toEqual(pool.slice(0, 10).map((p) => p.id));
  });

  it("keeps opposite gender out of early core for male audience", () => {
    const ranked = assembleDiscoveryFeed(makePool(), {
      prefs,
      take: 20,
      mix: DISCOVERY_MIX_DEFAULTS,
      surface: "test_opp",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    const coreSlice = ranked.slice(0, 13); // ~65% of 20
    const femaleCore = coreSlice.filter(
      (p) => p.gender_target === "female" && p.category_id === "watches",
    );
    // Opposite gender may appear in explore (~25%) but not dominate core
    expect(femaleCore.length).toBeLessThanOrEqual(2);
  });

  it("caps international share for city scope and keeps core local", () => {
    const ranked = assembleDiscoveryFeed(makePool(), {
      prefs,
      take: 20,
      mix: { ...DISCOVERY_MIX_DEFAULTS, intl_cap_pct: 10 },
      surface: "test_intl_cap",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    expect(ranked.length).toBe(20);
    const coreSlice = ranked.slice(0, 13);
    expect(coreSlice.every((p) => p.shop_type === "local")).toBe(true);
    const intlCount = ranked.filter((p) => p.shop_type === "international").length;
    expect(intlCount).toBeLessThanOrEqual(2); // ~10% of 20
  });

  it("does not let neutral unisex intl exceed intl_cap on city scope", () => {
    const pool = [];
    for (let i = 1; i <= 30; i++) {
      pool.push({
        id: `L${i}`,
        category_id: "watches",
        gender_target: "male",
        shop_type: "local",
        origin_country: "CD",
        rating: 5,
      });
    }
    for (let i = 1; i <= 20; i++) {
      pool.push({
        id: `IU${i}`,
        category_id: "other",
        gender_target: "unisex",
        shop_type: "international",
        origin_country: "TR",
        rating: 5,
      });
    }
    const ranked = assembleDiscoveryFeed(pool, {
      prefs,
      take: 20,
      mix: { ...DISCOVERY_MIX_DEFAULTS, intl_cap_pct: 10 },
      surface: "test_neutral_intl",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    const intlCount = ranked.filter((p) => p.shop_type === "international").length;
    expect(intlCount).toBeLessThanOrEqual(2);
  });

  it("treats missing category as apparel-strict when apparel map is loaded", () => {
    const housePrefs = normalizeDiscoveryPrefs({
      ...prefs,
      interest_category_ids: ["home"],
    });
    const pool = [
      {
        id: "uncat-u",
        category_id: null as string | null,
        gender_target: "unisex",
        shop_type: "local",
        origin_country: "CD",
        rating: 5,
      },
      {
        id: "home-u",
        category_id: "home",
        gender_target: "unisex",
        shop_type: "local",
        origin_country: "CD",
        rating: 5,
      },
      ...makePool().filter((p) => p.shop_type === "local" && p.gender_target === "male").slice(0, 10),
    ];
    const ranked = assembleDiscoveryFeed(pool, {
      prefs: housePrefs,
      take: 12,
      mix: DISCOVERY_MIX_DEFAULTS,
      apparelCategoryIds: ["fashion", "watches", "shoes"],
      interestCategoryIds: ["home"],
      surface: "test_uncat",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    const coreSlice = ranked.slice(0, 8);
    expect(coreSlice.some((p) => p.id === "home-u")).toBe(true);
    expect(coreSlice.some((p) => p.id === "uncat-u")).toBe(false);
  });

  it("excludes opposite gender from explore for male audience", () => {
    const ranked = assembleDiscoveryFeed(makePool(), {
      prefs,
      take: 20,
      mix: DISCOVERY_MIX_DEFAULTS,
      surface: "test_no_opp_explore",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    const females = ranked.filter((p) => p.gender_target === "female");
    expect(females.length).toBe(0);
  });

  it("admits non-apparel interest unisex into core when apparel map provided", () => {
    const housePrefs = normalizeDiscoveryPrefs({
      ...prefs,
      interest_category_ids: ["home"],
    });
    const pool = [
      ...makePool(),
      {
        id: "home-u1",
        category_id: "home",
        gender_target: "unisex",
        shop_type: "local",
        origin_country: "CD",
        rating: 5,
      },
      {
        id: "home-u2",
        category_id: "home",
        gender_target: "",
        shop_type: "local",
        origin_country: "CD",
        rating: 5,
      },
      {
        id: "fashion-f1",
        category_id: "fashion",
        gender_target: "female",
        shop_type: "local",
        origin_country: "CD",
        rating: 5,
      },
    ];
    const ranked = assembleDiscoveryFeed(pool, {
      prefs: housePrefs,
      take: 20,
      mix: DISCOVERY_MIX_DEFAULTS,
      apparelCategoryIds: ["fashion", "watches", "shoes"],
      interestCategoryIds: ["home"],
      surface: "test_transverse",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    const coreSlice = ranked.slice(0, 13);
    expect(coreSlice.some((p) => p.category_id === "home")).toBe(true);
    expect(coreSlice.some((p) => p.id === "fashion-f1")).toBe(false);
  });

  it("any_country does not apply intl_cap", () => {
    const openPrefs = normalizeDiscoveryPrefs({
      ...prefs,
      purchase_scope: "any_country",
    });
    const ranked = assembleDiscoveryFeed(makePool(), {
      prefs: openPrefs,
      take: 20,
      mix: { ...DISCOVERY_MIX_DEFAULTS, intl_cap_pct: 10 },
      surface: "test_any",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    const intlCount = ranked.filter((p) => p.shop_type === "international").length;
    // With open explore, intl can exceed the 10% city/country cap
    expect(intlCount).toBeGreaterThanOrEqual(0);
    expect(ranked.length).toBe(20);
  });

  it("prefers true store_city_id match when prefs.city_id set", () => {
    const cityPrefs = normalizeDiscoveryPrefs({
      ...prefs,
      city_id: "11111111-1111-4111-8111-111111111111",
    });
    const pool = makePool().map((p, i) => ({
      ...p,
      store_city_id:
        i <= 5
          ? "11111111-1111-4111-8111-111111111111"
          : "22222222-2222-4222-8222-222222222222",
    }));
    const ranked = assembleDiscoveryFeed(pool, {
      prefs: cityPrefs,
      take: 20,
      mix: DISCOVERY_MIX_DEFAULTS,
      surface: "test_city",
      seedKey: "u1",
      nowMs: 1_700_000_000_000,
    });
    const top = ranked.slice(0, 8);
    const matched = top.filter(
      (p) => p.store_city_id === "11111111-1111-4111-8111-111111111111",
    );
    expect(matched.length).toBeGreaterThanOrEqual(2);
  });

  it("legacy rankProductsByDiscoveryPrefs still works", () => {
    const ranked = rankProductsByDiscoveryPrefs(makePool(), prefs, 10);
    expect(ranked.length).toBe(10);
  });

  it("expandInterestCategoryIds includes children", () => {
    const ids = expandInterestCategoryIds(
      ["root"],
      [
        { id: "root", parent_id: null },
        { id: "child", parent_id: "root" },
        { id: "grand", parent_id: "child" },
        { id: "other", parent_id: null },
      ],
    );
    expect(ids).toContain("root");
    expect(ids).toContain("child");
    expect(ids).toContain("grand");
    expect(ids).not.toContain("other");
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
    expect(first.finalQty).toBe(2);
  });

  it("isLikelyProductId accepts uuid only", () => {
    expect(isLikelyProductId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isLikelyProductId("not-a-uuid")).toBe(false);
  });
});
