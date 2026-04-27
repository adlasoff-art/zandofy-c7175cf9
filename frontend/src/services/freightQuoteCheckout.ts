/**
 * freightQuoteCheckout.ts — Lot 4B
 *
 * Couche au-dessus de freightQuote.ts (Lot 3A) qui ajoute :
 *  - récupération de TOUS les profils forwarder éligibles (destination + mode)
 *  - composition d'un devis pour chaque profil
 *  - persistance d'un devis verrouillé en base (table freight_quotes)
 *  - consommation d'un devis lors de la création de commande
 *
 * Lecture seule sur forwarder_pricing_profiles / tiers (pas de mutation).
 * Écriture uniquement sur freight_quotes (RLS user_id = auth.uid()).
 */

import { supabase } from "@/integrations/supabase/client";
import {
  composeFreightQuote,
  fetchFreightProfileWithTiers,
  type FreightItem,
  type FreightQuoteResult,
  type FreightProfile,
} from "./freightQuote";

export interface ConsolidationOffer {
  available: boolean;
  consolidated_billable_kg: number;
  base_price: number;
  consolidation_fee: number;
  consolidated_total: number;
  delta_vs_split: number;
}

export interface SubpackageBreakdown {
  supplier_id: string;
  real_weight_kg: number;
  volumetric_weight_kg: number;
  billable_weight_kg: number;
  cbm: number;
  tier_used: string;
  line_total: number;
}

export interface EligibleFreightOffer {
  profile_id: string;
  forwarder_id: string;
  mode: string;
  service_class: string;
  country_code: string;
  city_id: string | null;
  quote: FreightQuoteResult;
  /** Adresse de récupération/dépôt (visible client via tooltip). */
  pickup_address?: string | null;
  /** Email pickup dédié (sinon fallback côté admin sur forwarders.contact_email). */
  pickup_email?: string | null;
  /** Devis split (par sous-colis) renvoyé par le RPC `quote_forwarder`. */
  split_total?: number;
  /** Détail par fournisseur (poids facturable, palier utilisé, ligne). */
  subpackages?: SubpackageBreakdown[];
  /** Offre de groupage si le transitaire l'a activée et que ≥ N colis. */
  consolidation_offer?: ConsolidationOffer | null;
  /** Lot Very Speed — Métadonnées transitaire (nom, logo, plateforme). */
  forwarder_name?: string | null;
  forwarder_logo_url?: string | null;
  is_platform_owned?: boolean;
  /** Lot Very Speed — true si un profil existe pour cette zone (false → carte grisée). */
  has_profile_for_zone?: boolean;
  /** Lot Very Speed — Message affiché quand le service plateforme n'est pas dispo. */
  unavailable_message?: string | null;
}

export interface QuoteCheckoutInput {
  destinationCountry: string;
  destinationCityId?: string | null;
  mode: string; // 'air' | 'sea' | 'express' | ...
  items: FreightItem[];
  totalCbm?: number;
  totalWeightKg?: number;
  /**
   * Lot 11C — ISO2 du pays d'origine effectif des produits du panier
   * (origine produit > origine boutique). Si fourni, restreint la liste
   * aux transitaires couvrant la route origine→destination.
   */
  originCountry?: string | null;
}

/**
 * Récupère tous les profils forwarder actifs pour la destination + mode,
 * puis compose un devis pour chacun.
 * Trié par prix croissant. Le premier est la "recommandation".
 */
