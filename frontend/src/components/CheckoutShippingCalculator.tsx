import { useState, useEffect, useMemo, useCallback } from "react";
import { Plane, Ship, TruckIcon, Train, Loader2, Info, Lightbulb, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isLandTransportFeasible } from "@/utils/neighboring-countries";
import {
  searchCities, calculateDynamicQuote,
  type City, type DynamicQuoteResult,
} from "@/services/dynamic-shipping";

const MODE_META = {
  air:  { icon: Plane,     label: "Aérien",     unit: "kg" },
  sea:  { icon: Ship,      label: "Maritime",   unit: "cbm" },
  road: { icon: TruckIcon, label: "Routier",    unit: "kg" },
  rail: { icon: Train,     label: "Ferroviaire",unit: "kg" },
} as const;

type TransportMode = keyof typeof MODE_META;

interface CartProductInfo {
  productId: string;
  quantity: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  originCountry: string;
  categoryId: string | null;
}

interface CategorySurchargeInfo {
  categoryId: string;
  surchargeType: string;
  surchargeValue: number;
}

interface Props {
  shippingCity: string;
  cartItems: Array<{ productId: string; quantity: number }>;
  cartSubtotal?: number;
  selectedMode?: TransportMode;
  onShippingCostChange: (cost: number, mode: string) => void;
}

