/**
 * Last-mile delivery fee calculation utility.
 *
 * @deprecated Depuis le Lot consolidation multi-opérateurs, la tarification
 * du dernier kilomètre est gérée par opérateur via `delivery_operator_rates`
 * (cf. `useOperatorQuotes`). Les colonnes `communes.delivery_fee` et
 * `quartiers.delivery_surcharge` ont été renommées `*_legacy_deprecated`.
 * Ce helper ne retourne plus que les flags `deliverable` / `restricted` et
 * un `fee` à 0 (pour compatibilité avec l'ancien call site CheckoutPage).
 */
import { supabase } from "@/integrations/supabase/client";

export interface LastMileFeeResult {
  fee: number;
  communeFee: number;
  quartierSurcharge: number;
  deliverable: boolean;
  restricted: boolean;
  restrictionReason: string | null;
}

/**
 * Calculate last-mile delivery fee based on commune and quartier.
 * Returns fee breakdown + availability flags.
 */
export async function calculateLastMileFee(
  communeName: string,
  quartierName: string,
  cityName: string,
  countryCode: string = "CD"
): Promise<LastMileFeeResult> {
  const result: LastMileFeeResult = {
    fee: 0,
    communeFee: 0,
    quartierSurcharge: 0,
    deliverable: true,
    restricted: false,
    restrictionReason: null,
  };

  if (!communeName || !cityName) return result;

  // Lookup commune (sans frais : géré par opérateurs)
  const { data: commune } = await (supabase as any)
    .from("communes")
    .select("id, is_deliverable, is_active")
    .eq("name", communeName)
    .eq("city", cityName)
    .eq("country_code", countryCode)
    .maybeSingle();

  if (!commune) return result;

  result.communeFee = 0;
  result.deliverable = commune.is_deliverable !== false && commune.is_active !== false;

  if (!result.deliverable) {
    result.fee = 0;
    return result;
  }

  // Lookup quartier if provided
  if (quartierName && commune.id) {
    const { data: quartier } = await (supabase as any)
      .from("quartiers")
      .select("is_restricted, restriction_reason, is_active")
      .eq("name", quartierName)
      .eq("commune_id", commune.id)
      .maybeSingle();

    if (quartier) {
      result.quartierSurcharge = 0;
      result.restricted = !!quartier.is_restricted || quartier.is_active === false;
      result.restrictionReason = quartier.restriction_reason || null;

      if (result.restricted) {
        result.deliverable = false;
        result.fee = 0;
        return result;
      }
    }
  }

  result.fee = 0;
  return result;
}