export async function fetchEligibleFreightOffers(
  input: QuoteCheckoutInput,
): Promise<EligibleFreightOffer[]> {
  // 1) Trouver les profils éligibles (lecture seule) — joint sur forwarders pour
  //    récupérer nom/logo/flag plateforme.
  let query = (supabase as any)
    .from("forwarder_pricing_profiles")
    .select(
      "id, forwarder_id, mode, service_class, country_code, city_id, " +
        "forwarder:forwarders!inner(id, name, logo_url, is_platform_owned, is_active, coverage_routes, supported_modes)",
    )
    .eq("is_active", true)
    .eq("country_code", input.destinationCountry)
    .eq("mode", input.mode)
    .eq("forwarder.is_active", true);

  if (input.destinationCityId) {
    // city_id NULL = profil pays-large ; cityId = profil ville-spécifique
    query = query.or(`city_id.is.null,city_id.eq.${input.destinationCityId}`);
  } else {
    query = query.is("city_id", null);
  }

  const { data: profiles, error } = await query;
  if (error) {
    console.warn("[freightQuoteCheckout] eligible profiles fetch failed", error);
  }
  const profilesList = (profiles ?? []) as Array<{
    id: string;
    forwarder_id: string;
    mode: string;
    service_class: string;
    country_code: string;
    city_id: string | null;
    forwarder: {
      id: string;
      name: string;
      logo_url: string | null;
      is_platform_owned: boolean;
      is_active: boolean;
      coverage_routes: Array<{ origin_country?: string; origin_city?: string; destination_country?: string; destination_city?: string }> | null;
      supported_modes: string[] | null;
    } | null;
  }>;

  // Lot 11C — Filtrer par pays d'origine du produit. Un transitaire est
  // éligible si au moins une de ses coverage_routes couvre la route
  // origine→destination demandée. Le service plateforme (is_platform_owned)
  // est conservé tel quel (couverture globale gérée côté admin).
  const originISO = (input.originCountry || "").toUpperCase().trim();
  const destISO = (input.destinationCountry || "").toUpperCase().trim();
  const filteredProfiles = originISO
    ? profilesList.filter((p) => {
        if (p.forwarder?.is_platform_owned) return true;
        const routes = p.forwarder?.coverage_routes ?? [];
        const supports = p.forwarder?.supported_modes;
        if (supports && supports.length > 0 && !supports.includes(input.mode)) return false;
        return routes.some((r) =>
          (r?.origin_country || "").toUpperCase() === originISO &&
          (r?.destination_country || "").toUpperCase() === destISO,
        );
      })
    : profilesList;

  // 2) Composer un devis pour chaque profil (en parallèle)
  const offers = await Promise.all(
    filteredProfiles.map(
      async (p) => {
        const data = await fetchFreightProfileWithTiers(p.id);
        if (!data) return null;
        const quote = composeFreightQuote(data.profile, data.cbmTiers, data.pieceTiers, input.items, {
          totalCbm: input.totalCbm,
          totalWeightKg: input.totalWeightKg,
          kgTiers: data.kgTiers,
        });

        // 2bis) Appel RPC pour la logique segmentée (split + consolidation)
        let split_total: number | undefined;
        let subpackages: SubpackageBreakdown[] | undefined;
        let consolidation_offer: ConsolidationOffer | null | undefined;
        try {
          const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("quote_forwarder", {
            p_profile_id: p.id,
            p_items: input.items,
            p_total_cbm: input.totalCbm ?? null,
            p_consolidation_choice: "split",
          });
          if (!rpcErr && rpcData) {
            split_total = Number(rpcData.split_total ?? 0);
            subpackages = (rpcData.subpackages ?? []) as SubpackageBreakdown[];
            consolidation_offer = (rpcData.consolidation_offer ?? null) as ConsolidationOffer | null;
          }
        } catch (e) {
          console.warn("[freightQuoteCheckout] quote_forwarder RPC failed", e);
        }

        return {
          profile_id: p.id,
          forwarder_id: p.forwarder_id,
          mode: p.mode,
          service_class: p.service_class,
          country_code: p.country_code,
          city_id: p.city_id,
          quote,
          pickup_address: data.profile.pickup_address ?? null,
          pickup_email: data.profile.pickup_email ?? null,
          split_total,
          subpackages,
          consolidation_offer,
          forwarder_name: p.forwarder?.name ?? null,
          forwarder_logo_url: p.forwarder?.logo_url ?? null,
          is_platform_owned: p.forwarder?.is_platform_owned ?? false,
          has_profile_for_zone: true,
          unavailable_message: null,
        } as EligibleFreightOffer;
      },
    ),
  );

  const validOffers = offers
    .filter((o): o is EligibleFreightOffer => o !== null)
    .sort((a, b) => a.quote.total - b.quote.total);

  // 3) Lot Very Speed — Si AUCUN profil plateforme n'est présent dans les
  //    offres ci-dessus pour cette zone+mode, ajouter une carte "plateforme grisée"
  //    pour informer le client que le service plateforme n'est pas disponible.
  const hasPlatformOffer = validOffers.some((o) => o.is_platform_owned);
  if (!hasPlatformOffer) {
    const { data: platformForwarders } = await (supabase as any)
      .from("forwarders")
      .select("id, name, logo_url, unavailable_message")
      .eq("is_active", true)
      .eq("is_platform_owned", true)
      .limit(1);

    const pf = (platformForwarders ?? [])[0] as
      | { id: string; name: string; logo_url: string | null; unavailable_message: string | null }
      | undefined;
    if (pf) {
      // Carte grisée — quote vide, non sélectionnable
      validOffers.unshift({
        profile_id: `platform-unavailable-${pf.id}`,
        forwarder_id: pf.id,
        mode: input.mode,
        service_class: "platform",
        country_code: input.destinationCountry,
        city_id: input.destinationCityId ?? null,
        quote: {
          total: 0,
          currency: "USD",
          lines: [],
          warnings: [],
          deposit_required: false,
          deposit_amount: 0,
          deposit_pct: 0,
          transit_min_days: null,
          transit_max_days: null,
          total_cbm: 0,
          total_chargeable_weight_kg: 0,
        } as unknown as FreightQuoteResult,
        forwarder_name: pf.name,
        forwarder_logo_url: pf.logo_url,
        is_platform_owned: true,
        has_profile_for_zone: false,
        unavailable_message:
          pf.unavailable_message ?? "Service plateforme non disponible dans votre zone",
      });
    }
  }

  return validOffers;
}

