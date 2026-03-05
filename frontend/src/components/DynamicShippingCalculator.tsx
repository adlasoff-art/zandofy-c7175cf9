import { useState, useEffect, useMemo, useCallback } from "react";
import { Plane, Ship, TruckIcon, Calculator, Package, Loader2, MapPin, ArrowRight, Globe, Ruler } from "lucide-react";
import { isLandTransportFeasible } from "@/utils/neighboring-countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  searchCities, calculateDynamicQuote,
  type City, type DynamicQuoteResult,
} from "@/services/dynamic-shipping";

// ── City Autocomplete ──
function CityAutocomplete({ label, value, onSelect }: {
  label: string;
  value: City | null;
  onSelect: (city: City) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value) setQuery(`${value.name} (${value.country_code})`);
  }, [value]);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    const cities = await searchCities(q, 12);
    setResults(cities);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) doSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, doSearch]);

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="relative">
        <MapPin size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Rechercher une ville..."
          className="h-9 pl-8 text-sm"
        />
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 flex items-center justify-center">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? results.map(city => (
              <button
                key={city.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between transition-colors"
                onMouseDown={e => { e.preventDefault(); onSelect(city); setQuery(`${city.name} (${city.country_code})`); setOpen(false); }}
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
            )) : (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                Aucune ville trouvée
              </div>
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
  { value: "sea", label: "Maritime", icon: Ship, desc: "Économique, par CBM" },
  { value: "road", label: "Routier", icon: TruckIcon, desc: "Régional, fixe/km" },
  { value: "rail", label: "Ferroviaire", icon: TruckIcon, desc: "Corridor, par kg" },
];

// ── Main Calculator ──
export function DynamicShippingCalculator() {
  const [originCity, setOriginCity] = useState<City | null>(null);
  const [destCity, setDestCity] = useState<City | null>(null);
  const [mode, setMode] = useState("air");
  const [weightGrams, setWeightGrams] = useState(1000);
  const [volumeCbm, setVolumeCbm] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<DynamicQuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    if (!originCity || !destCity) return;
    setLoading(true);
    setError(null);
    setQuote(null);

    const result = await calculateDynamicQuote({
      origin_city_id: originCity.id,
      destination_city_id: destCity.id,
      mode,
      weight_grams: weightGrams,
      volume_cbm: volumeCbm,
      quantity,
    });

    if (!result) {
      setError("Aucun tarif trouvé pour cette route/mode. Configurez d'abord les zones et tarifs.");
    } else {
      setQuote(result);
    }
    setLoading(false);
  };

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

        {/* Quantity inputs */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Poids (g)</Label>
            <Input
              type="number" min="1" value={weightGrams}
              onChange={e => setWeightGrams(parseInt(e.target.value) || 0)}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">{(weightGrams / 1000).toFixed(3)} kg</p>
          </div>
          <div>
            <Label className="text-xs">Volume (CBM)</Label>
            <Input
              type="number" min="0.001" step="0.01" value={volumeCbm}
              onChange={e => setVolumeCbm(parseFloat(e.target.value) || 0)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Quantité</Label>
            <Input
              type="number" min="1" value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value) || 1)}
              className="h-9 text-sm"
            />
          </div>
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
