/**
 * freightQuote.ts — Service de quote unifié (lecture seule, calculs purs côté client)
 *
 * Lit les profils tarifaires (`forwarder_pricing_profiles`) + leurs paliers
 * (`forwarder_cbm_tiers`, `forwarder_piece_tiers`) et calcule des devis sans
 * appel RPC. Complémentaire de `forwarder-pricing.ts` qui délègue le calcul
 * au serveur via le RPC `quote_forwarder`.
 *
 * Usage prévu : preview instantané dans l'admin, tests unitaires, et
 * préparation du Lot 4 (branchement checkout).
 *
 * ⚠️ Ne JAMAIS utiliser pour facturer : le RPC serveur reste la source de
 * vérité (cohérence, RLS, anti-fraude). Ici on fait du calcul indicatif.
 */
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FreightMode = "air" | "sea" | "road" | "rail" | string;
export type ServiceClass = "express" | "standard" | "economy" | "vip" | string;

export interface FreightProfile {
  id: string;
  forwarder_id: string;
  mode: FreightMode;
  service_class: ServiceClass;
  country_code: string;
  city_id: string | null;
  currency: string;
  deposit_pct: number;
  deposit_threshold_cbm: number | null;
  volumetric_divisor: number | null;
  transit_min_days: number | null;
  transit_max_days: number | null;
  is_active: boolean;
  linked_transporter_user_id: string | null;
}

export interface CbmTier {
  id: string;
  profile_id: string;
  min_cbm: number;
  max_cbm: number | null;
  price_per_cbm: number | null;
  unit: string;
  is_quote_only: boolean;
  sort_order: number;
}

export interface KgTier {
  id: string;
  profile_id: string;
  min_kg: number;
  max_kg: number | null;
  price_per_kg: number | null;
  flat_price: number | null;
  round_up_to_kg: boolean;
  is_quote_only: boolean;
  sort_order: number;
}

export interface PieceTier {
  id: string;
  profile_id: string;
  category_id: string | null;
  custom_label: string | null;
  min_quantity: number;
  price: number;
  pricing_unit: string;
  includes_customs: boolean;
  sort_order: number;
}

export interface FreightItem {
  category_id?: string | null;
  custom_label?: string | null;
  quantity: number;
  cbm?: number;
  weight_kg?: number;
}

export interface QuoteLine {
  type: "cbm" | "piece" | "weight" | "info";
  label: string;
  unit?: string;
  unit_price?: number;
  quantity?: number;
  cbm?: number;
  weight_kg?: number;
  line_total: number;
  quote_only?: boolean;
  includes_customs?: boolean;
}

export interface FreightQuoteResult {
  profile_id: string;
  currency: string;
  total: number;
  total_cbm: number;
  total_chargeable_weight_kg: number;
  lines: QuoteLine[];
  deposit_required: boolean;
  deposit_pct: number;
  deposit_amount: number;
  transit_min_days: number | null;
  transit_max_days: number | null;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de calcul (purs, testables)
// ─────────────────────────────────────────────────────────────────────────────

/** Arrondi à 2 décimales (évite les flottants type 19.999999). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Poids volumétrique = (CBM × 1_000_000) / divisor.
 * Conventions usuelles :
 *   - aérien : 6000
 *   - express : 5000
 *   - maritime : 1000 (rare, souvent CBM direct)
 */
export function volumetricWeightKg(cbm: number, divisor: number): number {
  if (!divisor || divisor <= 0) return 0;
  return round2((cbm * 1_000_000) / divisor);
}

/** Poids facturable = max(poids réel, poids volumétrique). */
export function chargeableWeightKg(realKg: number, cbm: number, divisor: number | null): number {
  if (!divisor) return round2(realKg);
  return round2(Math.max(realKg, volumetricWeightKg(cbm, divisor)));
}

/**
 * Trouve le palier CBM applicable pour un volume donné.
 * Les paliers sont ordonnés par `sort_order` puis `min_cbm`.
 * Le dernier palier sans `max_cbm` capture les volumes au-dessus.
 */
export function pickCbmTier(tiers: CbmTier[], cbm: number): CbmTier | null {
  const sorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order || a.min_cbm - b.min_cbm);
  for (const t of sorted) {
    const matchesMin = cbm >= t.min_cbm;
    const matchesMax = t.max_cbm == null || cbm < t.max_cbm;
    if (matchesMin && matchesMax) return t;
  }
  return null;
}

