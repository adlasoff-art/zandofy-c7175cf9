import { useState, useEffect, useMemo, useCallback } from "react";
import { Plane, Ship, TruckIcon, Train, Loader2, MapPin, Info, Lightbulb, Package, Ruler, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  searchCities, calculateDynamicQuote,
  type City, type DynamicQuoteResult,
} from "@/services/dynamic-shipping";
import { isLandTransportFeasible } from "@/utils/neighboring-countries";

// ── Constants ──
const MODE_META = {
  air:  { icon: Plane,     label: "Aérien",      unit: "kg",  baseLabel: "/ kg" },
  sea:  { icon: Ship,      label: "Maritime",     unit: "cbm", baseLabel: "/ CBM" },
  road: { icon: TruckIcon, label: "Routier",      unit: "kg",  baseLabel: "/ kg" },
  rail: { icon: Train,     label: "Ferroviaire",  unit: "kg",  baseLabel: "/ kg" },
} as const;

type TransportMode = keyof typeof MODE_META;

interface Props {
  productWeightGrams?: number | null;
  productLengthCm?: number | null;
  productWidthCm?: number | null;
  productHeightCm?: number | null;
  originCountry?: string | null;
  quantity: number;
  prepDaysMin?: number;
  prepDaysMax?: number;
}

// ── High-precision math helpers ──
function preciseMultiply(a: number, b: number): number {
  // Use integer arithmetic to avoid floating-point errors
  const factor = 1_000_000;
  return Math.round(a * factor * b) / factor;
}

