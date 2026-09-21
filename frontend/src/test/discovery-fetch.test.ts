import { describe, expect, it } from "vitest";
import {
  discoveryShopTypeFilter,
  mergeProductPools,
  prefersLocalDiscoveryScope,
} from "@/lib/discovery-fetch";

describe("discovery-fetch", () => {
  it("prefers local for city/country when completed", () => {
    expect(discoveryShopTypeFilter(true, "city", undefined)).toBe("local");
    expect(discoveryShopTypeFilter(true, "country", "international")).toBe("local");
    expect(prefersLocalDiscoveryScope(true, "city")).toBe(true);
  });

  it("opens market for any_country or incomplete", () => {
    expect(discoveryShopTypeFilter(true, "any_country", "local")).toBeUndefined();
    expect(discoveryShopTypeFilter(false, "city", "international")).toBe("international");
    expect(prefersLocalDiscoveryScope(false, "city")).toBe(false);
  });

  it("merges pools without duplicates", () => {
    const a = [{ id: "1" }, { id: "2" }];
    const b = [{ id: "2" }, { id: "3" }];
    expect(mergeProductPools(a, b).map((p) => p.id)).toEqual(["1", "2", "3"]);
  });
});
