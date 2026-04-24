import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, Copy, Loader2, Package, Plane, Ship, Truck, Train, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import {
  composeFreightQuote,
  type CbmTier,
  type FreightItem,
  type FreightProfile,
  type FreightQuoteResult,
  type PieceTier,
} from "@/services/freightQuote";

const MODE_ICON: Record<string, any> = { air: Plane, sea: Ship, road: Truck, rail: Train };
const MODE_LABEL: Record<string, string> = { air: "Aérien", sea: "Maritime", road: "Routier", rail: "Ferroviaire" };

interface QuoteOffer {
  profile: FreightProfile;
  forwarder: { id: string; name: string };
  result: FreightQuoteResult;
}

export function VendorFreightSimulator() {
  const [destCountry, setDestCountry] = useState("CD");
  const [mode, setMode] = useState<string>("air");
  const [qty, setQty] = useState(1);
  const [weightKg, setWeightKg] = useState(1);
  const [lengthCm, setLengthCm] = useState(0);
  const [widthCm, setWidthCm] = useState(0);
  const [heightCm, setHeightCm] = useState(0);

  // Active profiles via public view (no RLS escalation)
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["vendor-sim-profiles", destCountry, mode],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_forwarder_profiles_public")
        .select("*")
        .eq("is_active", true)
        .eq("country_code", destCountry)
        .eq("mode", mode);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Forwarder names
  const forwarderIds = profiles.map((p: any) => p.forwarder_id);
  const { data: forwarders = [] } = useQuery({
    queryKey: ["vendor-sim-forwarders", forwarderIds.sort().join(",")],
    queryFn: async () => {
      if (forwarderIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("forwarders")
        .select("id, name, logo_url")
        .in("id", forwarderIds);
      return data ?? [];
    },
    enabled: forwarderIds.length > 0,
  });

  // Tiers
  const profileIds = profiles.map((p: any) => p.id);
  const { data: cbmTiers = [] } = useQuery({
    queryKey: ["vendor-sim-cbm", profileIds.sort().join(",")],
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("forwarder_cbm_tiers")
        .select("*")
        .in("profile_id", profileIds);
      return (data ?? []) as CbmTier[];
    },
    enabled: profileIds.length > 0,
  });

  const { data: pieceTiers = [] } = useQuery({
    queryKey: ["vendor-sim-piece", profileIds.sort().join(",")],
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("forwarder_piece_tiers")
        .select("*")
        .in("profile_id", profileIds);
      return (data ?? []) as PieceTier[];
    },
    enabled: profileIds.length > 0,
  });

  const cbmPerUnit = useMemo(() => {
    if (lengthCm > 0 && widthCm > 0 && heightCm > 0) {
      return (lengthCm * widthCm * heightCm) / 1_000_000;
    }
    return 0;
  }, [lengthCm, widthCm, heightCm]);

  const totalCbm = cbmPerUnit * qty;
  const totalKg = weightKg * qty;

  const offers: QuoteOffer[] = useMemo(() => {
    return profiles
      .map((p: any) => {
        const profile = p as FreightProfile;
        const cbmT = cbmTiers.filter((t) => t.profile_id === profile.id);
        const pieceT = pieceTiers.filter((t) => t.profile_id === profile.id);
        const items: FreightItem[] = [{ quantity: qty, cbm: cbmPerUnit, weight_kg: weightKg }];
        const result = composeFreightQuote(profile, cbmT, pieceT, items, {
          totalCbm,
          totalWeightKg: totalKg,
        });
        const forwarder = forwarders.find((f: any) => f.id === profile.forwarder_id) || {
          id: profile.forwarder_id,
          name: "Transitaire",
        };
        return { profile, forwarder: { id: forwarder.id, name: forwarder.name }, result };
      })
      .filter((o: QuoteOffer) => o.result.lines.length > 0)
      .sort((a: QuoteOffer, b: QuoteOffer) => a.result.total - b.result.total);
  }, [profiles, cbmTiers, pieceTiers, forwarders, qty, weightKg, cbmPerUnit, totalCbm, totalKg]);

  const copyQuote = async (offer: QuoteOffer) => {
    const lines: string[] = [];
    lines.push(`📦 Devis fret — ${offer.forwarder.name}`);
    lines.push(`Mode: ${MODE_LABEL[mode] || mode} · Destination: ${destCountry}`);
    lines.push(`Quantité: ${qty} · Volume: ${totalCbm.toFixed(3)} CBM · Poids: ${totalKg.toFixed(2)} kg`);
    lines.push("");
    offer.result.lines.forEach((l) => {
      lines.push(`• ${l.label}${l.line_total ? ` → ${l.line_total} ${offer.result.currency}` : " (sur devis)"}`);
    });
    lines.push("");
    lines.push(`💰 Total: ${offer.result.total} ${offer.result.currency}`);
    if (offer.result.deposit_required) {
      lines.push(`🔒 Acompte requis: ${offer.result.deposit_amount} ${offer.result.currency} (${offer.result.deposit_pct}%)`);
    }
    if (offer.result.transit_min_days || offer.result.transit_max_days) {
      lines.push(`🚚 Délai estimé: ${offer.result.transit_min_days ?? "?"}–${offer.result.transit_max_days ?? "?"} jours`);
    }
    lines.push("");
    lines.push("⚠️ Devis indicatif. Confirmation finale à la commande.");

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Devis copié — prêt à coller dans WhatsApp");
    } catch {
      toast.error("Impossible de copier le devis");
    }
  };

  const Icon = MODE_ICON[mode] || Package;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Simulateur de devis fret</h2>
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info size={12} className="text-muted-foreground mt-0.5 shrink-0" />
          Outil de calcul basé sur les tarifs configurés par l'administration. Les prix affichés sont indicatifs — utilisez-les pour orienter vos clients. La facturation finale se fait au checkout.
        </p>

        {/* Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Destination (pays)</label>
            <select
              value={destCountry}
              onChange={(e) => setDestCountry(e.target.value.toUpperCase())}
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
            >
              <option value="CD">CD — RD Congo</option>
              <option value="CG">CG — Congo Brazza</option>
              <option value="AO">AO — Angola</option>
              <option value="ZA">ZA — Afrique du Sud</option>
              <option value="NG">NG — Nigéria</option>
              <option value="KE">KE — Kenya</option>
              <option value="CI">CI — Côte d'Ivoire</option>
              <option value="SN">SN — Sénégal</option>
              <option value="CM">CM — Cameroun</option>
              <option value="FR">FR — France</option>
              <option value="BE">BE — Belgique</option>
              <option value="US">US — États-Unis</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
            >
              <option value="air">✈️ Aérien</option>
              <option value="sea">🚢 Maritime</option>
              <option value="road">🚛 Routier</option>
              <option value="rail">🚂 Ferroviaire</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Quantité</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Poids unitaire (kg)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={weightKg}
              onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
            />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <label className="text-[11px] text-muted-foreground block mb-1">Dimensions par unité (L × l × H, cm)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                value={lengthCm || ""}
                onChange={(e) => setLengthCm(parseFloat(e.target.value) || 0)}
                placeholder="L"
                className="px-2 py-1.5 text-sm bg-background border border-border rounded-md"
              />
              <input
                type="number"
                min={0}
                value={widthCm || ""}
                onChange={(e) => setWidthCm(parseFloat(e.target.value) || 0)}
                placeholder="l"
                className="px-2 py-1.5 text-sm bg-background border border-border rounded-md"
              />
              <input
                type="number"
                min={0}
                value={heightCm || ""}
                onChange={(e) => setHeightCm(parseFloat(e.target.value) || 0)}
                placeholder="H"
                className="px-2 py-1.5 text-sm bg-background border border-border rounded-md"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              CBM/unité: {cbmPerUnit.toFixed(4)} · Total CBM: {totalCbm.toFixed(4)} · Total kg: {totalKg.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Icon size={14} className="text-primary" />
          Offres disponibles ({offers.length})
        </h3>

        {loadingProfiles ? (
          <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-primary" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Package size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-foreground font-medium">Aucun transitaire disponible</p>
            <p className="text-xs text-muted-foreground mt-1">
              Aucun profil tarifaire actif pour {destCountry} en mode {MODE_LABEL[mode] || mode}.
            </p>
          </div>
        ) : offers.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-sm text-foreground font-medium">Renseignez les dimensions ou le poids</p>
            <p className="text-xs text-muted-foreground mt-1">
              Indiquez au moins un volume (L×l×H) ou un poids pour générer un devis.
            </p>
          </div>
        ) : (
          offers.map((offer) => (
            <div key={offer.profile.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{offer.forwarder.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {offer.profile.service_class}
                    </span>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {offer.result.lines.map((l, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground">
                        <ChevronRight size={10} className="inline -mt-0.5" /> {l.label}
                        {l.line_total > 0 && (
                          <span className="text-foreground font-medium"> · {l.line_total} {offer.result.currency}</span>
                        )}
                      </p>
                    ))}
                  </div>
                  {offer.result.warnings.length > 0 && (
                    <p className="text-[10px] text-destructive mt-1">⚠️ {offer.result.warnings.join(" · ")}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-foreground">
                    {offer.result.total} <span className="text-xs text-muted-foreground">{offer.result.currency}</span>
                  </p>
                  {offer.result.deposit_required && (
                    <p className="text-[10px] text-muted-foreground">
                      Acompte: {offer.result.deposit_amount} {offer.result.currency}
                    </p>
                  )}
                  {(offer.result.transit_min_days || offer.result.transit_max_days) && (
                    <p className="text-[10px] text-muted-foreground">
                      {offer.result.transit_min_days ?? "?"}–{offer.result.transit_max_days ?? "?"} jours
                    </p>
                  )}
                  <button
                    onClick={() => copyQuote(offer)}
                    className="mt-2 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-foreground text-background rounded-md hover:opacity-90"
                  >
                    <Copy size={11} /> Copier
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}