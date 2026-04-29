import { describe, it, expect } from "vitest";
import {
  round2,
  volumetricWeightKg,
  chargeableWeightKg,
  pickCbmTier,
  pickPieceTier,
  quoteByCBM,
  quoteByPiece,
  composeFreightQuote,
  quoteByKgTier,
  type FreightProfile,
  type CbmTier,
  type PieceTier,
  type KgTier,
} from "../freightQuote";

const baseProfile: FreightProfile = {
  id: "prof-1",
  forwarder_id: "fw-1",
  mode: "air",
  service_class: "standard",
  country_code: "CD",
  city_id: null,
  currency: "USD",
  deposit_pct: 30,
  deposit_threshold_cbm: 1,
  volumetric_divisor: 6000,
  transit_min_days: 5,
  transit_max_days: 10,
  is_active: true,
  linked_transporter_user_id: null,
};

const cbmTiers: CbmTier[] = [
  { id: "t1", profile_id: "prof-1", min_cbm: 0, max_cbm: 1, price_per_cbm: 800, unit: "cbm", is_quote_only: false, sort_order: 1 },
  { id: "t2", profile_id: "prof-1", min_cbm: 1, max_cbm: 5, price_per_cbm: 600, unit: "cbm", is_quote_only: false, sort_order: 2 },
  { id: "t3", profile_id: "prof-1", min_cbm: 5, max_cbm: null, price_per_cbm: null, unit: "cbm", is_quote_only: true, sort_order: 3 },
];

const pieceTiers: PieceTier[] = [
  { id: "p1", profile_id: "prof-1", category_id: "cat-phones", custom_label: "Téléphone", min_quantity: 1, price: 25, pricing_unit: "piece", includes_customs: true, sort_order: 1 },
  { id: "p2", profile_id: "prof-1", category_id: "cat-phones", custom_label: "Téléphone", min_quantity: 50, price: 18, pricing_unit: "piece", includes_customs: true, sort_order: 2 },
];