/**
 * Persiste un devis en base (status='locked') et renvoie son id.
 * À appeler quand l'utilisateur valide son choix dans le checkout.
 * RLS exige auth.uid() = user_id.
 */
export async function lockFreightQuote(params: {
  userId: string;
  offer: EligibleFreightOffer;
  items: FreightItem[];
  categoryId?: string | null;
  restrictions?: Array<{ label: string; restriction_type: string; icon?: string | null }>;
  /** Lot 4G — Choix d'expédition retenu par le client (split par défaut). */
  consolidationChoice?: "split" | "consolidated";
}): Promise<string | null> {
  const { offer, userId, items, categoryId, restrictions, consolidationChoice = "split" } = params;
  const piecesCount = items.reduce((acc, i) => acc + (i.quantity ?? 0), 0);

  // Lot 4G — Si groupage choisi et offre dispo, on verrouille le total consolidé.
  const co = offer.consolidation_offer;
  const useConsolidated = consolidationChoice === "consolidated" && co?.available;

  // Lot 11A — Choisir le 1er montant > 0 dans l'ordre :
  //   1. Total consolidé (si groupage retenu)
  //   2. split_total (somme des sous-colis)
  //   3. quote.total (total agrégé déjà affiché en UI checkout)
  // Avant : `offer.split_total ?? offer.quote.total` faisait passer un split_total
  // numérique mais à 0 (cas mono-colis ou sous-colis vides), persistant un devis
  // verrouillé à 0 USD alors que orders.shipping_cost était correct.
  const candidates: number[] = useConsolidated
    ? [Number(co!.consolidated_total) || 0, Number(offer.quote.total) || 0]
    : [Number(offer.split_total) || 0, Number(offer.quote.total) || 0];
  const lockedTotal = candidates.find((v) => v > 0) ?? 0;

  // Lot 11A — Garde-fou : refuser de persister un devis à 0 USD.
  // Cela évitait des commandes affichant "USD 0.00" dans le panneau Transport
  // International alors que orders.shipping_cost était correct.
  if (lockedTotal <= 0) {
    console.warn(
      "[freightQuoteCheckout] lockFreightQuote refused: lockedTotal <= 0",
      { offer_id: offer.profile_id, forwarder_id: offer.forwarder_id, candidates },
    );
    return null;
  }

  const { data, error } = await (supabase as any)
    .from("freight_quotes")
    .insert({
      user_id: userId,
      profile_id: offer.profile_id,
      category_id: categoryId ?? null,
      cbm: offer.quote.total_cbm,
      weight_kg: offer.quote.total_chargeable_weight_kg,
      pieces_count: piecesCount,
      quoted_price: lockedTotal,
      currency: offer.quote.currency,
      deposit_amount: offer.quote.deposit_amount,
      deposit_pct: offer.quote.deposit_pct,
      requires_deposit: offer.quote.deposit_required,
      transit_min_days: offer.quote.transit_min_days,
      transit_max_days: offer.quote.transit_max_days,
      restrictions_snapshot: restrictions ?? [],
      breakdown: {
        lines: offer.quote.lines,
        warnings: offer.quote.warnings,
        forwarder_id: offer.forwarder_id,
        mode: offer.mode,
        service_class: offer.service_class,
        consolidation_choice: consolidationChoice,
        split_total: offer.split_total ?? offer.quote.total,
        consolidation_offer: co ?? null,
        subpackages: offer.subpackages ?? [],
      },
      status: "locked",
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.warn("[freightQuoteCheckout] lockFreightQuote failed", error);
    return null;
  }
  return (data as { id: string }).id;
}

/**
 * Marque un devis comme consommé et le lie à une commande.
 * À appeler juste après la création de l'order, dans la même transaction logique.
 */
export async function consumeFreightQuote(quoteId: string, orderId: string): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("freight_quotes")
    .update({ status: "consumed", order_id: orderId })
    .eq("id", quoteId)
    .eq("status", "locked");

  if (error) {
    console.warn("[freightQuoteCheckout] consumeFreightQuote failed", error);
    return false;
  }
  return true;
}

/**
 * Récupère un devis verrouillé pour vérification UI (rafraîchissement panier).
 */
