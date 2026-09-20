import { describe, expect, it } from "vitest";
import {
  discoveryPrefToCheckoutMethod,
  normalizePaymentGateways,
  resolveMomoGateway,
} from "@/lib/payment-gateways";

describe("payment-gateways", () => {
  it("defaults to kelpay when pawapay disabled", () => {
    expect(resolveMomoGateway("ZM", { by_country: { ZM: "pawapay" }, pawapay: { enabled: false } })).toBe(
      "kelpay",
    );
  });

  it("uses pawapay when enabled and mapped", () => {
    expect(
      resolveMomoGateway("ZM", {
        default_momo: "kelpay",
        by_country: { ZM: "pawapay" },
        pawapay: { enabled: true },
      }),
    ).toBe("pawapay");
  });

  it("maps discovery prefs", () => {
    expect(discoveryPrefToCheckoutMethod("mobile_money")).toBe("mobile_money");
    expect(discoveryPrefToCheckoutMethod("later")).toBeNull();
  });

  it("normalizes config", () => {
    const n = normalizePaymentGateways({ default_momo: "pawapay", pawapay: { enabled: true } });
    expect(n.default_momo).toBe("pawapay");
    expect(n.pawapay.enabled).toBe(true);
  });
});
