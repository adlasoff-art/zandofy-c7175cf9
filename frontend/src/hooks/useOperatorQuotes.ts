/**
 * useOperatorQuotes — Lot 11B Phase B4
 *
 * Récupère la liste des opérateurs de livraison actifs couvrant une ville donnée
 * + leurs tarifs spécifiques (zone / commune / quartier) pour le checkout.
 *
 * Source : vue public.v_active_operators_by_city + table delivery_operator_rates.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OperatorQuote {
  operator_id: string;
  company_name: string;
  logo_url: string | null;
  rating_avg: number | null;
  total_deliveries: number;
  is_platform_owned: boolean;
  /** Tarif final calculé : base + surcharge (matched zone/commune/quartier) */
  fee: number;
  currency: string;
  estimated_minutes: number;
  zone_name: string | null;
  /** Indique si un tarif spécifique a été trouvé (sinon = preview de la vue) */
  matched: boolean;
}

interface Args {
  city: string | null | undefined;
  countryCode: string | null | undefined;
  commune?: string | null;
  quartier?: string | null;
  enabled?: boolean;
}

/**
 * Choisit le tarif le plus spécifique parmi les rates d'un opérateur :
 *   1. Match quartier
 *   2. Match commune (sans quartier)
 *   3. Premier rate de la ville (zone par défaut)
 */
function pickBestRate(
  rates: any[],
  commune?: string | null,
  quartier?: string | null,
) {
  if (!rates || rates.length === 0) return null;
  if (quartier) {
    const exact = rates.find(
      (r) => r.quartier && r.quartier.toLowerCase() === quartier.toLowerCase(),
    );
    if (exact) return exact;
  }
  if (commune) {
    const c = rates.find(
      (r) =>
        r.commune &&
        r.commune.toLowerCase() === commune.toLowerCase() &&
        !r.quartier,
    );
    if (c) return c;
  }
  const generic = rates.find((r) => !r.commune && !r.quartier);
  return generic ?? rates[0];
}

export function useOperatorQuotes({
  city,
  countryCode,
  commune,
  quartier,
  enabled = true,
}: Args) {
  return useQuery({
    queryKey: [
      "operator-quotes",
      city,
      countryCode,
      commune ?? null,
      quartier ?? null,
    ],
    enabled: enabled && !!city && !!countryCode,
    staleTime: 60_000,
    queryFn: async (): Promise<OperatorQuote[]> => {
      const cc = (countryCode || "").toUpperCase();
      const c = (city || "").trim();

      // 1. Opérateurs actifs sur la ville (vue agrégée).
      const { data: ops, error: opsErr } = await (supabase as any)
        .from("v_active_operators_by_city")
        .select("*")
        .eq("country_code", cc)
        .ilike("city", c);
      if (opsErr || !ops || ops.length === 0) return [];

      const operatorIds = ops.map((o: any) => o.operator_id);

      // 2. Tarifs détaillés pour ces opérateurs sur cette ville.
      const { data: rates } = await (supabase as any)
        .from("delivery_operator_rates")
        .select(
          "operator_id, zone_name, commune, quartier, base_price, surcharge, currency, estimated_minutes",
        )
        .in("operator_id", operatorIds)
        .eq("country_code", cc)
        .ilike("city", c)
        .eq("is_active", true)
        .eq("status", "approved");

      const ratesByOp: Record<string, any[]> = {};
      (rates || []).forEach((r: any) => {
        if (!ratesByOp[r.operator_id]) ratesByOp[r.operator_id] = [];
        ratesByOp[r.operator_id].push(r);
      });

      const quotes: OperatorQuote[] = ops.flatMap((op: any) => {
        const best = pickBestRate(ratesByOp[op.operator_id] || [], commune, quartier);
        // Phase B8 : on n'affiche un opérateur que s'il a un tarif approuvé
        // (statut + is_active déjà filtrés dans la requête `rates`).
        if (!best) return [];
        const fee =
          (Number(best.base_price) || 0) + (Number(best.surcharge) || 0);
        return [{
          operator_id: op.operator_id,
          company_name: op.company_name,
          logo_url: op.logo_url,
          rating_avg: op.rating_avg,
          total_deliveries: op.total_deliveries,
          is_platform_owned: op.is_platform_owned,
          fee,
          currency: best.currency || "USD",
          estimated_minutes: best.estimated_minutes || 60,
          zone_name: best.zone_name || null,
          matched: true,
        }];
      });

      // Tri : plateforme d'abord, puis par prix croissant.
      return quotes.sort((a, b) => {
        if (a.is_platform_owned !== b.is_platform_owned) {
          return a.is_platform_owned ? -1 : 1;
        }
        return a.fee - b.fee;
      });
    },
  });
}