export async function getFreightQuote(quoteId: string): Promise<{
  id: string;
  status: string;
  quoted_price: number;
  currency: string;
  deposit_amount: number;
  requires_deposit: boolean;
  valid_until: string;
} | null> {
  const { data, error } = await (supabase as any)
    .from("freight_quotes")
    .select("id, status, quoted_price, currency, deposit_amount, requires_deposit, valid_until")
    .eq("id", quoteId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export type { FreightItem, FreightQuoteResult, FreightProfile };

// ─────────────────────────────────────────────────────────────────────────────
// Lot 11C — Phase 2 : Segmentation panier par (store_id, origin_country)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Représente un groupe de produits du panier partageant la même boutique ET
 * le même pays d'origine effectif. Chaque groupe = 1 sous-commande + 1 devis
 * transitaire indépendant.
 */
export interface CartOriginGroup {
  /** Clé unique stable : `${store_id}|${origin_country}`. */
  key: string;
  store_id: string;
  /** ISO2 du pays d'origine effectif (origine produit > origine boutique). */
  origin_country: string;
  /** Nom de la boutique (pour affichage). */
  store_name?: string | null;
  /** Items appartenant à ce groupe (productId + quantity). */
  items: Array<{
    productId: string;
    quantity: number;
    weight_kg?: number;
    cbm?: number;
  }>;
  /** Poids total du groupe en kg. */
  total_weight_kg: number;
  /** Volume total du groupe en CBM. */
  total_cbm: number;
  /** Modes communs supportés par tous les produits du groupe. */
  supported_modes: Array<"air" | "sea">;
}

/**
 * Construit la liste des groupes (store_id × origin_country) depuis le panier.
 * Origine effective = `products.origin_country` (fallback : `stores.country`).
 * Modes supportés = intersection des `can_ship_air` / `can_ship_sea` du groupe.
 */
export async function groupCartByOriginAndStore(
  cartItems: Array<{ productId: string; quantity: number }>,
): Promise<CartOriginGroup[]> {
  if (cartItems.length === 0) return [];
  const productIds = [...new Set(cartItems.map((i) => i.productId).filter(Boolean))];
  if (productIds.length === 0) return [];

  const { data: products } = await (supabase as any)
    .from("products")
    .select(
      "id, store_id, origin_country, weight_grams, length_cm, width_cm, height_cm, can_ship_air, can_ship_sea, store:stores(id, name, country)",
    )
    .in("id", productIds);

  type Row = {
    id: string;
    store_id: string | null;
    origin_country: string | null;
    weight_grams: number | null;
    length_cm: number | null;
    width_cm: number | null;
    height_cm: number | null;
    can_ship_air: boolean | null;
    can_ship_sea: boolean | null;
    store: { id: string; name: string | null; country: string | null } | null;
  };
  const rows = (products ?? []) as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const groups = new Map<string, CartOriginGroup>();
  for (const ci of cartItems) {
    const p = byId.get(ci.productId);
    if (!p) continue;
    const storeId = p.store_id ?? "default";
    const originISO = ((p.origin_country ?? p.store?.country ?? "") || "").toUpperCase().trim();
    const groupKey = `${storeId}|${originISO || "UNKNOWN"}`;

    const wKg = ((p.weight_grams ?? 500) * ci.quantity) / 1000;
    const cbm =
      ((Number(p.length_cm ?? 30) * Number(p.width_cm ?? 20) * Number(p.height_cm ?? 10)) *
        ci.quantity) /
      1_000_000;

    const existing = groups.get(groupKey);
    if (existing) {
      existing.items.push({ productId: ci.productId, quantity: ci.quantity, weight_kg: wKg, cbm });
      existing.total_weight_kg += wKg;
      existing.total_cbm += cbm;
      // Intersection : on conserve un mode uniquement s'il est encore commun.
      const stillSupported: Array<"air" | "sea"> = [];
      if (existing.supported_modes.includes("air") && p.can_ship_air !== false) stillSupported.push("air");
      if (existing.supported_modes.includes("sea") && p.can_ship_sea !== false) stillSupported.push("sea");
      existing.supported_modes = stillSupported;
    } else {
      const supported: Array<"air" | "sea"> = [];
      if (p.can_ship_air !== false) supported.push("air");
      if (p.can_ship_sea !== false) supported.push("sea");
      groups.set(groupKey, {
        key: groupKey,
        store_id: storeId,
        origin_country: originISO,
        store_name: p.store?.name ?? null,
        items: [{ productId: ci.productId, quantity: ci.quantity, weight_kg: wKg, cbm }],
        total_weight_kg: wKg,
        total_cbm: cbm,
        supported_modes: supported,
      });
    }
  }

  // Tri stable : par origine puis store pour rendu déterministe.
  return [...groups.values()].sort((a, b) => {
    if (a.origin_country !== b.origin_country) return a.origin_country.localeCompare(b.origin_country);
    return a.store_id.localeCompare(b.store_id);
  });
}