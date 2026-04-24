/**
 * CartFreightPreview.tsx — Lot 4G
 *
 * Mini-aperçu informatif du coût de fret dans le CartDrawer, basé sur l'adresse
 * par défaut de l'utilisateur. Lecture seule, ne verrouille AUCUN devis :
 * le choix définitif (transitaire + split/groupé) se fait au checkout.
 */

import { useEffect, useState } from "react";
import { Truck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchEligibleFreightOffers,
  type EligibleFreightOffer,
} from "@/services/freightQuoteCheckout";

interface CartItemLite {
  productId: string;
  quantity: number;
}

interface ProductDims {
  id: string;
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
}

export function CartFreightPreview({
  userId,
  items,
}: {
  userId: string;
  items: CartItemLite[];
}) {
  const [loading, setLoading] = useState(true);
  const [cheapest, setCheapest] = useState<EligibleFreightOffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setCheapest(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    (async () => {
      // 1) Adresse par défaut du user (sinon on n'affiche rien)
      const { data: addr } = await (supabase as any)
        .from("saved_addresses")
        .select("country, city")
        .eq("user_id", userId)
        .eq("is_default", true)
        .maybeSingle();

      if (!addr?.country) {
        if (!cancelled) {
          setCheapest(null);
          setLoading(false);
        }
        return;
      }

      // 2) Dimensions/poids des produits du panier
      const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
      const { data: prods } = ids.length
        ? await supabase
            .from("products")
            .select("id, weight_grams, length_cm, width_cm, height_cm")
            .in("id", ids)
        : { data: [] as ProductDims[] };

      const map = new Map<string, ProductDims>(
        (prods || []).map((p: any) => [p.id, p as ProductDims]),
      );

      let totalKg = 0;
      let totalCbm = 0;
      const freightItems = items.map((ci) => {
        const p = map.get(ci.productId);
        const w = ((p?.weight_grams ?? 0) * ci.quantity) / 1000;
        const v =
          ((p?.length_cm ?? 0) *
            (p?.width_cm ?? 0) *
            (p?.height_cm ?? 0) *
            ci.quantity) /
          1_000_000;
        totalKg += w;
        totalCbm += v;
        return { quantity: ci.quantity, weight_kg: w, cbm: v };
      });

      // 3) On essaie l'aérien par défaut (le plus universel) — purement indicatif.
      const offers = await fetchEligibleFreightOffers({
        destinationCountry: addr.country,
        mode: "air",
        items: freightItems,
        totalCbm,
        totalWeightKg: totalKg,
      });

      if (!cancelled) {
        setCheapest(offers[0] ?? null);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, items]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-1">
        <Loader2 size={11} className="animate-spin text-primary" />
        Estimation fret en cours…
      </div>
    );
  }

  if (!cheapest) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <Truck size={11} className="text-primary shrink-0" />
        <span className="text-[11px] text-muted-foreground">
          Fret aérien estimé (à partir de)
        </span>
      </div>
      <span className="text-[11px] font-semibold text-foreground shrink-0">
        {cheapest.quote.currency} {cheapest.quote.total.toFixed(2)}
      </span>
    </div>
  );
}