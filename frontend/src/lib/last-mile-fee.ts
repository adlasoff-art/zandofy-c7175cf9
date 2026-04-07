/**
 * Last-mile delivery fee calculation utility.
 * Computes total = commune.delivery_fee + quartier.delivery_surcharge
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

  // Lookup commune
  const { data: commune } = await (supabase as any)
    .from("communes")
    .select("id, delivery_fee, is_deliverable, is_active")
    .eq("name", communeName)
    .eq("city", cityName)
    .eq("country_code", countryCode)
    .maybeSingle();

  if (!commune) return result;

  result.communeFee = Number(commune.delivery_fee) || 0;
  result.deliverable = commune.is_deliverable !== false && commune.is_active !== false;

  if (!result.deliverable) {
    result.fee = 0;
    return result;
  }

  // Lookup quartier if provided
  if (quartierName && commune.id) {
    const { data: quartier } = await (supabase as any)
      .from("quartiers")
      .select("delivery_surcharge, is_restricted, restriction_reason, is_active")
      .eq("name", quartierName)
      .eq("commune_id", commune.id)
      .maybeSingle();

    if (quartier) {
      result.quartierSurcharge = Number(quartier.delivery_surcharge) || 0;
      result.restricted = !!quartier.is_restricted || quartier.is_active === false;
      result.restrictionReason = quartier.restriction_reason || null;

      if (result.restricted) {
        result.deliverable = false;
        result.fee = 0;
        return result;
      }
    }
  }

  result.fee = result.communeFee + result.quartierSurcharge;
  return result;
}
