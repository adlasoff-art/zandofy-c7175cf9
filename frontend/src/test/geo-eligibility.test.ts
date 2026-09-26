import { describe, expect, it } from "vitest";
import {
  computeGeoRelation,
  filterEligibleIds,
  type EligibilityResult,
} from "@/lib/geo-eligibility";

describe("computeGeoRelation", () => {
  it("detects same_city", () => {
    expect(
      computeGeoRelation({
        originCountry: "CD",
        originCityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        destCountry: "CD",
        destCityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    ).toBe("same_city");
  });

  it("detects same_country_other_city", () => {
    expect(
      computeGeoRelation({
        originCountry: "BJ",
        originCityId: "11111111-1111-4111-8111-111111111111",
        destCountry: "bj",
        destCityId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBe("same_country_other_city");
  });

  it("detects cross_border", () => {
    expect(
      computeGeoRelation({
        originCountry: "BJ",
        originCityId: null,
        destCountry: "CD",
        destCityId: null,
      }),
    ).toBe("cross_border");
  });
});

describe("filterEligibleIds", () => {
  it("passes all when not enforced", () => {
    const map = new Map<string, EligibilityResult>([["a", { eligible: false }]]);
    expect(filterEligibleIds(["a", "b"], map, false)).toEqual(["a", "b"]);
  });

  it("drops ineligible when enforced", () => {
    const map = new Map<string, EligibilityResult>([
      ["a", { eligible: false }],
      ["b", { eligible: true }],
    ]);
    expect(filterEligibleIds(["a", "b", "c"], map, true)).toEqual(["b", "c"]);
  });
});
