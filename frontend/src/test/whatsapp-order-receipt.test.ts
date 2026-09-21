import { describe, expect, it } from "vitest";
import { buildWhatsAppOrderReceiptMessage } from "@/lib/whatsapp-order-receipt";

describe("whatsapp-order-receipt", () => {
  it("builds a stable FR receipt with ref, lines, total, phone", () => {
    const msg = buildWhatsAppOrderReceiptMessage({
      orderRef: "ZF-TEST-001",
      storeName: "Boutique Demo",
      lines: [
        { name: "Robe wax", quantity: 2, variant: "M / Rouge", unitPrice: 25 },
        { name: "Ceinture", quantity: 1, unitPrice: 10 },
      ],
      total: 60,
      currencyLabel: "USD",
      customerPhone: "+243800000000",
      customerName: "Jean",
      dashboardUrl: "https://www.zandofy.com/dashboard?tab=orders",
      locale: "fr",
    });
    expect(msg).toContain("ZF-TEST-001");
    expect(msg).toContain("Robe wax");
    expect(msg).toContain("+243800000000");
    expect(msg).toContain("60");
    expect(msg).toContain("en attente de confirmation");
    expect(msg).not.toContain("Kinshasa"); // no address dump
  });

  it("truncates long product names and caps line count", () => {
    const long = "A".repeat(80);
    const lines = Array.from({ length: 15 }, (_, i) => ({
      name: `${long}-${i}`,
      quantity: 1,
    }));
    const msg = buildWhatsAppOrderReceiptMessage({
      orderRef: "ZF-2",
      lines,
      total: 1,
      locale: "fr",
      dashboardUrl: "https://example.com/dashboard?tab=orders",
    });
    expect(msg).toContain("…");
    expect(msg).toMatch(/\+3 autres/);
  });
});