/** Trouve le palier KG applicable pour un poids facturable donné. */
export function pickKgTier(tiers: KgTier[], kg: number): KgTier | null {
  const sorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order || a.min_kg - b.min_kg);
  for (const t of sorted) {
    const matchesMin = kg >= t.min_kg;
    const matchesMax = t.max_kg == null || kg <= t.max_kg;
    if (matchesMin && matchesMax) return t;
  }
  return null;
}

/**
 * Trouve le palier pièce applicable pour une catégorie + une quantité.
 * Priorité : match `category_id` exact, sinon match `custom_label`, sinon null.
 * Parmi les matches, on prend le palier dont `min_quantity` est le plus haut
 * tout en restant ≤ quantity (logique "tarif dégressif par paliers").
 */
export function pickPieceTier(
  tiers: PieceTier[],
  item: { category_id?: string | null; custom_label?: string | null; quantity: number },
): PieceTier | null {
  const candidates = tiers.filter((t) => {
    if (item.category_id && t.category_id === item.category_id) return true;
    if (item.custom_label && t.custom_label && t.custom_label.toLowerCase() === item.custom_label.toLowerCase()) return true;
    return false;
  });
  if (candidates.length === 0) return null;
  const eligible = candidates
    .filter((t) => item.quantity >= t.min_quantity)
    .sort((a, b) => b.min_quantity - a.min_quantity);
  return eligible[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote engines (purs)
// ─────────────────────────────────────────────────────────────────────────────

/** Quote basé sur le CBM total et les paliers CBM du profil. */
export function quoteByCBM(profile: FreightProfile, tiers: CbmTier[], totalCbm: number): QuoteLine | null {
  if (totalCbm <= 0) return null;
  const tier = pickCbmTier(tiers, totalCbm);
  if (!tier) return null;
  if (tier.is_quote_only || tier.price_per_cbm == null) {
    return {
      type: "cbm",
      label: `Palier ${tier.min_cbm}${tier.max_cbm ? `–${tier.max_cbm}` : "+"} ${tier.unit} (sur devis)`,
      cbm: totalCbm,
      unit: tier.unit,
      line_total: 0,
      quote_only: true,
    };
  }
  return {
    type: "cbm",
    label: `${totalCbm} ${tier.unit} × ${tier.price_per_cbm} (palier ${tier.min_cbm}${tier.max_cbm ? `–${tier.max_cbm}` : "+"})`,
    cbm: totalCbm,
    unit: tier.unit,
    unit_price: tier.price_per_cbm,
    line_total: round2(totalCbm * tier.price_per_cbm),
  };
}

/** Quote basé sur le nombre de pièces et les paliers pièce du profil. */
export function quoteByPiece(tiers: PieceTier[], items: FreightItem[]): QuoteLine[] {
  const lines: QuoteLine[] = [];
  for (const item of items) {
    const tier = pickPieceTier(tiers, item);
    if (!tier) continue;
    lines.push({
      type: "piece",
      label: `${item.quantity} × ${tier.custom_label ?? "pièce"} @ ${tier.price}`,
      quantity: item.quantity,
      unit: tier.pricing_unit,
      unit_price: tier.price,
      line_total: round2(item.quantity * tier.price),
      includes_customs: tier.includes_customs,
    });
  }
  return lines;
}

/** Quote basé sur le poids facturable (réel vs volumétrique). */
export function quoteByWeight(profile: FreightProfile, tiers: CbmTier[], totalCbm: number, totalWeightKg: number): QuoteLine | null {
  if (!profile.volumetric_divisor) return null;
  const chargeable = chargeableWeightKg(totalWeightKg, totalCbm, profile.volumetric_divisor);
  // On réutilise les paliers CBM pour le label (1 CBM ~ divisor kg équivalent)
  const equivalentCbm = profile.volumetric_divisor > 0 ? round2((chargeable * profile.volumetric_divisor) / 1_000_000) : 0;
  const tier = pickCbmTier(tiers, equivalentCbm);
  if (!tier || tier.price_per_cbm == null) return null;
  return {
    type: "weight",
    label: `${chargeable} kg facturable (max réel ${totalWeightKg} / volumétrique ${volumetricWeightKg(totalCbm, profile.volumetric_divisor)})`,
    weight_kg: chargeable,
    unit: "kg",
    unit_price: round2(tier.price_per_cbm / profile.volumetric_divisor * 1000),
    line_total: round2((equivalentCbm) * tier.price_per_cbm),
  };
}

/** Quote basé sur le poids facturable (réel vs volumétrique) et la grille KG (forwarder_kg_tiers). */
export function quoteByKgTier(
  profile: FreightProfile,
  tiers: KgTier[],
  totalCbm: number,
  totalWeightKg: number,
): QuoteLine | null {
  if (tiers.length === 0) return null;
  const billableRaw = chargeableWeightKg(totalWeightKg, totalCbm, profile.volumetric_divisor);
  if (billableRaw <= 0) return null;
  const tier = pickKgTier(tiers, billableRaw);
  if (!tier) return null;
  const billable = tier.round_up_to_kg ? Math.max(1, Math.ceil(billableRaw)) : billableRaw;
  if (tier.is_quote_only) {
    return {
      type: "weight",
      label: `Palier ${tier.min_kg}${tier.max_kg ? `–${tier.max_kg}` : "+"} kg (sur devis)`,
      weight_kg: billable,
      unit: "kg",
      line_total: 0,
      quote_only: true,
    };
  }
  if (tier.flat_price != null) {
    return {
      type: "weight",
      label: `Forfait palier ${tier.min_kg}${tier.max_kg ? `–${tier.max_kg}` : "+"} kg`,
      weight_kg: billable,
      unit: "kg",
      line_total: round2(tier.flat_price),
    };
  }
  if (tier.price_per_kg != null) {
    return {
      type: "weight",
      label: `${billable} kg × ${tier.price_per_kg} (palier ${tier.min_kg}${tier.max_kg ? `–${tier.max_kg}` : "+"})`,
      weight_kg: billable,
      unit: "kg",
      unit_price: tier.price_per_kg,
      line_total: round2(billable * tier.price_per_kg),
    };
  }
  return null;
}

/** Compose un quote complet (CBM + pièces) en respectant les seuils de deposit. */
export function composeFreightQuote(
  profile: FreightProfile,
  cbmTiers: CbmTier[],
  pieceTiers: PieceTier[],
  items: FreightItem[],
  opts?: { totalCbm?: number; totalWeightKg?: number; kgTiers?: KgTier[] },
): FreightQuoteResult {
  const warnings: string[] = [];
  const totalCbm = opts?.totalCbm ?? items.reduce((acc, i) => acc + (i.cbm ?? 0) * i.quantity, 0);
  const totalWeightKg = opts?.totalWeightKg ?? items.reduce((acc, i) => acc + (i.weight_kg ?? 0) * i.quantity, 0);
  const kgTiers = opts?.kgTiers ?? [];

  const lines: QuoteLine[] = [];

  // Lot 1 fix — Choix automatique de la grille appliquée :
  //   1) lignes pièce/catégorie (si match), TOUJOURS additionnées
  //   2) ligne principale = KG (poids facturable max(réel, volumétrique)) si paliers KG
  //      définis pour ce profil, sinon repli sur CBM.
  const pieceLines = quoteByPiece(pieceTiers, items);
  lines.push(...pieceLines);

  let mainLine: QuoteLine | null = null;
  if (kgTiers.length > 0) {
    mainLine = quoteByKgTier(profile, kgTiers, totalCbm, totalWeightKg);
  }
  if (!mainLine && cbmTiers.length > 0) {
    mainLine = quoteByCBM(profile, cbmTiers, totalCbm);
  }
  if (mainLine) lines.push(mainLine);

  if (mainLine?.quote_only) {
    warnings.push("Hors grille tarifaire — devis manuel requis.");
  }
  if (!mainLine && pieceLines.length === 0) {
    warnings.push("Aucun palier tarifaire applicable pour ce poids/volume.");
  }

  const total = round2(lines.reduce((acc, l) => acc + (l.line_total ?? 0), 0));
  const chargeable = profile.volumetric_divisor
    ? chargeableWeightKg(totalWeightKg, totalCbm, profile.volumetric_divisor)
    : round2(totalWeightKg);

  const depositRequired =
    profile.deposit_pct > 0 &&
    (profile.deposit_threshold_cbm == null || totalCbm >= profile.deposit_threshold_cbm);
  const depositAmount = depositRequired ? round2((total * profile.deposit_pct) / 100) : 0;

  return {
    profile_id: profile.id,
    currency: profile.currency,
    total,
    total_cbm: round2(totalCbm),
    total_chargeable_weight_kg: chargeable,
    lines,
    deposit_required: depositRequired,
    deposit_pct: profile.deposit_pct,
    deposit_amount: depositAmount,
    transit_min_days: profile.transit_min_days,
    transit_max_days: profile.transit_max_days,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data fetchers (lecture seule)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Récupère un profil + ses paliers en parallèle.
 * Renvoie null si le profil est introuvable / inactif.
 */
export async function fetchFreightProfileWithTiers(profileId: string): Promise<{
  profile: FreightProfile;
  cbmTiers: CbmTier[];
  pieceTiers: PieceTier[];
  kgTiers: KgTier[];
} | null> {
  const [profileRes, cbmRes, pieceRes, kgRes] = await Promise.all([
    (supabase as any)
      .from("forwarder_pricing_profiles")
      .select(
        "id, forwarder_id, mode, service_class, country_code, city_id, currency, deposit_pct, deposit_threshold_cbm, volumetric_divisor, transit_min_days, transit_max_days, is_active, linked_transporter_user_id, pickup_address, pickup_email",
      )
      .eq("id", profileId)
      .eq("is_active", true)
      .maybeSingle(),
    (supabase as any)
      .from("forwarder_cbm_tiers")
      .select("id, profile_id, min_cbm, max_cbm, price_per_cbm, unit, is_quote_only, sort_order")
      .eq("profile_id", profileId),
    (supabase as any)
      .from("forwarder_piece_tiers")
      .select("id, profile_id, category_id, custom_label, min_quantity, price, pricing_unit, includes_customs, sort_order")
      .eq("profile_id", profileId),
    (supabase as any)
      .from("forwarder_kg_tiers")
      .select("id, profile_id, min_kg, max_kg, price_per_kg, flat_price, round_up_to_kg, is_quote_only, sort_order")
      .eq("profile_id", profileId),
  ]);

  if (profileRes.error || !profileRes.data) {
    if (profileRes.error) console.warn("[freightQuote] profile fetch failed", profileRes.error);
    return null;
  }
  if (cbmRes.error) console.warn("[freightQuote] cbm tiers fetch failed", cbmRes.error);
  if (pieceRes.error) console.warn("[freightQuote] piece tiers fetch failed", pieceRes.error);
  if (kgRes.error) console.warn("[freightQuote] kg tiers fetch failed", kgRes.error);

  return {
    profile: profileRes.data as FreightProfile,
    cbmTiers: (cbmRes.data ?? []) as CbmTier[],
    pieceTiers: (pieceRes.data ?? []) as PieceTier[],
    kgTiers: (kgRes.data ?? []) as KgTier[],
  };
}

/**
 * Helper end-to-end : fetch + compose. À utiliser pour previews UI.
 * Pour la facturation réelle, préférer `quoteForwarder` (RPC serveur).
 */
export async function quoteFreight(params: {
  profileId: string;
  items: FreightItem[];
  totalCbm?: number;
  totalWeightKg?: number;
}): Promise<FreightQuoteResult | null> {
  const data = await fetchFreightProfileWithTiers(params.profileId);
  if (!data) return null;
  return composeFreightQuote(data.profile, data.cbmTiers, data.pieceTiers, params.items, {
    totalCbm: params.totalCbm,
    totalWeightKg: params.totalWeightKg,
    kgTiers: data.kgTiers,
  });
}