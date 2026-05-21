import { useState, useEffect, useMemo, useCallback } from "react";
import { Plane, Ship, TruckIcon, Train, Loader2, Info, Lightbulb, Package, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isLandTransportFeasible } from "@/utils/neighboring-countries";
import {
  searchCities, calculateDynamicQuote,
  type City, type DynamicQuoteResult,
} from "@/services/dynamic-shipping";
import { ForwarderSelector, type ForwarderChoice } from "@/components/checkout/ForwarderSelector";
import { FreightSelector, type ConsolidationChoice } from "@/components/checkout/FreightSelector";
import type { EligibleFreightOffer } from "@/services/freightQuoteCheckout";
import {
  groupCartByOriginAndStore,
  type CartOriginGroup,
} from "@/services/freightQuoteCheckout";
import {
  MultiOriginFreightSelector,
  type FreightGroupSelection,
} from "@/components/checkout/MultiOriginFreightSelector";
import { useI18n } from "@/contexts/I18nContext";

const MODE_META = {
  air:  { icon: Plane,     label: "Aérien",     labelKey: "shipping.mode.air",  localLabel: "Aérien local", unit: "kg" },
  sea:  { icon: Ship,      label: "Maritime",   labelKey: "shipping.mode.sea",  localLabel: "Maritime",     unit: "cbm" },
  road: { icon: TruckIcon, label: "Routier",    labelKey: "shipping.mode.road", localLabel: "Routier",      unit: "kg" },
  rail: { icon: Train,     label: "Ferroviaire",labelKey: "shipping.mode.rail", localLabel: "Ferroviaire",  unit: "kg" },
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
  onForwarderChange?: (choice: ForwarderChoice | null, unassigned: boolean) => void;
  onFreightOfferChange?: (offer: EligibleFreightOffer | null, choice?: ConsolidationChoice) => void;
  onFreightAvailabilityChange?: (count: number) => void;
  /** Lot 11C Phase 2 — Mapping des sélections multi-groupes (1 par origine×store). */
  onFreightGroupsChange?: (selections: Record<string, FreightGroupSelection>) => void;
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
  onForwarderChange,
  onFreightOfferChange,
  onFreightAvailabilityChange,
  onFreightGroupsChange,
}: Props) {
  const { t, formatPrice } = useI18n();
  const [products, setProducts] = useState<CartProductInfo[]>([]);
  const [destCity, setDestCity] = useState<City | null>(null);
  const [originCities, setOriginCities] = useState<Map<string, City>>(new Map());
  const [quotes, setQuotes] = useState<Map<string, DynamicQuoteResult[]>>(new Map());
  const [surcharges, setSurcharges] = useState<CategorySurchargeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<TransportMode>(selectedMode || "air");
  const [userHasSelected, setUserHasSelected] = useState(false);
  const [seaThreshold, setSeaThreshold] = useState<{ enabled: boolean; min_subtotal: number } | null>(null);
  const [prepDays, setPrepDays] = useState<{ min: number; max: number }>({ min: 2, max: 5 });
  const [deliveryDefaults, setDeliveryDefaults] = useState<{
    local_hours_min: number; local_hours_max: number;
    intl_prep_min: number; intl_prep_max: number;
    intl_transit_min: number; intl_transit_max: number;
  } | null>(null);
  const [isLocalStore, setIsLocalStore] = useState(false);
  const [forwarderChoice, setForwarderChoice] = useState<ForwarderChoice | null>(null);
  const [forwarderUnassigned, setForwarderUnassigned] = useState(false);
  // Lot 4D — Nouveau moteur freight (coexistence conditionnelle avec legacy)
  const [freightOffer, setFreightOffer] = useState<EligibleFreightOffer | null>(null);
  const [freightChoice, setFreightChoice] = useState<ConsolidationChoice>("split");
  const [hasEligibleFreight, setHasEligibleFreight] = useState(false);
  // Lot 11C Phase 2 — Groupes (store_id × origin_country) du panier.
  const [originGroups, setOriginGroups] = useState<CartOriginGroup[]>([]);
  const [groupSelections, setGroupSelections] = useState<Record<string, FreightGroupSelection>>({});

  // Recalcule les groupes à chaque changement de panier.
  useEffect(() => {
    if (cartItems.length === 0) {
      setOriginGroups([]);
      return;
    }
    let cancelled = false;
    groupCartByOriginAndStore(cartItems).then((groups) => {
      if (!cancelled) setOriginGroups(groups);
    });
    return () => {
      cancelled = true;
    };
  }, [cartItems]);

  const isMultiGroup = originGroups.length > 1;

  // 1. Fetch product details (weight, dimensions, origin, category) for cart items
  useEffect(() => {
    if (cartItems.length === 0) return;
    const ids = [...new Set(cartItems.map(i => i.productId))];
    
    supabase
      .from("products")
      .select("id, weight_grams, length_cm, width_cm, height_cm, origin_country, category_id, prep_days_min, prep_days_max, store_id" as any)
      .in("id", ids)
      .then(({ data }: any) => {
        if (!data) return;
        const mapped = cartItems.map(item => {
          const p = (data as any[]).find((d: any) => d.id === item.productId);
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

        // Calculate max prep days across cart products
        const maxPrepMin = Math.max(...data.map((d: any) => d.prep_days_min ?? 2));
        const maxPrepMax = Math.max(...data.map((d: any) => d.prep_days_max ?? 5));
        setPrepDays({ min: maxPrepMin, max: maxPrepMax });

        // Check if first product's store is local (by shop_type or vendor_mode override)
        const firstStoreId = data[0]?.store_id;
        if (firstStoreId) {
          Promise.all([
            supabase
              .from("stores")
              .select("shop_type, default_transit_days_min, default_transit_days_max")
              .eq("id", firstStoreId)
              .maybeSingle(),
            (supabase as any)
              .from("vendor_pricing_overrides")
              .select("vendor_mode")
              .eq("store_id", firstStoreId)
              .maybeSingle(),
          ]).then(([storeRes, overrideRes]: any[]) => {
            const store = storeRes.data;
            const override = overrideRes.data;
            if (store) {
              const isLocal = (store as any).shop_type === "local" || override?.vendor_mode === "local_only";
              setIsLocalStore(isLocal);
            }
          });
        }
      });
  }, [cartItems]);

  // 2. Fetch sea mode threshold setting
  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "sea_mode_min_order")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object" && !Array.isArray(data.value)) {
          const v = data.value as Record<string, unknown>;
          setSeaThreshold({
            enabled: v.enabled === true,
            min_subtotal: Number(v.min_subtotal) || 29,
          });
        }
      });
  }, []);

  // 2b. Fetch delivery time defaults
  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "delivery_time_defaults")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object" && !Array.isArray(data.value)) {
          const v = data.value as Record<string, unknown>;
          setDeliveryDefaults({
            local_hours_min: Number(v.local_hours_min) || 0.75,
            local_hours_max: Number(v.local_hours_max) || 2,
            intl_prep_min: Number(v.intl_prep_min) || 2,
            intl_prep_max: Number(v.intl_prep_max) || 5,
            intl_transit_min: Number(v.intl_transit_min) || 4,
            intl_transit_max: Number(v.intl_transit_max) || 6,
          });
        }
      });
  }, []);

  // 3. Fetch active category surcharges
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

  // 5. Calculate quotes with surcharges — only when all data is ready
  const dataReady = useMemo(() => {
    if (!destCity || products.length === 0 || originCities.size === 0) return false;
    const neededCountries = [...new Set(products.map(p => p.originCountry))];
    return neededCountries.every(cc => originCities.has(cc));
  }, [destCity, products, originCities]);

  useEffect(() => {
    if (!dataReady || !destCity) return;
    
    setLoading(true);

    // Determine available modes based on store type
    const destCountry = destCity.country_code;
    let modes: TransportMode[];
    
    if (isLocalStore) {
      // Local stores: Air (inter-city), Road, Rail — NO Maritime
      const allLandFeasible = products.every(p => {
        const oc = originCities.get(p.originCountry);
        return oc && isLandTransportFeasible(oc.country_code, destCountry);
      });
      modes = allLandFeasible ? ["air", "road", "rail"] : ["air"];
    } else {
      // International stores: Air + Sea (with threshold), Road/Rail only if neighboring
      const allLandFeasible = products.every(p => {
        const oc = originCities.get(p.originCountry);
        return oc && isLandTransportFeasible(oc.country_code, destCountry);
      });
      modes = allLandFeasible ? ["air", "sea", "road", "rail"] : ["air", "sea"];
    }

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
  }, [dataReady, selectedMode]);

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

  // Check if sea mode is blocked by threshold — compare against calculated sea FREIGHT cost
  const seaQuoteTotal = modeTotals.get("sea")?.total ?? 0;
  const isSeaBlocked = seaThreshold?.enabled === true && seaQuoteTotal < seaThreshold.min_subtotal;
  const seaHasQuotes = modeTotals.has("sea") && seaQuoteTotal > 0;

  // Auto-fallback: if user had sea selected but it's now blocked, switch to air
  useEffect(() => {
    if (isSeaBlocked && activeMode === "sea") {
      setActiveMode("air");
    }
  }, [isSeaBlocked, activeMode]);

  // Notify parent of shipping cost changes
  useEffect(() => {
    // Lot 11C Phase 2 — Si multi-groupes, on agrège les devis sélectionnés.
    if (isMultiGroup) {
      const total = Object.values(groupSelections).reduce((s, sel) => {
        if (!sel.offer) return s;
        const co = sel.offer.consolidation_offer;
        const v =
          sel.choice === "consolidated" && co?.available
            ? co.consolidated_total
            : (sel.offer.split_total ?? sel.offer.quote.total);
        return s + (Number(v) || 0);
      }, 0);
      onShippingCostChange(total, activeMode);
      return;
    }
    // Lot 4D — Si une offre freight (nouveau moteur) est sélectionnée, on l'utilise comme prix
    if (freightOffer) {
      const co = freightOffer.consolidation_offer;
      const effective =
        freightChoice === "consolidated" && co?.available
          ? co.consolidated_total
          : (freightOffer.split_total ?? freightOffer.quote.total);
      onShippingCostChange(effective, activeMode);
      return;
    }
    const selected = modeTotals.get(activeMode);
    const base = selected?.total || 0;
    const multiplier = forwarderChoice ? Number(forwarderChoice.price_multiplier || 1) : 1;
    const adjusted = Math.round(base * multiplier * 100) / 100;
    onShippingCostChange(adjusted, activeMode);
  }, [activeMode, modeTotals, onShippingCostChange, forwarderChoice, freightOffer, freightChoice, isMultiGroup, groupSelections]);

  const handleForwarderChange = useCallback(
    (choice: ForwarderChoice | null, unassigned: boolean) => {
      setForwarderChoice(choice);
      setForwarderUnassigned(unassigned);
      onForwarderChange?.(choice, unassigned);
    },
    [onForwarderChange],
  );

  const handleFreightOfferChange = useCallback(
    (offer: EligibleFreightOffer | null, choice?: ConsolidationChoice) => {
      setFreightOffer(offer);
      setFreightChoice(choice ?? "split");
      onFreightOfferChange?.(offer, choice);
    },
    [onFreightOfferChange],
  );

  // Lot 4G — `hasEligibleFreight` doit refléter la disponibilité d'offres,
  // pas la sélection active (le client doit choisir manuellement).
  const handleFreightAvailabilityChange = useCallback(
    (count: number) => {
      setHasEligibleFreight(count > 0);
      onFreightAvailabilityChange?.(count);
    },
    [onFreightAvailabilityChange],
  );

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
        text:
          t("shipping.addUnitsGeneric", { count: unitsNeeded }) ||
          `Ajoutez ${unitsNeeded} unité${unitsNeeded > 1 ? "s" : ""} pour compléter votre prochain KG et optimiser vos frais de transport.`,
        unitsNeeded,
      };
    }
    return null;
  }, [products, totalWeight]);

  if (!shippingCity || shippingCity.trim().length < 2) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Info size={12} />
        <span>{t("shipping.fillCityHint") || "Renseignez votre ville pour un calcul précis du fret"}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">{t("shipping.calculatingFreight") || "Calcul du fret en cours..."}</span>
      </div>
    );
  }

  if (modeTotals.size === 0 && !loading) {
    return (
      <div className="text-xs text-muted-foreground py-1">
        {t("shipping.standardFreight") || "Fret standard appliqué"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(["air", "sea", "road", "rail"] as TransportMode[]).map(mode => {
          const data = modeTotals.get(mode);
          // Maritime : on garde l'onglet visible MÊME sans quote, en mode grisé,
          // pour informer le client que ce mode existe mais nécessite d'atteindre
          // le seuil de fret minimum. Pour les autres modes, on cache si pas de quote.
          if (mode !== "sea" && (!data || data.total <= 0)) return null;
          if (mode === "sea" && (!data || data.total <= 0) && !seaThreshold?.enabled) {
            return null;
          }
          const seaNoQuote = mode === "sea" && (!data || data.total <= 0);
          const isSeaDisabled = mode === "sea" && (isSeaBlocked || seaNoQuote);
          const Meta = MODE_META[mode];
          const Icon = Meta.icon;
          const isActive = activeMode === mode && !isSeaDisabled;
          
          return (
            <button
              key={mode}
              disabled={isSeaDisabled}
              title={
                seaNoQuote
                  ? (t("shipping.seaTooltip", { min: formatPrice(seaThreshold?.min_subtotal ?? 49) }) ||
                      `Maritime : disponible une fois le seuil de fret de ${formatPrice(seaThreshold?.min_subtotal ?? 49)} atteint`)
                  : undefined
              }
              onClick={() => {
                if (isSeaDisabled) return;
                setUserHasSelected(true);
                setActiveMode(mode);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border ${
                isSeaDisabled
                  ? "border-border bg-muted/50 text-muted-foreground/50 cursor-not-allowed opacity-60"
                  : isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <Icon size={12} />
              <span>{isLocalStore ? Meta.localLabel : (t(Meta.labelKey) || Meta.label)}</span>
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
                    {allSameCountry
                      ? (t("shipping.national") || "National")
                      : (t("shipping.crossBorder") || "Limitrophe")}
                  </span>
                );
              })()}
              {data && data.total > 0 ? (
                <span className="font-bold">{formatPrice(data.total)}</span>
              ) : (
                <span className="text-[10px] italic opacity-70">{t("shipping.locked") || "verrouillé"}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notice tarifs indicatifs (basés sur le poids/CBM réel) */}
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-md px-2.5 py-2 mt-3">
        <Info size={12} className="shrink-0 mt-0.5 text-primary" />
        <p>
          Les tarifs <strong className="text-foreground">Aérien</strong> et{" "}
          <strong className="text-foreground">Maritime</strong> affichés ici sont{" "}
          <strong className="text-foreground">indicatifs</strong>, calculés sur le poids
          (ou le CBM) réel des produits sélectionnés. Le{" "}
          <strong className="text-foreground">tarif réel facturé</strong> est celui défini
          par le transitaire que vous choisirez plus bas dans la section
          « Choisissez un transitaire ».
        </p>
      </div>

      {/* Sea mode threshold hint */}
      {isSeaBlocked && seaHasQuotes && seaThreshold && (() => {
        const freightGap = preciseRound(seaThreshold.min_subtotal - seaQuoteTotal, 2);
        return (
          <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-2 mt-3">
            <Ship size={12} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t("shipping.seaUnavailableTitle") || "🚢 Maritime indisponible — seuil de fret non atteint"}</p>
              <p className="text-[10px] mt-0.5 text-amber-600 dark:text-amber-500">
                {t("shipping.seaThresholdHint", {
                  current: formatPrice(seaQuoteTotal),
                  gap: formatPrice(freightGap),
                  min: formatPrice(seaThreshold.min_subtotal),
                }) ||
                  `Le fret maritime actuel est de ${formatPrice(seaQuoteTotal)} — ajoutez ${formatPrice(freightGap)} de fret pour atteindre ${formatPrice(seaThreshold.min_subtotal)}.`}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Selected mode details */}
      {(() => {
        const data = modeTotals.get(activeMode);
        if (!data) return null;
        const details = quotes.get(activeMode);
        
        return (
          <div className="bg-muted/30 rounded-md px-3 py-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {t("shipping.modeFreightLabel", { mode: t(MODE_META[activeMode].labelKey) || MODE_META[activeMode].label }) ||
                  `Fret ${MODE_META[activeMode].label}`}
              </span>
              <span className="font-bold text-foreground">{formatPrice(data.total)}</span>
            </div>
            {data.surchargeAmount > 0 && (
              <div className="flex justify-between text-[10px] text-amber-600">
                <span>{t("shipping.categorySurcharge") || "Surtaxe catégorie"}</span>
                <span>+{formatPrice(data.surchargeAmount)}</span>
              </div>
            )}
            {data.transitMin && data.transitMax && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{t("shipping.estimatedDelay") || "Délai estimé"}</span>
                <span>{t("freight.transitDays", { min: data.transitMin, max: data.transitMax }) || `${data.transitMin}–${data.transitMax} jours`}</span>
              </div>
            )}
            {totalWeight > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{t("shipping.totalWeight") || "Poids total"}</span>
                <span>{preciseRound(totalWeight / 1000, 3)} kg</span>
              </div>
            )}
            {totalVolume > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{t("shipping.totalVolumeLabel") || "Volume total"}</span>
                <span>{preciseRound(totalVolume, 4)} CBM</span>
              </div>
            )}
            {details?.[0] && (
              <div className="text-[10px] text-muted-foreground/60">
                {(() => {
                  // Affichage origine = PAYS uniquement (jamais une ville arbitraire)
                  // La ville la plus peuplée n'est qu'un proxy interne pour le calcul Haversine.
                  const originCC = details[0].origin_city.match(/\(([A-Z]{2})\)/)?.[1] ?? "";
                  let originLabel = details[0].origin_city;
                  if (originCC) {
                    try {
                      const dn = new Intl.DisplayNames(["fr"], { type: "region" });
                      originLabel = dn.of(originCC) || originCC;
                    } catch {
                      originLabel = originCC;
                    }
                  }
                  return `${originLabel} → ${details[0].destination_city}`;
                })()} · {details[0].distance_km.toLocaleString()} km
                {details[0].route_type === "default" && ` · ${t("shipping.indicativeRate") || "Tarif indicatif"}`}
              </div>
            )}
            {/* Estimated arrival date */}
            {(() => {
              if (isLocalStore && deliveryDefaults) {
                const minH = deliveryDefaults.local_hours_min;
                const maxH = deliveryDefaults.local_hours_max;
                const fmtH = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${h}h`;
                return (
                  <div className="flex items-center gap-1.5 text-sm text-destructive font-semibold pt-1.5 border-t border-border/50 mt-1.5">
                    <CalendarDays size={14} className="shrink-0" />
                    <span>{t("shipping.localDeliveryEstimate", { min: fmtH(minH), max: fmtH(maxH) }) || `🏪 Livraison estimée : ${fmtH(minH)} – ${fmtH(maxH)}`}</span>
                  </div>
                );
              }
              // International: prep + transit
              const transitMin = data.transitMin ?? deliveryDefaults?.intl_transit_min ?? 4;
              const transitMax = data.transitMax ?? deliveryDefaults?.intl_transit_max ?? 6;
              const totalMin = prepDays.min + transitMin;
              const totalMax = prepDays.max + transitMax;
              const now = new Date();
              const dateMin = new Date(now);
              dateMin.setDate(dateMin.getDate() + totalMin);
              const dateMax = new Date(now);
              dateMax.setDate(dateMax.getDate() + totalMax);
              const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
              return (
                <div className="flex items-center gap-1.5 text-sm text-destructive font-semibold pt-1.5 border-t border-border/50 mt-1.5">
                  <CalendarDays size={14} className="shrink-0" />
                  <span>{t("shipping.intlArrivalEstimate", { min: fmt(dateMin), max: fmt(dateMax), year: dateMax.getFullYear() }) || `📦 Arrivée estimée : ${fmt(dateMin)} – ${fmt(dateMax)} ${dateMax.getFullYear()}`}</span>
                </div>
              );
            })()}
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

      {/* Lot 4D — Coexistence conditionnelle :
          1) FreightSelector (nouveau moteur Lot 3A : CBM/pièce/poids volumétrique + acompte)
             affiché uniquement si des profils éligibles existent pour la destination + mode.
          2) ForwarderSelector legacy en fallback silencieux dans le cas contraire,
             pour ne rien casser tant que tous les transitaires n'ont pas migré. */}
      {destCity && modeTotals.get(activeMode) && (
        <>
          {isMultiGroup ? (
            <MultiOriginFreightSelector
              groups={originGroups}
              destinationCountry={destCity.country_code}
              destinationCityId={destCity.id}
              destinationCityName={destCity.name}
              mode={activeMode}
              onSelectionChange={(sels) => {
                setGroupSelections(sels);
                onFreightGroupsChange?.(sels);
              }}
              onAvailabilityChange={(totalCount) => {
                setHasEligibleFreight(totalCount > 0);
                onFreightAvailabilityChange?.(totalCount);
              }}
            />
          ) : (
          <FreightSelector
            destinationCountry={destCity.country_code}
            destinationCityId={destCity.id}
            destinationCityName={destCity.name}
            mode={activeMode}
            originCountry={(() => {
              const origins = [...new Set(products.map((p) => (p.originCountry || "").toUpperCase()).filter(Boolean))];
              // Mono-origine → filtre actif. Multi-origines → pas de filtre (Phase 2 splittera).
              return origins.length === 1 ? origins[0] : null;
            })()}
            items={cartItems.map((ci) => {
              const p = products.find((pp) => pp.productId === ci.productId);
              return {
                quantity: ci.quantity,
                weight_kg: p ? (p.weightGrams * ci.quantity) / 1000 : undefined,
                cbm: p
                  ? (p.lengthCm * p.widthCm * p.heightCm * ci.quantity) / 1_000_000
                  : undefined,
              };
            })}
            totalCbm={totalVolume}
            totalWeightKg={totalWeight / 1000}
            onChange={handleFreightOfferChange}
            onAvailabilityChange={handleFreightAvailabilityChange}
            realPriceIndicative={modeTotals.get(activeMode)?.total ?? 0}
            totalWeightKgForMarketing={totalWeight / 1000}
          />
          )}
          {/* Fallback legacy ForwarderSelector retiré : il ré-affichait des
              transitaires non couvrants (ville/origine ignorées) et causait
              l'effet "transitaire apparaît puis disparaît" au refresh. Le
              FreightSelector / MultiOriginFreightSelector est désormais la
              seule source de vérité pour le choix transitaire au checkout. */}
        </>
      )}
    </div>
  );
}
