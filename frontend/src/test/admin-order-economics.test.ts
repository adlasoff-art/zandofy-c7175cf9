import { describe, expect, it } from "vitest";
import { calculateAdminOrderEconomics } from "@/lib/admin-order-economics";
import { DEFAULT_GATEWAY_FEES } from "@/lib/gateway-fees";

describe("admin order economics", () => {
  it("uses subtotal and deducts gateway plus commission for gateway payments", () => {
    expect(calculateAdminOrderEconomics({
      subtotal: 100,
      status: "delivered",
      paymentMethod: "mobile_money",
      storeCommissionPct: 10,
    }, DEFAULT_GATEWAY_FEES)).toEqual({
      gmv: 100,
      gatewayFees: 2.5,
      platformCommission: 10,
      netVendor: 87.5,
    });
  });

  it.each(["off_platform", "whatsapp", "cod"])("does not charge %s orders", (paymentMethod) => {
    expect(calculateAdminOrderEconomics({
      subtotal: 100,
      status: "delivered",
      paymentMethod,
      storeCommissionPct: 10,
    }, DEFAULT_GATEWAY_FEES)).toEqual({
      gmv: 100,
      gatewayFees: 0,
      platformCommission: 0,
      netVendor: 100,
    });
  });

  it.each(["awaiting_payment", "cancelled", "returned", "refunded", "payment_failed"])(
    "excludes non-revenue status %s",
    (status) => {
      expect(calculateAdminOrderEconomics({
        subtotal: 100,
        status,
        paymentMethod: "card",
        storeCommissionPct: 10,
      }, DEFAULT_GATEWAY_FEES)).toEqual({
        gmv: 0,
        gatewayFees: 0,
        platformCommission: 0,
        netVendor: 0,
      });
    },
  );
});
