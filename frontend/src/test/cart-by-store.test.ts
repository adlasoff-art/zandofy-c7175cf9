import { describe, expect, it } from "vitest";
import {
  groupCartByStore,
  selectedSpansMultipleStores,
  uniqueSelectedStoreId,
} from "@/lib/cart-by-store";
import { pickPrimaryProfileGap } from "@/components/ProfileCompletionBanner";

describe("cart-by-store", () => {
  const lines = [
    {
      id: "1",
      productId: "p1",
      storeId: "s1",
      storeName: "A",
      selected: true,
      price: 10,
      quantity: 2,
    },
    {
      id: "2",
      productId: "p2",
      storeId: "s1",
      storeName: "A",
      selected: false,
      price: 5,
      quantity: 1,
    },
    {
      id: "3",
      productId: "p3",
      storeId: "s2",
      storeName: "B",
      selected: true,
      price: 7,
      quantity: 1,
    },
  ];

  it("groups by store", () => {
    const groups = groupCartByStore(lines);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.storeId === "s1")?.selectedSubtotal).toBe(20);
  });

  it("detects multi-store selection", () => {
    expect(selectedSpansMultipleStores(lines)).toBe(true);
    expect(
      selectedSpansMultipleStores(lines.map((l) => ({ ...l, selected: l.storeId === "s1" })))
    ).toBe(false);
  });

  it("uniqueSelectedStoreId", () => {
    expect(uniqueSelectedStoreId(lines)).toBeNull();
    expect(
      uniqueSelectedStoreId([
        { ...lines[0], selected: true },
        { ...lines[1], selected: true },
        { ...lines[2], selected: false },
      ])
    ).toBe("s1");
  });
});

describe("profile gaps", () => {
  it("prioritizes email over address and kyc", () => {
    expect(pickPrimaryProfileGap(["need_kyc", "need_email", "need_address"])).toBe(
      "need_email"
    );
    expect(pickPrimaryProfileGap(["need_kyc"])).toBe("need_kyc");
    expect(pickPrimaryProfileGap([])).toBeNull();
  });
});