function preciseRound(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ── Calculation Engine ──
interface PrecisionQuote {
  mode: TransportMode;
  baseRate: number;        // rate per unit (e.g. $/kg or $/CBM)
  totalWeight: number;     // total weight in kg
  totalVolume: number;     // total volume in CBM
  chargeableQty: number;   // the chargeable quantity (kg or CBM)
  basePrice: number;
  fuelSurcharge: number;
  totalPrice: number;
  transitMin: number | null;
  transitMax: number | null;
  fuelPercent: number;
  unit: string;
  routeType: "specific" | "default";
  // Optimization hints
  unitsToNextKg: number | null;
  unitsToNextCbm: number | null;
}

function calculatePrecisionAir(
  weightGrams: number, quantity: number, ratePerKg: number, fuelPct: number, minCharge: number
): { chargeableKg: number; basePrice: number; fuelSurcharge: number; total: number } {
  const totalGrams = preciseMultiply(weightGrams, quantity);
  const chargeableKg = preciseRound(totalGrams / 1000, 4);
  let basePrice = preciseRound(preciseMultiply(chargeableKg, ratePerKg), 2);
  basePrice = Math.max(basePrice, minCharge);
  const fuelSurcharge = preciseRound(preciseMultiply(basePrice, fuelPct / 100), 2);
  const total = preciseRound(basePrice + fuelSurcharge, 2);
  return { chargeableKg, basePrice, fuelSurcharge, total };
}

function calculatePrecisionSea(
  lengthCm: number, widthCm: number, heightCm: number, quantity: number,
  ratePerCbm: number, fuelPct: number, minCharge: number
): { chargeableCbm: number; basePrice: number; fuelSurcharge: number; total: number } {
  const unitVolumeCbm = (lengthCm * widthCm * heightCm) / 1_000_000;
  const chargeableCbm = preciseRound(preciseMultiply(unitVolumeCbm, quantity), 6);
  let basePrice = preciseRound(preciseMultiply(chargeableCbm, ratePerCbm), 2);
  basePrice = Math.max(basePrice, minCharge);
  const fuelSurcharge = preciseRound(preciseMultiply(basePrice, fuelPct / 100), 2);
  const total = preciseRound(basePrice + fuelSurcharge, 2);
  return { chargeableCbm, basePrice, fuelSurcharge, total };
}

export function PrecisionShippingEstimate({
  productWeightGrams,
  productLengthCm,
  productWidthCm,
  productHeightCm,
  originCountry,
  quantity,
  prepDaysMin = 2,
  prepDaysMax = 5,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [originCity, setOriginCity] = useState<City | null>(null);
  const [rawQuotes, setRawQuotes] = useState<DynamicQuoteResult[]>([]);
  const [calculating, setCalculating] = useState(false);

  const weight = productWeightGrams || 0;
  const length = productLengthCm || 0;
  const width = productWidthCm || 0;
  const height = productHeightCm || 0;
  const hasDimensions = length > 0 && width > 0 && height > 0;

  // Resolve origin city — fallback to CD (Congo) if product has no origin_country
  const effectiveOriginCountry = originCountry || "CD";

  useEffect(() => {
    const resolve = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("cities")
        .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
        .eq("country_code", effectiveOriginCountry.toUpperCase())
        .order("population", { ascending: false })
        .limit(1);
      if (error) {
        console.error("[ShippingEstimate] Origin city lookup error:", error);
        return;
      }
      if (data && data.length > 0) {
        setOriginCity(data[0] as unknown as City);
      } else {
        console.warn("[ShippingEstimate] No origin city found for", effectiveOriginCountry);
      }
    };
    resolve();
  }, [effectiveOriginCountry]);

  // City search
  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    const cities = await searchCities(q, 8);
    setResults(cities);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (open) doSearch(query); }, 250);
    return () => clearTimeout(timer);
  }, [query, open, doSearch]);

  // Queue: if user selects a city before originCity resolves, retry once ready
  const [pendingCity, setPendingCity] = useState<City | null>(null);

  const runEstimate = useCallback(async (origin: City, dest: City) => {
    setCalculating(true);
    const landOk = isLandTransportFeasible(origin.country_code, dest.country_code);
    const modes = landOk ? ["air", "sea", "road", "rail"] : ["air", "sea"];
    try {
      const quoteResults = await Promise.all(
        modes.map(mode =>
          calculateDynamicQuote({
            origin_city_id: origin.id,
            destination_city_id: dest.id,
            mode,
            weight_grams: 1000,
            volume_cbm: 1,
            quantity: 1,
          })
        )
      );
      const valid = quoteResults.filter(Boolean) as DynamicQuoteResult[];
      // Quotes computed silently
      setRawQuotes(valid);
    } catch (err) {
      console.error("[ShippingEstimate] Quote calculation error:", err);
    }
    setCalculating(false);
  }, []);

  // Retry pending selection when originCity resolves
  useEffect(() => {
    if (originCity && pendingCity) {
      runEstimate(originCity, pendingCity);
      setPendingCity(null);
    }
  }, [originCity, pendingCity, runEstimate]);

  // Fetch base rates when city selected
  const handleSelect = async (city: City) => {
    setSelectedCity(city);
    setQuery(`${city.name} (${city.country_code})`);
    setOpen(false);

    if (!originCity) {
      console.warn("[ShippingEstimate] originCity not yet resolved, queuing...");
      setPendingCity(city);
      setCalculating(true);
      return;
    }

    await runEstimate(originCity, city);
  };

  // ── Precision quotes recalculated on every quantity/weight change ──
  const precisionQuotes = useMemo<PrecisionQuote[]>(() => {
    if (rawQuotes.length === 0 || !selectedCity) return [];

    return rawQuotes.map(q => {
      const mode = q.mode as TransportMode;
      const fuelPct = q.fuel_percent;
      // Extract the base rate from the raw quote (which was calculated for 1 unit of measure)
      const baseRate = q.base_price; // This is the rate per unit (kg/CBM/etc)
      const minCharge = 0; // already factored in raw quote

      let chargeableQty = 0;
      let totalWeight = 0;
      let totalVolume = 0;
      let basePrice = 0;
      let fuelSurcharge = 0;
      let totalPrice = 0;

      if (q.unit === "cbm" && hasDimensions) {
        // Sea freight: volume-based precision
        const calc = calculatePrecisionSea(length, width, height, quantity, baseRate, fuelPct, minCharge);
        chargeableQty = calc.chargeableCbm;
        totalVolume = calc.chargeableCbm;
        totalWeight = weight > 0 ? preciseRound((weight * quantity) / 1000, 3) : 0;
        basePrice = calc.basePrice;
        fuelSurcharge = calc.fuelSurcharge;
        totalPrice = calc.total;
      } else if (q.unit === "kg" && weight > 0) {
        // Air/Road/Rail: weight-based precision
        const calc = calculatePrecisionAir(weight, quantity, baseRate, fuelPct, minCharge);
        chargeableQty = calc.chargeableKg;
        totalWeight = calc.chargeableKg;
        totalVolume = hasDimensions ? preciseRound((length * width * height * quantity) / 1_000_000, 6) : 0;
        basePrice = calc.basePrice;
        fuelSurcharge = calc.fuelSurcharge;
        totalPrice = calc.total;
      } else {
        // Fallback: use raw quote scaled by quantity
        totalPrice = preciseRound(q.total_price * quantity, 2);
        basePrice = preciseRound(q.base_price * quantity, 2);
        fuelSurcharge = preciseRound(q.fuel_surcharge * quantity, 2);
        chargeableQty = quantity;
      }

      // Optimization hints
      let unitsToNextKg: number | null = null;
      let unitsToNextCbm: number | null = null;

      if (weight > 0 && q.unit === "kg") {
        const currentTotalGrams = weight * quantity;
        const nextKgBoundary = Math.ceil(currentTotalGrams / 1000) * 1000;
        if (nextKgBoundary > currentTotalGrams) {
          const gramsNeeded = nextKgBoundary - currentTotalGrams;
          unitsToNextKg = Math.ceil(gramsNeeded / weight);
        }
      }

      if (hasDimensions && q.unit === "cbm") {
        const unitVol = (length * width * height) / 1_000_000;
        const currentVol = unitVol * quantity;
        const nextCbmBoundary = Math.ceil(currentVol * 10) / 10; // next 0.1 CBM
        if (nextCbmBoundary > currentVol) {
          const volNeeded = nextCbmBoundary - currentVol;
          unitsToNextCbm = Math.ceil(volNeeded / unitVol);
        }
      }

      return {
        mode,
        baseRate,
        totalWeight,
        totalVolume,
        chargeableQty,
        basePrice,
        fuelSurcharge,
        totalPrice,
        transitMin: q.transit_min,
        transitMax: q.transit_max,
        fuelPercent: fuelPct,
        unit: q.unit,
        routeType: q.route_type,
        unitsToNextKg,
        unitsToNextCbm,
      };
    }).filter(q => q.totalPrice > 0);
  }, [rawQuotes, quantity, weight, length, width, height, hasDimensions, selectedCity]);

  // Best optimization tip
  const optimizationTip = useMemo(() => {
    if (!precisionQuotes.length) return null;
    const airQuote = precisionQuotes.find(q => q.mode === "air");
    const seaQuote = precisionQuotes.find(q => q.mode === "sea");

    if (airQuote?.unitsToNextKg && airQuote.unitsToNextKg > 0 && airQuote.unitsToNextKg <= 10) {
      const currentCostPerUnit = preciseRound(airQuote.totalPrice / quantity, 2);
      const futureQty = quantity + airQuote.unitsToNextKg;
      const futureTotal = preciseRound(preciseMultiply(Math.ceil((weight * futureQty) / 1000), airQuote.baseRate), 2);
      const futureCostPerUnit = preciseRound(futureTotal / futureQty, 2);
      if (futureCostPerUnit < currentCostPerUnit) {
        return {
          text: `Ajoutez ${airQuote.unitsToNextKg} unité${airQuote.unitsToNextKg > 1 ? "s" : ""} pour compléter votre prochain KG et optimiser vos coûts de transport aérien.`,
          savings: preciseRound(currentCostPerUnit - futureCostPerUnit, 2),
        };
      }
    }

    if (seaQuote?.unitsToNextCbm && seaQuote.unitsToNextCbm > 0 && seaQuote.unitsToNextCbm <= 20) {
      return {
        text: `Ajoutez ${seaQuote.unitsToNextCbm} unité${seaQuote.unitsToNextCbm > 1 ? "s" : ""} pour compléter votre prochain 0.1 CBM et optimiser vos coûts de fret maritime.`,
        savings: null,
      };
    }
    return null;
  }, [precisionQuotes, quantity, weight]);

  return (
    <div className="space-y-3">
      {/* City search */}
      <div className="relative">
        <MapPin size={14} className="absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { if (!loading) setOpen(false); }, 400)}
          placeholder="Entrez votre ville pour estimer..."
          className="h-9 pl-8 text-sm w-full max-w-full"
          style={{ fontSize: '16px' }}
        />
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-44 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 flex items-center justify-center">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? results.map(city => (
              <button
                key={city.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 transition-colors"
                onPointerDown={e => { e.preventDefault(); handleSelect(city); }}
              >
                <MapPin size={12} className="text-primary shrink-0" />
                <span className="truncate font-medium">{city.name}</span>
                <span className="text-xs text-muted-foreground">{city.country_code}</span>
              </button>
            )) : (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">Aucune ville trouvée</div>
            )}
          </div>
        )}
      </div>

      {calculating && (
        <div className="flex items-center justify-center py-3">
          <Loader2 size={16} className="animate-spin text-primary mr-2" />
          <span className="text-xs text-muted-foreground">Calcul en cours...</span>
        </div>
      )}

      {precisionQuotes.length > 0 && !calculating && (
        <div className="space-y-2">
          {precisionQuotes.map(q => {
            const Meta = MODE_META[q.mode];
            const Icon = Meta?.icon || TruckIcon;
            return (
              <div key={q.mode} className="bg-muted/50 rounded-sm overflow-hidden">
                {/* Main row */}
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-primary" />
                    <span className="font-medium">{Meta?.label || q.mode}</span>
                    {(q.mode === "road" || q.mode === "rail") && originCity && selectedCity && (
                      <Badge className={`text-[9px] px-1.5 py-0 h-4 ${
                        originCity.country_code === selectedCity.country_code
                          ? "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700"
                          : "bg-sky-500/15 text-sky-700 border-sky-300 dark:text-sky-400 dark:border-sky-700"
                      }`} variant="outline">
                        {originCity.country_code === selectedCity.country_code ? "National" : "Limitrophe"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground">${q.totalPrice.toFixed(2)}</span>
                    {q.transitMin && q.transitMax && (
                      <p className="text-[10px] text-muted-foreground">{q.transitMin}–{q.transitMax} jours</p>
                    )}
                    {q.transitMin != null && q.transitMax != null && (() => {
                      const totalMin = prepDaysMin + q.transitMin;
                      const totalMax = prepDaysMax + q.transitMax;
                      const now = new Date();
                      const dMin = new Date(now); dMin.setDate(dMin.getDate() + totalMin);
                      const dMax = new Date(now); dMax.setDate(dMax.getDate() + totalMax);
                      const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                      return (
                        <p className="text-[10px] text-primary font-medium flex items-center gap-1">
                          <CalendarDays size={9} />
                          {fmt(dMin)} – {fmt(dMax)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                {/* Breakdown */}
                <div className="px-3 pb-2 text-[10px] text-muted-foreground space-y-0.5">
                  <div className="flex justify-between">
                    <span>Tarif de base</span>
                    <span>${q.baseRate.toFixed(2)} {Meta?.baseLabel}</span>
                  </div>
                  {q.unit === "kg" && q.totalWeight > 0 && (
                    <div className="flex justify-between">
                      <span>Poids total ({quantity} × {weight}g)</span>
                      <span>{q.totalWeight.toFixed(3)} kg</span>
                    </div>
                  )}
                  {q.unit === "cbm" && q.totalVolume > 0 && (
                    <div className="flex justify-between">
                      <span>Volume total ({quantity} × {length}×{width}×{height}cm)</span>
                      <span>{q.totalVolume.toFixed(4)} CBM</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Fret de base</span>
                    <span>${q.basePrice.toFixed(2)}</span>
                  </div>
                  {q.fuelSurcharge > 0 && (
                    <div className="flex justify-between">
                      <span>Surtaxe carburant ({q.fuelPercent}%)</span>
                      <span>${q.fuelSurcharge.toFixed(2)}</span>
                    </div>
                  )}
                  {q.routeType === "default" && (
                    <span className="text-[9px] text-muted-foreground/60 italic">Tarif indicatif</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Route info */}
          {rawQuotes[0] && (
            <p className="text-[10px] text-muted-foreground">
              {rawQuotes[0].origin_city} → {rawQuotes[0].destination_city} · {rawQuotes[0].distance_km.toLocaleString()} km
            </p>
          )}

          {/* Info message for international-only routes */}
          {selectedCity && originCity && !isLandTransportFeasible(originCity.country_code, selectedCity.country_code) && (
            <div className="flex items-start gap-2 bg-muted/40 border border-border rounded-sm px-2.5 py-2">
              <Info size={12} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">
                Seuls les modes <strong className="text-foreground">Aérien</strong> et <strong className="text-foreground">Maritime</strong> sont disponibles pour les routes internationales. Le Routier et le Ferroviaire ne sont proposés que pour les trajets nationaux ou entre pays limitrophes.
              </p>
            </div>
          )}

          {/* Optimization advice */}
          {optimizationTip && (
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-sm px-3 py-2">
              <Lightbulb size={14} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-foreground">Optimisation</p>
                <p className="text-[10px] text-muted-foreground">{optimizationTip.text}</p>
                {optimizationTip.savings && (
                  <p className="text-[10px] font-semibold text-primary">
                    Économie potentielle : ${optimizationTip.savings}/unité
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Weight/Volume summary */}
          {weight > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package size={10} /> {weight}g/unité · {quantity} unités = {preciseRound((weight * quantity) / 1000, 3)} kg
              </span>
              {weight < 1000 && (
                <span className="text-primary">
                  ({Math.floor(1000 / weight)} unités/kg)
                </span>
              )}
            </div>
          )}
          {hasDimensions && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Ruler size={10} /> {length}×{width}×{height}cm · {preciseRound((length * width * height * quantity) / 1_000_000, 4)} CBM
            </div>
          )}
        </div>
      )}
    </div>
  );
}
