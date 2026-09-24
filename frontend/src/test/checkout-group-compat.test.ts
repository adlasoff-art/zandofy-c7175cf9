import { describe, expect, it } from "vitest";
import {
  evaluateGroupCheckout,
  type CompatStoreInput,
  type CheckoutPaymentFlags,
} from "@/lib/checkout-group-compat";

const onlineFlags = (partial?: Partial<CheckoutPaymentFlags>): CheckoutPaymentFlags => ({
  mobile_money: true,
  card: true,
  paypal: false,
  cod: false,
  off_platform: false,
  whatsapp: false,
  ...partial,
});

const deferredWa: CheckoutPaymentFlags = {
  mobile_money: false,
  card: false,
  paypal: false,
  cod: false,
  off_platform: false,
  whatsapp: true,
};

function store(
  id: string,
  owner: string,
  policy: CompatStoreInput["group_checkout_policy"],
  flags: CheckoutPaymentFlags = onlineFlags(),
  shop_type: string = "international"
): CompatStoreInput {
  return {
    id,
    owner_id: owner,
    shop_type,
    group_checkout_policy: policy,
    paymentFlags: flags,
  };
}

describe("evaluateGroupCheckout", () => {
  it("allows single store with online methods", () => {
    const r = evaluateGroupCheckout([store("a", "o1", "solo_only")]);
    expect(r.ok).toBe(true);
    expect(r.eligiblePaymentMethods).toContain("mobile_money");
  });

  it("blocks empty", () => {
    expect(evaluateGroupCheckout([]).reasonCode).toBe("EMPTY");
  });

  it("blocks multi-store when any solo_only", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "solo_only"),
      store("b", "o2", "multi_vendor_ok"),
    ]);
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("SOLO_ONLY");
    expect(r.blockingStoreIds).toContain("a");
  });

  it("allows own_stores_only same owner", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "own_stores_only"),
      store("b", "o1", "own_stores_only", onlineFlags(), "local"),
    ]);
    expect(r.ok).toBe(true);
    expect(r.reasonCode).toBe("OK");
  });

  it("blocks own_stores_only different owners", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "own_stores_only"),
      store("b", "o2", "own_stores_only"),
    ]);
    expect(r.reasonCode).toBe("OWN_STORES_MISMATCH");
  });

  it("allows multi_vendor_ok across owners including local+intl", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "multi_vendor_ok", onlineFlags(), "local"),
      store("b", "o2", "multi_vendor_ok", onlineFlags(), "international"),
    ]);
    expect(r.ok).toBe(true);
    expect(r.eligiblePaymentMethods).toEqual(
      expect.arrayContaining(["mobile_money", "card"])
    );
  });

  it("blocks multi-vendor when one is only own_stores_only and owners differ", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "own_stores_only"),
      store("b", "o2", "multi_vendor_ok"),
    ]);
    expect(r.ok).toBe(false);
    expect(["OWN_STORES_MISMATCH", "MULTI_VENDOR_REQUIRED"]).toContain(r.reasonCode);
  });

  it("blocks mix WhatsApp-only + MoMo store", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "multi_vendor_ok", deferredWa),
      store("b", "o2", "multi_vendor_ok", onlineFlags()),
    ]);
    expect(r.reasonCode).toBe("MIXED_PAYMENT_MODEL");
  });

  it("intersects payment methods", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "multi_vendor_ok", onlineFlags({ card: false, mobile_money: true })),
      store("b", "o2", "multi_vendor_ok", onlineFlags({ card: true, mobile_money: true })),
    ]);
    expect(r.ok).toBe(true);
    expect(r.eligiblePaymentMethods).toContain("mobile_money");
    expect(r.eligiblePaymentMethods).not.toContain("card");
  });

  it("product default two multi_vendor_ok stores allows group checkout", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "multi_vendor_ok"),
      store("b", "o2", "multi_vendor_ok"),
    ]);
    expect(r.ok).toBe(true);
    expect(r.reasonCode).toBe("OK");
  });

  it("opt-out solo_only still blocks when mixed with multi", () => {
    const r = evaluateGroupCheckout([
      store("a", "o1", "solo_only"),
      store("b", "o2", "multi_vendor_ok"),
    ]);
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("SOLO_ONLY");
  });
});
