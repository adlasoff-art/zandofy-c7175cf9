import { useState, useCallback, useEffect } from "react";
import { Plane, Ship, TruckIcon, Loader2, MapPin, ArrowRight, Ruler, Package, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchCities, calculateDynamicQuote,
  type City, type DynamicQuoteResult,
} from "@/services/dynamic-shipping";
import { isLandTransportFeasible } from "@/utils/neighboring-countries";

const MODE_ICONS = { air: Plane, sea: Ship, road: TruckIcon, rail: TruckIcon } as const;
const MODE_LABELS = { air: "Aérien", sea: "Maritime", road: "Routier", rail: "Ferroviaire" } as const;

interface Props {
  productWeightGrams?: number | null;
  originCountry?: string | null;
}

export function ProductShippingEstimator({ productWeightGrams, originCountry }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [originCity, setOriginCity] = useState<City | null>(null);
  const [quotes, setQuotes] = useState<DynamicQuoteResult[]>([]);
  const [calculating, setCalculating] = useState(false);

  // Resolve origin city from originCountry (country_code like "CN")
  useEffect(() => {
    if (!originCountry) return;
    const resolveOrigin = async () => {
      const { data } = await (await import("@/integrations/supabase/client")).supabase
        .from("cities")
        .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
        .eq("country_code", originCountry.toUpperCase())
        .order("population", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setOriginCity(data[0] as unknown as City);
    };
    resolveOrigin();
  }, [originCountry]);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    const cities = await searchCities(q, 8);
    setResults(cities);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) doSearch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open, doSearch]);

  const handleSelect = async (city: City) => {
    setSelectedCity(city);
    setQuery(`${city.name} (${city.country_code})`);
    setOpen(false);

    if (!originCity) return;

    setCalculating(true);
    // Show road/rail if same country or neighboring countries
    const landOk = originCity && isLandTransportFeasible(originCity.country_code, city.country_code);
    const modes = landOk ? ["air", "sea", "road", "rail"] : ["air", "sea"];
    const weight = productWeightGrams || 1000;

    const results = await Promise.all(
      modes.map(mode =>
        calculateDynamicQuote({
          origin_city_id: originCity.id,
          destination_city_id: city.id,
          mode,
          weight_grams: weight,
          volume_cbm: 0.01,
          quantity: 1,
        })
      )
    );
    setQuotes(results.filter(Boolean) as DynamicQuoteResult[]);
    setCalculating(false);
  };

  return (
    <div className="space-y-3">
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

      {quotes.length > 0 && !calculating && (
        <div className="space-y-2">
          {quotes.map(q => {
            const Icon = MODE_ICONS[q.mode as keyof typeof MODE_ICONS] || TruckIcon;
            return (
              <div key={q.mode} className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-sm text-sm">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-primary" />
                  <span className="font-medium">{MODE_LABELS[q.mode as keyof typeof MODE_LABELS] || q.mode}</span>
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
                  <span className="font-bold text-foreground">${q.total_price.toFixed(2)}</span>
                  {q.transit_min && q.transit_max && (
                    <p className="text-[10px] text-muted-foreground">{q.transit_min}–{q.transit_max} jours</p>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground">
            {quotes[0]?.origin_city} → {quotes[0]?.destination_city} · {quotes[0]?.distance_km.toLocaleString()} km
            {quotes[0]?.route_type === "default" && " · Tarif indicatif"}
          </p>
          {/* Info message when only air/sea are shown */}
          {selectedCity && originCity && !isLandTransportFeasible(originCity.country_code, selectedCity.country_code) && (
            <div className="flex items-start gap-2 bg-muted/40 border border-border rounded-md px-2.5 py-2">
              <Info size={12} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">
                Seuls les modes <strong className="text-foreground">Aérien</strong> et <strong className="text-foreground">Maritime</strong> sont disponibles pour les routes internationales. Le Routier et le Ferroviaire ne sont proposés que pour les trajets nationaux ou entre pays limitrophes.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
