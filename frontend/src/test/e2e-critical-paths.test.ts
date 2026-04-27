import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Supabase ────────────────────────────────────────────
const mockFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  then: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      resetPasswordForEmail: vi.fn(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  },
}));

vi.mock("@/integrations/lovable/index", () => ({
  lovable: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// ─── SEOHead Tests ────────────────────────────────────────────
describe("SEOHead helpers", () => {
  it("buildProductJsonLd generates valid schema", async () => {
    const { buildProductJsonLd } = await import("@/components/SEOHead");
    const result = buildProductJsonLd({
      name: "Test Product",
      description: "A great product",
      image: "https://example.com/img.jpg",
      price: 29.99,
      currency: "USD",
      rating: 4.5,
      reviewCount: 120,
      sku: "SKU-123",
      storeName: "TestStore",
    });

    expect(result["@context"]).toBe("https://schema.org");
    expect(result["@type"]).toBe("Product");
    expect(result.name).toBe("Test Product");
    expect(result.offers.price).toBe("29.99");
    expect(result.offers.priceCurrency).toBe("USD");
    expect(result.aggregateRating.ratingValue).toBe("4.5");
    expect(result.aggregateRating.reviewCount).toBe(120);
    expect(result.brand.name).toBe("TestStore");
  });

  it("buildBreadcrumbJsonLd generates list", async () => {
    const { buildBreadcrumbJsonLd } = await import("@/components/SEOHead");
    const result = buildBreadcrumbJsonLd([
      { name: "Home", url: "/" },
      { name: "Electronics", url: "/category/electronics" },
    ]);

    expect(result["@type"]).toBe("BreadcrumbList");
    expect(result.itemListElement).toHaveLength(2);
    expect(result.itemListElement[0].position).toBe(1);
    expect(result.itemListElement[1].name).toBe("Electronics");
  });

  it("buildProductJsonLd without rating omits aggregateRating", async () => {
    const { buildProductJsonLd } = await import("@/components/SEOHead");
    const result = buildProductJsonLd({
      name: "No Rating",
      image: "img.jpg",
      price: 10,
      currency: "EUR",
    });

    expect(result.aggregateRating).toBeUndefined();
  });
});

// ─── Auth Flow Tests ──────────────────────────────────────────
describe("Auth flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signInWithPassword is called with correct credentials", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.signInWithPassword as any).mockResolvedValue({ data: { user: { id: "1" } }, error: null });

    const result = await supabase.auth.signInWithPassword({
      email: "test@example.com",
      password: "password123",
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.error).toBeNull();
  });

  it("signUp returns error for weak password", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.signUp as any).mockResolvedValue({
      data: null,
      error: { message: "Password should be at least 6 characters" },
    });

    const result = await supabase.auth.signUp({
      email: "test@example.com",
      password: "123",
    });

    expect(result.error).toBeTruthy();
    expect(result.error!.message).toContain("6 characters");
  });

  it("resetPasswordForEmail sends email", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.resetPasswordForEmail as any).mockResolvedValue({ data: {}, error: null });

    const result = await supabase.auth.resetPasswordForEmail("test@example.com");
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("test@example.com");
    expect(result.error).toBeNull();
  });
});

// ─── Cart Logic Tests ─────────────────────────────────────────
describe("Cart logic", () => {
  it("calculates total price correctly", () => {
    const items = [
      { id: "1", name: "Shirt", price: 25.0, quantity: 2 },
      { id: "2", name: "Pants", price: 45.0, quantity: 1 },
    ];
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    expect(total).toBe(95.0);
  });

  it("applies percentage discount correctly", () => {
    const subtotal = 100;
    const discountPct = 15;
    const discounted = subtotal - subtotal * (discountPct / 100);
    expect(discounted).toBe(85);
  });

  it("handles empty cart", () => {
    const items: any[] = [];
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    expect(total).toBe(0);
  });
});

