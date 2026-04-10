import { useState, useEffect, useMemo, useCallback } from "react";
import { Plane, Ship, TruckIcon, Calculator, Package, Loader2, MapPin, ArrowRight, Globe, Ruler } from "lucide-react";
import { isLandTransportFeasible } from "@/utils/neighboring-countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  searchCities, calculateDynamicQuote,
  type City, type DynamicQuoteResult,
} from "@/services/dynamic-shipping";
import { WORLD_CITIES, type WorldCity } from "@/data/world-cities";
import { supabase } from "@/integrations/supabase/client";

// ── City Autocomplete (DB + WORLD_CITIES fallback) ──
function CityAutocomplete({ label, value, onSelect }: {
  label: string;
  value: City | null;
  onSelect: (city: City) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [worldResults, setWorldResults] = useState<WorldCity[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value) setQuery(`${value.name} (${value.country_code})`);
  }, [value]);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    // Search DB cities
    const dbCities = await searchCities(q, 12);
    setResults(dbCities);

    // Also search WORLD_CITIES for broader coverage
    if (q.trim()) {
      const ql = q.toLowerCase();
      const wc = WORLD_CITIES.filter(c =>
        c.city.toLowerCase().includes(ql) || c.country.toLowerCase().includes(ql) || c.countryCode.toLowerCase().includes(ql)
      ).filter(wc => !dbCities.some(dc => dc.name.toLowerCase() === wc.city.toLowerCase() && dc.country_code === wc.countryCode))
       .slice(0, 8);
      setWorldResults(wc);
    } else {
      setWorldResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) doSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, doSearch]);

  // When selecting a WORLD_CITY not in DB, auto-insert it
  const handleSelectWorldCity = useCallback(async (wc: WorldCity) => {
    setOpen(false);
    setLoading(true);
    // Try to find or create in DB
    const { data: existing } = await supabase
      .from("cities")
      .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
      .ilike("name", wc.city)
      .eq("country_code", wc.countryCode)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const city = existing as unknown as City;
      onSelect(city);
      setQuery(`${city.name} (${city.country_code})`);
    } else {
      // Auto-insert with approximate coords (from WORLD_CITIES we don't have coords, use 0,0 placeholder)
      // For a proper solution, we'd need coords. For now insert with name.
      const { data: inserted, error } = await supabase
        .from("cities")
        .insert({ name: wc.city, country_code: wc.countryCode, latitude: 0, longitude: 0, population: 0 })
        .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
        .single();

      if (!error && inserted) {
        const city = inserted as unknown as City;
        onSelect(city);
        setQuery(`${city.name} (${city.country_code})`);
      }
    }
    setLoading(false);
  }, [onSelect]);

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="relative">
        <MapPin size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { if (!loading) setOpen(false); }, 400)}
          placeholder="Rechercher une ville (mondiale)..."
          className="h-9 pl-8 text-sm"
        />
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 flex items-center justify-center">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* DB cities */}
                {results.map(city => (
                  <button
                    key={city.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between transition-colors"
                    onPointerDown={e => { e.preventDefault(); onSelect(city); setQuery(`${city.name} (${city.country_code})`); setOpen(false); }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin size={12} className="text-primary shrink-0" />
                      <span className="truncate font-medium">{city.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{city.country_code}</span>
                    </div>
                    {city.logistic_zone && (
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{city.logistic_zone.name}</Badge>
                    )}
                  </button>
                ))}
                {/* WORLD_CITIES fallback */}
                {worldResults.length > 0 && (
                  <>
                    {results.length > 0 && <div className="border-t border-border" />}
                    <div className="px-3 py-1 text-[10px] text-muted-foreground bg-muted/30">Villes mondiales</div>
                    {worldResults.map((wc, i) => (
                      <button
                        key={`wc-${wc.countryCode}-${wc.city}-${i}`}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between transition-colors"
                        onPointerDown={e => { e.preventDefault(); handleSelectWorldCity(wc); }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe size={12} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{wc.city}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{wc.country} ({wc.countryCode})</span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {results.length === 0 && worldResults.length === 0 && (
                  <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                    Aucune ville trouvée
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mode Selector ──
const ALL_MODES = [
  { value: "air", label: "Aérien", icon: Plane, desc: "Rapide, par kg" },
  { value: "sea", label: "Maritime", icon: Ship, desc: "Économique, par CBM/kg" },
  { value: "road", label: "Routier", icon: TruckIcon, desc: "Régional, fixe/km" },
  { value: "rail", label: "Ferroviaire", icon: TruckIcon, desc: "Corridor, par kg" },
];

// ── Main Calculator ──
export function DynamicShippingCalculator() {
  const [originCity, setOriginCity] = useState<City | null>(null);
  const [destCity, setDestCity] = useState<City | null>(null);
  const [mode, setMode] = useState("air");
  const [weightKg, setWeightKg] = useState(1);
  const [quantity, setQuantity] = useState(1);
  // Dimensions for CBM calculation (maritime)
  const [lengthCm, setLengthCm] = useState(0);
  const [widthCm, setWidthCm] = useState(0);
  const [heightCm, setHeightCm] = useState(0);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<DynamicQuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Computed CBM from dimensions
  const computedCbm = useMemo(() => {
    if (lengthCm > 0 && widthCm > 0 && heightCm > 0) {
      return (lengthCm * widthCm * heightCm) / 1_000_000; // cm³ → m³
    }
    return 0;
  }, [lengthCm, widthCm, heightCm]);

  const totalCbm = computedCbm * Math.max(quantity, 1);

  const handleCalculate = async () => {
    if (!originCity || !destCity) return;
    setLoading(true);
    setError(null);
    setQuote(null);

    const weightGrams = Math.round(weightKg * 1000 * quantity);

    const result = await calculateDynamicQuote({
      origin_city_id: originCity.id,
      destination_city_id: destCity.id,
      mode,
      weight_grams: weightGrams,
      volume_cbm: mode === "sea" ? totalCbm : undefined,
      quantity,
    });

    if (!result) {
      setError("Aucun tarif trouvé pour cette route/mode. Configurez d'abord les zones et tarifs.");
    } else {
      setQuote(result);
    }
    setLoading(false);
  };

  const isSea = mode === "sea";
  const isLand = mode === "road" || mode === "rail";

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-primary/5 border-b border-border px-5 py-3 flex items-center gap-2">
        <Globe size={18} className="text-primary" />
        <h2 className="font-semibold text-sm">Calculateur Dynamique de Fret</h2>
      </div>

      <div className="p-5 space-y-4">
        {/* Cities */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CityAutocomplete label="Ville d'origine" value={originCity} onSelect={setOriginCity} />
          <CityAutocomplete label="Ville de destination" value={destCity} onSelect={setDestCity} />
        </div>

        {/* Mode */}
        <div>
          <Label className="text-xs font-medium">Mode de transport</Label>
          {(() => {
            const landOk = originCity && destCity && isLandTransportFeasible(originCity.country_code, destCity.country_code);
            const MODES = landOk ? ALL_MODES : ALL_MODES.filter(m => m.value === "air" || m.value === "sea");
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {MODES.map(m => {
                  const Icon = m.icon;
                  const active = mode === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition-all ${
                        active
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:border-primary/40 text-muted-foreground"
                      }`}
                    >
                      <Icon size={16} />
                      <span>{m.label}</span>
                      <span className="text-[10px] opacity-70">{m.desc}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Weight + Quantity (always shown) */}
        <div className={`grid gap-3 ${isSea ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
          <div>
            <Label className="text-xs">Poids unitaire (kg)</Label>
            <Input
              type="number" min="0.01" step="0.01" value={weightKg}
              onChange={e => setWeightKg(parseFloat(e.target.value) || 0)}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(weightKg * 1000)} g</p>
          </div>
          <div>
            <Label className="text-xs">Quantité</Label>
            <Input
              type="number" min="1" value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value) || 1)}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Total: {(weightKg * quantity).toFixed(2)} kg</p>
          </div>

          {/* Dimensions for maritime only */}
          {isSea && (
            <>
              <div className="col-span-2 grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Longueur (cm)</Label>
                  <Input
                    type="number" min="0" step="1" value={lengthCm || ""}
                    onChange={e => setLengthCm(parseFloat(e.target.value) || 0)}
                    className="h-9 text-sm" placeholder="L"
                  />
                </div>
                <div>
                  <Label className="text-xs">Largeur (cm)</Label>
                  <Input
                    type="number" min="0" step="1" value={widthCm || ""}
                    onChange={e => setWidthCm(parseFloat(e.target.value) || 0)}
                    className="h-9 text-sm" placeholder="l"
                  />
                </div>
                <div>
                  <Label className="text-xs">Hauteur (cm)</Label>
                  <Input
                    type="number" min="0" step="1" value={heightCm || ""}
                    onChange={e => setHeightCm(parseFloat(e.target.value) || 0)}
                    className="h-9 text-sm" placeholder="H"
                  />
                </div>
              </div>
              {computedCbm > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Volume unitaire: <strong className="text-foreground">{computedCbm.toFixed(4)} CBM</strong>
                    {quantity > 1 && <> — Total: <strong className="text-foreground">{totalCbm.toFixed(4)} CBM</strong></>}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Calculate button */}
        <Button
          onClick={handleCalculate}
          disabled={!originCity || !destCity || loading}
          className="w-full"
        >
          {loading ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Calculator size={14} className="mr-2" />}
          Calculer le devis
        </Button>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Quote Result */}
        {quote && (
          <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
            {/* Route info */}
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="gap-1">
                {mode === "air" ? <Plane size={12} /> : mode === "sea" ? <Ship size={12} /> : <TruckIcon size={12} />}
                {ALL_MODES.find(m => m.value === mode)?.label}
              </Badge>
              <span className="text-muted-foreground text-xs truncate">
                {quote.origin_city}
              </span>
              <ArrowRight size={12} className="text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-xs truncate">
                {quote.destination_city}
              </span>
            </div>

            {/* Zones */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Globe size={11} />
              <span>{quote.origin_zone}</span>
              <ArrowRight size={10} />
              <span>{quote.destination_zone}</span>
              {quote.route_type === "default" && (
                <Badge variant="secondary" className="text-[9px] ml-auto">Tarif défaut</Badge>
              )}
            </div>

            {/* Distance */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Ruler size={11} />
              <span>Distance: <strong className="text-foreground">{quote.distance_km.toLocaleString()} km</strong></span>
            </div>

            {/* Quantity / Weight summary */}
            {quantity > 1 && (
              <div className="text-xs text-muted-foreground">
                📦 {quantity} unité(s) × {weightKg} kg = <strong className="text-foreground">{(weightKg * quantity).toFixed(2)} kg total</strong>
                {isSea && totalCbm > 0 && <> — {totalCbm.toFixed(4)} CBM</>}
              </div>
            )}

            {/* Price breakdown */}
            <div className="border-t border-border pt-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tarif de base ({quote.unit})</span>
                <span className="font-mono">${quote.base_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Surcharge carburant ({quote.fuel_percent}%)</span>
                <span className="font-mono">${quote.fuel_surcharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                <span>Total</span>
                <span className="text-primary text-lg">${quote.total_price.toFixed(2)}</span>
              </div>
            </div>

            {/* Transit */}
            {quote.transit_min && quote.transit_max && (
              <div className="text-xs text-muted-foreground">
                ⏱ Transit estimé: <strong className="text-foreground">{quote.transit_min}–{quote.transit_max} jours</strong>
              </div>
            )}

            {/* Pack Efficiency */}
            {quote.pack_efficiency && (
              <div className="bg-accent/20 rounded-lg p-2.5 flex items-start gap-2 text-xs">
                <Package size={14} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <strong>Pack Efficiency</strong>
                  <p className="text-muted-foreground mt-0.5">
                    Votre article pèse {quote.pack_efficiency.weight_grams}g.
                    Vous pouvez expédier <strong className="text-foreground">{quote.pack_efficiency.units_per_kg} unités par kg</strong> pour
                    optimiser le coût à ${(quote.total_price / quote.pack_efficiency.units_per_kg).toFixed(2)}/unité.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