function preciseRound(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

export function CheckoutShippingCalculator({
  shippingCity,
  cartItems,
  cartSubtotal = 0,
  selectedMode,
  onShippingCostChange,
}: Props) {
  const [products, setProducts] = useState<CartProductInfo[]>([]);
  const [destCity, setDestCity] = useState<City | null>(null);
  const [originCities, setOriginCities] = useState<Map<string, City>>(new Map());
  const [quotes, setQuotes] = useState<Map<string, DynamicQuoteResult[]>>(new Map());
  const [surcharges, setSurcharges] = useState<CategorySurchargeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<TransportMode>(selectedMode || "air");
  const [userHasSelected, setUserHasSelected] = useState(false);
  const [seaThreshold, setSeaThreshold] = useState<{ enabled: boolean; min_subtotal: number } | null>(null);

  // 1. Fetch product details (weight, dimensions, origin, category) for cart items
  useEffect(() => {
    if (cartItems.length === 0) return;
    const ids = [...new Set(cartItems.map(i => i.productId))];
    
    supabase
      .from("products")
      .select("id, weight_grams, length_cm, width_cm, height_cm, origin_country, category_id")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const mapped = cartItems.map(item => {
          const p = data.find((d: any) => d.id === item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            weightGrams: p?.weight_grams || 500,
            lengthCm: p?.length_cm ? Number(p.length_cm) : 30,
            widthCm: p?.width_cm ? Number(p.width_cm) : 20,
            heightCm: p?.height_cm ? Number(p.height_cm) : 10,
            originCountry: p?.origin_country || "CN",
            categoryId: p?.category_id || null,
          };
        });
        setProducts(mapped);
      });
  }, [cartItems]);

  // 2. Fetch active category surcharges
  useEffect(() => {
    supabase
      .from("category_surcharges")
      .select("category_id, surcharge_type, surcharge_value")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          setSurcharges(data.map((s: any) => ({
            categoryId: s.category_id,
            surchargeType: s.surcharge_type,
            surchargeValue: Number(s.surcharge_value),
          })));
        }
      });
  }, []);

  // 3. Resolve destination city
  useEffect(() => {
    if (!shippingCity || shippingCity.trim().length < 2) {
      setDestCity(null);
      return;
    }
    const timer = setTimeout(async () => {
      const cities = await searchCities(shippingCity, 1);
      if (cities.length > 0) setDestCity(cities[0]);
      else setDestCity(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [shippingCity]);

  // 4. Resolve origin cities
  useEffect(() => {
    if (products.length === 0) return;
    const countries = [...new Set(products.map(p => p.originCountry))];
    
    Promise.all(
      countries.map(async (cc) => {
        const { data } = await supabase
          .from("cities")
          .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
          .eq("country_code", cc.toUpperCase())
          .order("population", { ascending: false })
          .limit(1);
        return { cc, city: data?.[0] as unknown as City | null };
      })
    ).then(results => {
      const map = new Map<string, City>();
      results.forEach(r => { if (r.city) map.set(r.cc, r.city); });
      setOriginCities(map);
    });
  }, [products]);

  // 5. Calculate quotes with surcharges
  useEffect(() => {
    if (!destCity || products.length === 0 || originCities.size === 0) return;
    
    setLoading(true);

    // Determine available modes: road/rail only if all origins are same country or neighboring
    const destCountry = destCity.country_code;
    const allLandFeasible = products.every(p => {
      const oc = originCities.get(p.originCountry);
      return oc && isLandTransportFeasible(oc.country_code, destCountry);
    });
    const modes: TransportMode[] = allLandFeasible ? ["air", "sea", "road", "rail"] : ["air", "sea"];

    const byOrigin = new Map<string, CartProductInfo[]>();
    products.forEach(p => {
      const arr = byOrigin.get(p.originCountry) || [];
      arr.push(p);
      byOrigin.set(p.originCountry, arr);
    });

    Promise.all(
      [...byOrigin.entries()].flatMap(([cc, prods]) => {
        const origin = originCities.get(cc);
        if (!origin) return [];
        
        const totalWeightGrams = prods.reduce((s, p) => s + p.weightGrams * p.quantity, 0);
        const totalVolumeCbm = prods.reduce((s, p) => 
          s + (p.lengthCm * p.widthCm * p.heightCm * p.quantity) / 1_000_000, 0);
        const totalQty = prods.reduce((s, p) => s + p.quantity, 0);

        return modes.map(async mode => {
          const result = await calculateDynamicQuote({
            origin_city_id: origin.id,
            destination_city_id: destCity.id,
            mode,
            weight_grams: totalWeightGrams,
            volume_cbm: totalVolumeCbm,
            quantity: totalQty,
          });
          return { cc, mode, result, prods };
        });
      })
    ).then(results => {
      const detailMap = new Map<string, DynamicQuoteResult[]>();
      
      results.forEach(r => {
        if (!r.result) return;
        const arr = detailMap.get(r.mode) || [];
        arr.push(r.result);
        detailMap.set(r.mode, arr);
      });

      setQuotes(detailMap);
      
      // Only auto-select on first load if user hasn't manually chosen
      if (!userHasSelected && !selectedMode) {
        // Default to "air" if available, otherwise keep current
        if (detailMap.has("air")) {
          setActiveMode("air");
        }
      }
      setLoading(false);
    });
  }, [destCity, products, originCities, selectedMode]);

  // Compute aggregated totals per mode WITH surcharges
  const modeTotals = useMemo(() => {
    const totals = new Map<TransportMode, { total: number; transitMin: number | null; transitMax: number | null; surchargeAmount: number }>();
    
    // Compute total surcharge multiplier from cart products
    let surchargeMultiplier = 0;
    let fixedSurcharge = 0;
    const categoryIds = [...new Set(products.map(p => p.categoryId).filter(Boolean))] as string[];
    
    categoryIds.forEach(catId => {
      const s = surcharges.find(sc => sc.categoryId === catId);
      if (s) {
        if (s.surchargeType === "percentage") {
          surchargeMultiplier += s.surchargeValue / 100;
        } else {
          fixedSurcharge += s.surchargeValue;
        }
      }
    });

    quotes.forEach((results, mode) => {
      const baseTotal = results.reduce((s, r) => s + r.total_price, 0);
      const surchargeAmount = preciseRound(baseTotal * surchargeMultiplier + fixedSurcharge, 2);
      const total = preciseRound(baseTotal + surchargeAmount, 2);
      const transitMin = results[0]?.transit_min ?? null;
      const transitMax = results[0]?.transit_max ?? null;
      totals.set(mode as TransportMode, { total, transitMin, transitMax, surchargeAmount });
    });
    return totals;
  }, [quotes, products, surcharges]);

  // Notify parent of shipping cost changes
  useEffect(() => {
    const selected = modeTotals.get(activeMode);
    onShippingCostChange(selected?.total || 0, activeMode);
  }, [activeMode, modeTotals, onShippingCostChange]);

  // Aggregate cart info
  const totalWeight = useMemo(() => 
    products.reduce((s, p) => s + p.weightGrams * p.quantity, 0), [products]);
  const totalVolume = useMemo(() => 
    products.reduce((s, p) => s + (p.lengthCm * p.widthCm * p.heightCm * p.quantity) / 1_000_000, 0), [products]);

  // Optimization advice
  const optimizationTip = useMemo(() => {
    if (products.length === 0 || totalWeight === 0) return null;
    
    const nextKgBoundary = Math.ceil(totalWeight / 1000) * 1000;
    if (nextKgBoundary <= totalWeight) return null;
    
    const gramsNeeded = nextKgBoundary - totalWeight;
    // Find lightest product to suggest adding
    const lightest = products.reduce((min, p) => p.weightGrams < min.weightGrams ? p : min, products[0]);
    const unitsNeeded = Math.ceil(gramsNeeded / lightest.weightGrams);
    
    if (unitsNeeded > 0 && unitsNeeded <= 10) {
      return {
        text: `Ajoutez ${unitsNeeded} unité${unitsNeeded > 1 ? "s" : ""} pour compléter votre prochain KG et optimiser vos frais de transport.`,
        unitsNeeded,
      };
    }
    return null;
  }, [products, totalWeight]);

  if (!shippingCity || shippingCity.trim().length < 2) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Info size={12} />
        <span>Renseignez votre ville pour un calcul précis du fret</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Calcul du fret en cours...</span>
      </div>
    );
  }

  if (modeTotals.size === 0 && !loading) {
    return (
      <div className="text-xs text-muted-foreground py-1">
        Fret standard appliqué
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(["air", "sea", "road", "rail"] as TransportMode[]).map(mode => {
          const data = modeTotals.get(mode);
          if (!data || data.total <= 0) return null;
          const Meta = MODE_META[mode];
          const Icon = Meta.icon;
          const isActive = activeMode === mode;
          
          return (
            <button
              key={mode}
              onClick={() => { setUserHasSelected(true); setActiveMode(mode); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <Icon size={12} />
              <span>{Meta.label}</span>
              {(mode === "road" || mode === "rail") && destCity && (() => {
                const allSameCountry = products.every(p => {
                  const oc = originCities.get(p.originCountry);
                  return oc && oc.country_code === destCity.country_code;
                });
                return (
                  <span className={`text-[9px] px-1 py-0 rounded-full border ${
                    allSameCountry
                      ? "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700"
                      : "bg-sky-500/15 text-sky-700 border-sky-300 dark:text-sky-400 dark:border-sky-700"
                  }`}>
                    {allSameCountry ? "National" : "Limitrophe"}
                  </span>
                );
              })()}
              <span className="font-bold">${data.total.toFixed(2)}</span>
            </button>
          );
        })}
      </div>

      {/* Selected mode details */}
      {(() => {
        const data = modeTotals.get(activeMode);
        if (!data) return null;
        const details = quotes.get(activeMode);
        
        return (
          <div className="bg-muted/30 rounded-md px-3 py-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fret {MODE_META[activeMode].label}</span>
              <span className="font-bold text-foreground">${data.total.toFixed(2)}</span>
            </div>
            {data.surchargeAmount > 0 && (
              <div className="flex justify-between text-[10px] text-amber-600">
                <span>Surtaxe catégorie</span>
                <span>+${data.surchargeAmount.toFixed(2)}</span>
              </div>
            )}
            {data.transitMin && data.transitMax && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Délai estimé</span>
                <span>{data.transitMin}–{data.transitMax} jours</span>
              </div>
            )}
            {totalWeight > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Poids total</span>
                <span>{preciseRound(totalWeight / 1000, 3)} kg</span>
              </div>
            )}
            {totalVolume > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Volume total</span>
                <span>{preciseRound(totalVolume, 4)} CBM</span>
              </div>
            )}
            {details?.[0] && (
              <div className="text-[10px] text-muted-foreground/60">
                {details[0].origin_city} → {details[0].destination_city} · {details[0].distance_km.toLocaleString()} km
                {details[0].route_type === "default" && " · Tarif indicatif"}
              </div>
            )}
          </div>
        );
      })()}

      {/* Optimization advice */}
      {optimizationTip && (
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-md px-2.5 py-2">
          <Lightbulb size={12} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground">{optimizationTip.text}</p>
        </div>
      )}
    </div>
  );
}
