import { useEffect, useMemo, useState } from "react";
import { Loader2, Truck, Info, BadgeCheck } from "lucide-react";
import {
  fetchEligibleForwarders,
  fetchForwardersConfig,
  type EligibleForwarder,
  type ForwardersConfig,
} from "@/services/forwarders";

export interface ForwarderChoice {
  forwarder_id: string;
  forwarder_name: string;
  tier: string;
  price_multiplier: number;
  quoted_price: number;
  transit_min_days: number | null;
  transit_max_days: number | null;
}

interface Props {
  country: string;
  cityId?: string | null;
  mode: string;
  baseShippingCost: number;
  onChange: (choice: ForwarderChoice | null, unassigned: boolean) => void;
}

const TIER_LABELS: Record<string, string> = {
  express: "Express",
  standard: "Standard",
  vip: "VIP",
};

export function ForwarderSelector({ country, cityId, mode, baseShippingCost, onChange }: Props) {
  const [config, setConfig] = useState<ForwardersConfig | null>(null);
  const [list, setList] = useState<EligibleForwarder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Load config once
  useEffect(() => {
    fetchForwardersConfig().then(setConfig);
  }, []);

  // Load eligible forwarders on context change
  useEffect(() => {
    if (!config?.enabled || !country || !mode) {
      setList([]);
      return;
    }
    setLoading(true);
    fetchEligibleForwarders({ country, cityId, mode })
      .then(setList)
      .finally(() => setLoading(false));
  }, [config?.enabled, country, cityId, mode]);

  // Build options with computed final price
  const options = useMemo(() => {
    return list.map(f => ({
      ...f,
      key: `${f.forwarder_id}::${f.tier}`,
      finalPrice: Math.round(baseShippingCost * Number(f.price_multiplier || 1) * 100) / 100,
    }));
  }, [list, baseShippingCost]);

  // Auto-select first option when list/refresh
  useEffect(() => {
    if (!config?.enabled) {
      onChange(null, false);
      return;
    }
    if (options.length === 0) {
      setSelectedKey(null);
      // No eligible forwarder → silent fallback (auto_calc) or unassigned flag
      const unassigned = config.fallback_mode === "auto_calc";
      onChange(null, unassigned);
      return;
    }
    const current = selectedKey && options.find(o => o.key === selectedKey);
    const chosen = current || options[0];
    setSelectedKey(chosen.key);
    onChange(
      {
        forwarder_id: chosen.forwarder_id,
        forwarder_name: chosen.forwarder_name,
        tier: chosen.tier,
        price_multiplier: Number(chosen.price_multiplier),
        quoted_price: chosen.finalPrice,
        transit_min_days: chosen.transit_min_days,
        transit_max_days: chosen.transit_max_days,
      },
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, config?.enabled, config?.fallback_mode]);

  if (!config?.enabled) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin text-primary" />
        Recherche des transitaires disponibles...
      </div>
    );
  }

  if (options.length === 0) {
    if (config.fallback_mode === "block" && config.require_selection) {
      return (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-md border border-destructive/40 bg-destructive/5 text-[11px] text-destructive">
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            Aucun transitaire ne dessert cette destination pour le mode sélectionné. Choisissez une autre ville ou un autre mode.
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2 px-2.5 py-2 rounded-md border border-border bg-muted/40 text-[11px] text-muted-foreground">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>Aucun transitaire dédié disponible. Tarif standard appliqué — un transitaire sera assigné après commande.</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
        <Truck size={11} className="text-primary" />
        Choisissez votre transitaire
      </div>
      <div className="grid gap-1.5">
        {options.map(opt => {
          const isSelected = selectedKey === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setSelectedKey(opt.key);
                onChange(
                  {
                    forwarder_id: opt.forwarder_id,
                    forwarder_name: opt.forwarder_name,
                    tier: opt.tier,
                    price_multiplier: Number(opt.price_multiplier),
                    quoted_price: opt.finalPrice,
                    transit_min_days: opt.transit_min_days,
                    transit_max_days: opt.transit_max_days,
                  },
                  false,
                );
              }}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              {opt.logo_url ? (
                <img
                  src={opt.logo_url}
                  alt={opt.forwarder_name}
                  className="h-7 w-7 rounded object-cover bg-muted shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="h-7 w-7 rounded bg-muted flex items-center justify-center shrink-0">
                  <Truck size={12} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground truncate">{opt.forwarder_name}</span>
                  <span className="text-[9px] px-1.5 py-0 rounded-full border border-primary/30 bg-primary/10 text-primary uppercase tracking-wide">
                    {TIER_LABELS[opt.tier] || opt.tier}
                  </span>
                  {isSelected && <BadgeCheck size={11} className="text-primary" />}
                </div>
                {(opt.transit_min_days || opt.transit_max_days) && (
                  <p className="text-[10px] text-muted-foreground">
                    Délai estimé : {opt.transit_min_days ?? "?"}–{opt.transit_max_days ?? "?"} jours
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-foreground">${opt.finalPrice.toFixed(2)}</p>
                {Number(opt.price_multiplier) !== 1 && (
                  <p className="text-[9px] text-muted-foreground">×{Number(opt.price_multiplier).toFixed(2)}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}