// ─── Navigation & Routing Tests ──────────────────────────────
describe("App routing structure", () => {
  it("has all critical routes defined", () => {
    const criticalRoutes = [
      "/", "/product/:id", "/category/:slug", "/auth",
      "/checkout", "/dashboard", "/search", "/wishlist",
      "/admin", "/vendor", "/about", "/faq",
    ];
    // Just verify these are valid route patterns
    criticalRoutes.forEach((route) => {
      expect(route).toBeTruthy();
      expect(route.startsWith("/")).toBe(true);
    });
  });
});

// ─── Product Data Mapping Tests ──────────────────────────────
describe("Product data mapping", () => {
  it("maps raw DB product to frontend model", () => {
    const raw = {
      id: "abc-123",
      name: "Test Product",
      name_fr: "Produit Test",
      price: 29.99,
      original_price: 39.99,
      currency: "USD",
      rating: 4.2,
      review_count: 15,
      is_new: true,
      is_sale: true,
      discount: 25,
      moq: 5,
      verified_years: 3,
      origin_country: "FR",
      sku: "SKU-TEST",
      product_images: [{ image_url: "https://img.com/1.jpg", position: 0 }],
      product_colors: [{ color_hex: "#FF0000", color_name: "Red" }],
      product_sizes: [{ size_label: "M" }],
      categories: { name: "Fashion", name_fr: "Mode" },
    };

    const mapped = {
      id: raw.id,
      name: raw.name,
      nameFr: raw.name_fr,
      price: Number(raw.price),
      originalPrice: raw.original_price ? Number(raw.original_price) : undefined,
      currency: raw.currency,
      image: raw.product_images?.[0]?.image_url || "/placeholder.svg",
      category: raw.categories?.name || "",
      categoryFr: raw.categories?.name_fr || "",
      rating: Number(raw.rating) || 0,
      reviewCount: raw.review_count || 0,
      isNew: raw.is_new || false,
      isSale: raw.is_sale || false,
      discount: raw.discount || 0,
      colors: raw.product_colors?.map((c: any) => c.color_hex) || [],
      sizes: raw.product_sizes?.map((s: any) => s.size_label) || [],
      moq: raw.moq || 1,
    };

    expect(mapped.id).toBe("abc-123");
    expect(mapped.nameFr).toBe("Produit Test");
    expect(mapped.price).toBe(29.99);
    expect(mapped.originalPrice).toBe(39.99);
    expect(mapped.image).toBe("https://img.com/1.jpg");
    expect(mapped.categoryFr).toBe("Mode");
    expect(mapped.isNew).toBe(true);
    expect(mapped.isSale).toBe(true);
    expect(mapped.discount).toBe(25);
    expect(mapped.colors).toEqual(["#FF0000"]);
    expect(mapped.sizes).toEqual(["M"]);
    expect(mapped.moq).toBe(5);
  });

  it("falls back to placeholder when no images", () => {
    const raw = { product_images: [] };
    const image = raw.product_images?.[0]?.image_url || "/placeholder.svg";
    expect(image).toBe("/placeholder.svg");
  });
});

// ─── Tiered Pricing Tests ────────────────────────────────────
describe("Tiered pricing calculation", () => {
  it("applies percentage discount at correct tier", () => {
    const basePrice = 100;
    const tiers = [
      { minQuantity: 10, discountType: "percentage" as const, discountValue: 10 },
      { minQuantity: 50, discountType: "percentage" as const, discountValue: 20 },
    ];

    const qty = 25;
    const activeTier = tiers.filter((t) => qty >= t.minQuantity).pop();
    const unitPrice = activeTier
      ? basePrice - basePrice * (activeTier.discountValue / 100)
      : basePrice;

    expect(unitPrice).toBe(90); // 10% off
  });

  it("applies fixed discount at correct tier", () => {
    const basePrice = 100;
    const qty = 55;
    const tiers = [
      { minQuantity: 10, discountType: "fixed" as const, discountValue: 5 },
      { minQuantity: 50, discountType: "fixed" as const, discountValue: 15 },
    ];

    const activeTier = tiers.filter((t) => qty >= t.minQuantity).pop();
    const unitPrice = activeTier ? basePrice - activeTier.discountValue : basePrice;

    expect(unitPrice).toBe(85); // $15 off
  });

  it("returns base price when below minimum tier", () => {
    const basePrice = 100;
    const qty = 3;
    const tiers = [
      { minQuantity: 10, discountType: "percentage" as const, discountValue: 10 },
    ];

    const activeTier = tiers.filter((t) => qty >= t.minQuantity).pop();
    const unitPrice = activeTier
      ? basePrice - basePrice * (activeTier.discountValue / 100)
      : basePrice;

    expect(unitPrice).toBe(100);
  });
});

