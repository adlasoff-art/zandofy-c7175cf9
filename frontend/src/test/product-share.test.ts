import { describe, it, expect } from "vitest";
import {
  buildProductShareMessage,
  formatShareUnitPrice,
  formatShareWeight,
  filterSharePaymentNumbers,
} from "@/lib/product-share";

describe("product-share", () => {
  it("rounds strategic prices for WhatsApp", () => {
    expect(formatShareUnitPrice(6.99)).toBe("$7");
    expect(formatShareUnitPrice(5.99)).toBe("$6");
  });

  it("formats weight in g and kg", () => {
    expect(formatShareWeight(400)).toBe("400 g");
    expect(formatShareWeight(1200)).toBe("1.2 kg");
  });

  it("filters share payment operators and skips empty / afrimoney", () => {
    const filtered = filterSharePaymentNumbers([
      { operator: "orange_money", operator_label: "Orange Money", phone_number: "0850705236" },
      { operator: "mpesa", operator_label: "M-Pesa", phone_number: "" },
      { operator: "airtel_money", operator_label: "Airtel Money", phone_number: "0981227357" },
      { operator: "afrimoney", operator_label: "AfriMoney", phone_number: "0999999999" },
    ]);
    expect(filtered.map((n) => n.operator)).toEqual(["orange_money", "airtel_money"]);
  });

  it("builds commercial WhatsApp template with MOQ totals", () => {
    const msg = buildProductShareMessage({
      productName: "Longue chemise à carreaux pour femmes",
      storeName: "Zan Bao Fashion",
      storeUrl: "https://zandofy.com/store/zan-bao-fashion",
      unitPrice: 6.99,
      productUrl: "https://zandofy.com/product/chemise-carreaux",
      moq: 3,
      colorOptions: [],
      apparelSizes: ["M", "L", "XL", "2XL", "3XL"],
      dynamicVariants: [],
      weightGrams: 400,
      paymentNumbers: [
        { operator: "orange_money", operator_label: "Orange Money", phone_number: "0850705236" },
        { operator: "mpesa", operator_label: "M-Pesa", phone_number: "0822165157" },
        { operator: "airtel_money", operator_label: "Airtel Money", phone_number: "0981227357" },
      ],
      chinaWhatsAppNumber: "+447832621129",
    });

    expect(msg).toContain("👉 *Longue chemise à carreaux pour femmes*");
    expect(msg).toContain("🏪 Zan Bao Fashion");
    expect(msg).toContain("🔗 https://zandofy.com/store/zan-bao-fashion");
    expect(msg).toContain("• *MOQ* : 3");
    expect(msg).toContain("• *1 pièce* : $7");
    expect(msg).toContain("• *3 pièces* : $21");
    expect(msg).toContain("• *Poids 1 pièce* : 400 g");
    expect(msg).toContain("• *Poids MOQ (3)* : 1.2 kg");
    expect(msg).toContain("• *taille* : m, l, xl, 2xl, 3xl");
    expect(msg).toContain("*Numéro de commandes*");
    expect(msg).toContain("🟠 *0850705236* (Orange Money)");
    expect(msg).toContain("👉 https://zandofy.com/product/chemise-carreaux");
    expect(msg).toContain("+447832621129");
    expect(msg).toContain("Merci de faire confiance à Zandofy");
    expect(msg).not.toContain("https://zandofy.com/\n");
  });
});