describe("freightQuote — helpers", () => {
  it("round2 arrondit correctement", () => {
    expect(round2(19.999)).toBe(20);
    expect(round2(19.994)).toBe(19.99);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("volumetricWeightKg applique le diviseur", () => {
    expect(volumetricWeightKg(0.012, 6000)).toBe(2);
    expect(volumetricWeightKg(1, 6000)).toBeCloseTo(166.67, 1);
    expect(volumetricWeightKg(1, 0)).toBe(0);
  });

  it("chargeableWeightKg prend le max", () => {
    // 0.012 cbm @ 6000 = 2 kg volumétrique ; réel 5 kg → 5
    expect(chargeableWeightKg(5, 0.012, 6000)).toBe(5);
    // réel 1 kg, volumétrique 2 kg → 2
    expect(chargeableWeightKg(1, 0.012, 6000)).toBe(2);
    // sans diviseur → poids réel
    expect(chargeableWeightKg(3, 0.5, null)).toBe(3);
  });
});

describe("freightQuote — pickCbmTier", () => {
  it("trouve le bon palier pour un volume intermédiaire", () => {
    expect(pickCbmTier(cbmTiers, 0.5)?.id).toBe("t1");
    expect(pickCbmTier(cbmTiers, 1)?.id).toBe("t2");
    expect(pickCbmTier(cbmTiers, 4.99)?.id).toBe("t2");
    expect(pickCbmTier(cbmTiers, 5)?.id).toBe("t3");
    expect(pickCbmTier(cbmTiers, 50)?.id).toBe("t3");
  });

  it("retourne null si aucun palier ne couvre le volume", () => {
    expect(pickCbmTier([cbmTiers[0]], 10)).toBeNull();
  });
});

describe("freightQuote — pickPieceTier", () => {
  it("matche par category_id et prend le palier de quantité le plus haut éligible", () => {
    const res = pickPieceTier(pieceTiers, { category_id: "cat-phones", quantity: 60 });
    expect(res?.id).toBe("p2"); // 60 ≥ 50
  });

  it("tombe sur le palier de base si quantité < seuil dégressif", () => {
    const res = pickPieceTier(pieceTiers, { category_id: "cat-phones", quantity: 10 });
    expect(res?.id).toBe("p1");
  });

  it("matche par custom_label si pas de category", () => {
    const res = pickPieceTier(pieceTiers, { custom_label: "téléphone", quantity: 5 });
    expect(res?.id).toBe("p1");
  });

  it("retourne null si aucun match", () => {
    expect(pickPieceTier(pieceTiers, { category_id: "cat-other", quantity: 5 })).toBeNull();
  });
});

describe("freightQuote — quoteByCBM", () => {
  it("calcule le total CBM × prix unitaire", () => {
    const line = quoteByCBM(baseProfile, cbmTiers, 2);
    expect(line?.line_total).toBe(1200); // 2 × 600
    expect(line?.quote_only).toBeFalsy();
  });

  it("renvoie quote_only sans prix pour palier sur devis", () => {
    const line = quoteByCBM(baseProfile, cbmTiers, 8);
    expect(line?.quote_only).toBe(true);
    expect(line?.line_total).toBe(0);
  });

  it("renvoie null pour CBM ≤ 0", () => {
    expect(quoteByCBM(baseProfile, cbmTiers, 0)).toBeNull();
  });
});

describe("freightQuote — quoteByPiece", () => {
  it("génère une ligne par item matché", () => {
    const lines = quoteByPiece(pieceTiers, [
      { category_id: "cat-phones", quantity: 100 },
      { category_id: "cat-other", quantity: 10 }, // ignoré
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].line_total).toBe(1800); // 100 × 18
    expect(lines[0].includes_customs).toBe(true);
  });
});

describe("freightQuote — composeFreightQuote", () => {
  it("compose CBM + pièces et calcule le deposit au-dessus du seuil", () => {
    const res = composeFreightQuote(baseProfile, cbmTiers, pieceTiers, [
      { category_id: "cat-phones", quantity: 100, cbm: 0.02 }, // 2 cbm total
    ]);
    expect(res.total_cbm).toBe(2);
    // CBM line: 2 × 600 = 1200 ; piece line: 100 × 18 = 1800
    expect(res.total).toBe(3000);
    expect(res.deposit_required).toBe(true);
    expect(res.deposit_amount).toBe(900); // 30% de 3000
    expect(res.lines).toHaveLength(2);
  });

  it("ne déclenche pas de deposit sous le seuil", () => {
    const res = composeFreightQuote(baseProfile, cbmTiers, pieceTiers, [
      { category_id: "cat-phones", quantity: 5, cbm: 0.05 }, // 0.25 cbm
    ]);
    expect(res.total_cbm).toBe(0.25);
    expect(res.deposit_required).toBe(false);
    expect(res.deposit_amount).toBe(0);
  });

  it("ajoute un warning quand le palier CBM est sur devis", () => {
    const res = composeFreightQuote(baseProfile, cbmTiers, pieceTiers, [], { totalCbm: 10 });
    expect(res.warnings).toContain("Hors grille tarifaire — devis manuel requis.");
  });

  it("calcule le poids facturable (max réel/volumétrique)", () => {
    const res = composeFreightQuote(baseProfile, cbmTiers, pieceTiers, [], {
      totalCbm: 0.024,
      totalWeightKg: 3,
    });
    // volumétrique = 0.024 × 1_000_000 / 6000 = 4 kg → max(3,4) = 4
    expect(res.total_chargeable_weight_kg).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Règle Zandofy : forfait <1 kg + buffer 100 g au-dessus
// (cf. plan : Very Speed à 17,90 USD pour 540 g, pas 20,58 USD)
// ─────────────────────────────────────────────────────────────────────────────

const verySpeedKgTiers: KgTier[] = [
  { id: "k1", profile_id: "prof-1", min_kg: 0, max_kg: 1, price_per_kg: 17.9, flat_price: null, round_up_to_kg: true, is_quote_only: false, sort_order: 1 },
  { id: "k2", profile_id: "prof-1", min_kg: 1, max_kg: null, price_per_kg: 17.9, flat_price: null, round_up_to_kg: false, is_quote_only: false, sort_order: 2 },
];

describe("freightQuote — quoteByKgTier (règle Zandofy)", () => {
  it("Cas A : 0,540 kg sans CBM → forfait 17,90", () => {
    const line = quoteByKgTier(baseProfile, verySpeedKgTiers, 0, 0.54);
    expect(line?.line_total).toBe(17.9);
    expect(line?.weight_kg).toBe(1);
  });

  it("Cas A : 0,540 kg AVEC CBM gonflant le volumétrique → toujours forfait 17,90 (régression)", () => {
    // 0.008 cbm × 1_000_000 / 6000 = 1.33 kg volumétrique → avant fix : Cas B → 20,58
    const line = quoteByKgTier(baseProfile, verySpeedKgTiers, 0.008, 0.54);
    expect(line?.line_total).toBe(17.9);
  });

  it("Cas A : 0,999 kg → forfait 17,90", () => {
    const line = quoteByKgTier(baseProfile, verySpeedKgTiers, 0, 0.999);
    expect(line?.line_total).toBe(17.9);
  });

  it("Cas B : 1,000 kg → 1,1 × 17,90 = 19,69", () => {
    const line = quoteByKgTier(baseProfile, verySpeedKgTiers, 0, 1.0);
    expect(line?.line_total).toBe(19.69);
  });

  it("Cas B : 1,200 kg → 1,3 × 17,90 = 23,27", () => {
    const line = quoteByKgTier(baseProfile, verySpeedKgTiers, 0, 1.2);
    expect(line?.line_total).toBe(23.27);
  });

  it("Cas B : 4 articles × 250 g (totalWeightKg=1.0) → 19,69", () => {
    const line = quoteByKgTier(baseProfile, verySpeedKgTiers, 0, 1.0);
    expect(line?.line_total).toBe(19.69);
  });
});