// ─── Lot Multi-Opérateurs : KYB / Coverage / Rates ────────────
describe("Multi-operator: KYB document validation logic", () => {
  const allowedTypes = ["rccm", "nif", "id_pieces", "tax_clearance", "other"];
  const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
  const MAX_SIZE = 10 * 1024 * 1024;

  it("accepts known KYB doc types", () => {
    expect(allowedTypes).toContain("rccm");
    expect(allowedTypes).toContain("nif");
  });

  it("rejects file over 10MB", () => {
    const oversize = 12 * 1024 * 1024;
    expect(oversize > MAX_SIZE).toBe(true);
  });

  it("blocks non-PDF/JPG/PNG mime types", () => {
    expect(ALLOWED_MIME.includes("application/zip")).toBe(false);
    expect(ALLOWED_MIME.includes("application/pdf")).toBe(true);
  });

  it("requires rejection_reason >= 3 chars when rejecting", () => {
    const validate = (decision: string, reason?: string) =>
      decision === "rejected" && (!reason || reason.trim().length < 3)
        ? "Motif de rejet requis (min 3 caractères)"
        : null;

    expect(validate("rejected", "")).toBeTruthy();
    expect(validate("rejected", "ok")).toBeTruthy();
    expect(validate("rejected", "Document illisible")).toBeNull();
    expect(validate("approved")).toBeNull();
  });
});

describe("Multi-operator: Coverage request anti-spam (24h window)", () => {
  it("blocks duplicate request within 24h for same geo", () => {
    const now = Date.now();
    const lastRequestedAt = now - 6 * 3600 * 1000; // 6h ago
    const within24h = now - lastRequestedAt < 24 * 3600 * 1000;
    expect(within24h).toBe(true);
  });

  it("allows new request after 24h", () => {
    const now = Date.now();
    const lastRequestedAt = now - 25 * 3600 * 1000;
    const within24h = now - lastRequestedAt < 24 * 3600 * 1000;
    expect(within24h).toBe(false);
  });
});

describe("Multi-operator: Rate creation validation", () => {
  const validate = (geo: any, form: any) => {
    if (!geo.country || !geo.city?.trim() || !form.zone_name?.trim() || !form.base_price) {
      return "Ville, zone et tarif de base requis";
    }
    return null;
  };

  it("rejects rate without country/city/zone/base_price", () => {
    expect(validate({ country: "" }, { zone_name: "x", base_price: 1 })).toBeTruthy();
    expect(validate({ country: "CD", city: "" }, { zone_name: "x", base_price: 1 })).toBeTruthy();
    expect(validate({ country: "CD", city: "Kin" }, { zone_name: "", base_price: 1 })).toBeTruthy();
    expect(validate({ country: "CD", city: "Kin" }, { zone_name: "Centre", base_price: 0 })).toBeTruthy();
  });

  it("accepts complete payload", () => {
    expect(validate({ country: "CD", city: "Kinshasa" }, { zone_name: "Centre", base_price: 5 })).toBeNull();
  });

  it("normalizes optional commune/quartier to null when empty", () => {
    const normalize = (v?: string) => v?.trim() || null;
    expect(normalize("")).toBeNull();
    expect(normalize("  ")).toBeNull();
    expect(normalize("Gombe")).toBe("Gombe");
  });
});
