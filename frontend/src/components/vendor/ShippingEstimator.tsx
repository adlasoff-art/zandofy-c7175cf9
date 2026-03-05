import { useState, useEffect } from "react";
import { Plane, Ship, TruckIcon, Calculator, Package, Loader2 } from "lucide-react";
import {
  fetchShippingZones, fetchShippingRoutes, fetchShippingDefaults,
  calculateShippingQuote,
  type ShippingZone, type ShippingRoute, type ShippingDefault,
} from "@/services/shipping";

interface Props {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  categoryId?: string;
}

export function ShippingEstimator({ weightGrams, lengthCm, widthCm, heightCm, categoryId }: Props) {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [routes, setRoutes] = useState<ShippingRoute[]>([]);
  const [defaults, setDefaults] = useState<ShippingDefault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchShippingZones(), fetchShippingRoutes(), fetchShippingDefaults()])
      .then(([z, r, d]) => { setZones(z); setRoutes(r); setDefaults(d); })
      .finally(() => setLoading(false));
  }, []);

  const volumeCBM = (lengthCm * widthCm * heightCm) / 1_000_000;
  const hasWeight = weightGrams > 0;
  const hasDimensions = lengthCm > 0 && widthCm > 0 && heightCm > 0;

  if (!hasWeight && !hasDimensions) {
    return (
      <div className="bg-muted/30 border border-border rounded-lg p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Calculator size={12} />
          Renseignez le poids et/ou les dimensions pour estimer les frais de port.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-center justify-center">
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get estimates for the most common routes (first 3 active routes or defaults)
  const activeRoutes = routes.filter(r => r.is_active);
  const estimates: { label: string; mode: string; cost: number; transit: string; packEff?: { unitsPerKg: number; weightGrams: number } }[] = [];

  // Try to compute for each unique origin→dest route
  const seen = new Set<string>();
  for (const route of activeRoutes.slice(0, 10)) {
    const key = `${route.origin_zone_id}-${route.destination_zone_id}-${route.transport_mode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const originName = route.origin_zone?.name || zones.find(z => z.id === route.origin_zone_id)?.name || "?";
    const destName = route.destination_zone?.name || zones.find(z => z.id === route.destination_zone_id)?.name || "?";

    const quote = calculateShippingQuote({
      route,
      weightGrams: hasWeight ? weightGrams : 0,
      volumeCBM: hasDimensions ? volumeCBM : 0,
    });

    estimates.push({
      label: `${originName} → ${destName}`,
      mode: route.transport_mode,
      cost: quote.totalCost,
      transit: quote.transitDays,
      packEff: quote.packEfficiency,
    });

    if (estimates.length >= 4) break;
  }

  // If no routes, try defaults
  if (estimates.length === 0 && defaults.length > 0) {
    for (const def of defaults) {
      const fakeRoute: ShippingRoute = {
        id: "default", origin_zone_id: "", destination_zone_id: "",
        transport_mode: def.mode, rate_unit: def.rate_unit, rate_price: def.default_rate,
        min_charge: 0, fuel_surcharge_pct: 0, transit_days_min: null, transit_days_max: null,
        is_active: true, notes: null, created_at: "", updated_at: "",
      };
      const quote = calculateShippingQuote({
        route: fakeRoute,
        weightGrams: hasWeight ? weightGrams : 0,
        volumeCBM: hasDimensions ? volumeCBM : 0,
      });
      estimates.push({
        label: `Tarif par défaut`,
        mode: def.mode,
        cost: quote.totalCost,
        transit: quote.transitDays,
        packEff: quote.packEfficiency,
      });
    }
  }

  const modeIcons: Record<string, React.ReactNode> = {
    air: <Plane size={12} />,
    sea: <Ship size={12} />,
    road: <TruckIcon size={12} />,
    rail: <TruckIcon size={12} />,
  };

  const modeLabels: Record<string, string> = {
    air: "Aérien",
    sea: "Maritime",
    road: "Routier",
    rail: "Ferroviaire",
  };

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Calculator size={12} className="text-primary" />
        Estimation frais de port
      </h4>
      <div className="text-[11px] text-muted-foreground">
        Poids: {hasWeight ? `${weightGrams}g (${(weightGrams / 1000).toFixed(3)} kg)` : "—"}
        {hasDimensions && ` · Vol: ${volumeCBM.toFixed(4)} CBM`}
      </div>

      {estimates.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun tarif configuré. Contactez l'administrateur.</p>
      ) : (
        <div className="space-y-1.5">
          {estimates.map((est, i) => (
            <div key={i} className="flex items-center justify-between bg-card border border-border rounded px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-primary shrink-0">{modeIcons[est.mode]}</span>
                <span className="text-[11px] text-muted-foreground truncate">{est.label}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">({modeLabels[est.mode]})</span>
              </div>
              <div className="text-right shrink-0 ml-2">
                <span className="text-xs font-semibold text-primary">${est.cost.toFixed(2)}</span>
                {est.transit !== "N/A" && (
                  <span className="text-[10px] text-muted-foreground ml-1">· {est.transit}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {estimates.some(e => e.packEff) && (
        <div className="text-[11px] bg-accent/20 rounded p-1.5 flex items-start gap-1">
          <Package size={11} className="shrink-0 mt-0.5 text-primary" />
          <span>
            <strong>Pack Efficiency:</strong>{" "}
            {estimates.find(e => e.packEff)?.packEff?.unitsPerKg} unités/kg pour optimiser
          </span>
        </div>
      )}
    </div>
  );
}
