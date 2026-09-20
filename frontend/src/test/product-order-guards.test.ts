import { describe, expect, it } from "vitest";
import {
  ACTIVE_ORDER_STATUSES,
  deleteBlockedMessage,
  isActiveOrderStatus,
  priceLockedMessage,
} from "@/lib/product-order-guards";

describe("product-order-guards", () => {
  it("treats preparing/shipped/awaiting_payment as active and delivered as not", () => {
    expect(isActiveOrderStatus("preparing")).toBe(true);
    expect(isActiveOrderStatus("shipped")).toBe(true);
    expect(isActiveOrderStatus("awaiting_payment")).toBe(true);
    expect(isActiveOrderStatus("delivered")).toBe(false);
    expect(isActiveOrderStatus("cancelled")).toBe(false);
  });

  it("exposes price-lock statuses including awaiting_payment", () => {
    expect(ACTIVE_ORDER_STATUSES).toContain("pending");
    expect(ACTIVE_ORDER_STATUSES).toContain("ready_for_pickup");
    expect(ACTIVE_ORDER_STATUSES).not.toContain("delivered");
  });

  it("returns clear price lock copy when active", () => {
    expect(priceLockedMessage(true)).toMatch(/verrouillé/i);
    expect(priceLockedMessage(false)).toBe("");
  });

  it("returns delete messages distinguishing active vs history", () => {
    expect(deleteBlockedMessage(true)).toMatch(/en cours/i);
    expect(deleteBlockedMessage(false)).toMatch(/déjà commandé/i);
  });
});
