/**
 * CoverageRoutesEditor — single source of truth: forwarders.coverage_routes JSONB.
 * Canonical keys for checkout: origin_country, destination_country (+ optional cities, mode).
 * Legacy dest_country / dest_city are read as aliases and rewritten on save.
 */
import { useEffect, useState } from "react";
import { fromTable } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Map } from "lucide-react";
import { GeoFieldsRow, type GeoFieldsValue } from "@/components/address/GeoFieldsRow";
import { getCountryName } from "@/components/vendor/CountryCombobox";

export type CoverageRoute = {
  origin?: string;
  destination?: string;
  mode?: string;
  origin_country?: string;
  origin_city?: string;
  /** Canonical checkout key */
  destination_country?: string;
  destination_city?: string;
  /** Legacy aliases (read-only hydrate) */
  dest_country?: string;
  dest_city?: string;
};

function destCountryOf(r: CoverageRoute): string {
  return (r.destination_country || r.dest_country || "").trim();
}

function destCityOf(r: CoverageRoute): string {
  return (r.destination_city || r.dest_city || "").trim();
}

function routeToGeo(r: CoverageRoute, side: "origin" | "dest"): GeoFieldsValue {
  if (side === "origin") {
    return { country: r.origin_country || "", city: r.origin_city || "" };
  }
  return { country: destCountryOf(r), city: destCityOf(r) };
}

function labelFromGeo(country?: string, city?: string, legacy?: string): string {
  if (country) {
    const parts = [city, getCountryName(country) || country].filter(Boolean);
    return parts.join(", ");
  }
  return legacy || "";
}

type Props = {
  forwarderId: string;
  initialRoutes: CoverageRoute[] | null | undefined;
  onSaved?: () => void;
  compact?: boolean;
};

export function CoverageRoutesEditor({ forwarderId, initialRoutes, onSaved, compact }: Props) {
  const [routes, setRoutes] = useState<CoverageRoute[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = Array.isArray(initialRoutes) ? initialRoutes : [];
    setRoutes(
      raw.map((r) => ({
        ...r,
        origin_country: r.origin_country || "",
        origin_city: r.origin_city || "",
        destination_country: destCountryOf(r),
        destination_city: destCityOf(r),
      })),
    );
  }, [initialRoutes]);

  const update = (i: number, patch: Partial<CoverageRoute>) =>
    setRoutes(routes.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const add = () =>
    setRoutes([
      ...routes,
      {
        origin: "",
        destination: "",
        mode: "air",
        origin_country: "",
        origin_city: "",
        destination_country: "",
        destination_city: "",
      },
    ]);

  const remove = (i: number) => setRoutes(routes.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    const normalized = routes.map((r) => {
      const oc = (r.origin_country || "").trim().toUpperCase() || null;
      const dc = destCountryOf(r).toUpperCase() || null;
      const oCity = r.origin_city || null;
      const dCity = destCityOf(r) || null;
      const origin = labelFromGeo(oc || undefined, oCity || undefined, r.origin);
      const destination = labelFromGeo(dc || undefined, dCity || undefined, r.destination);
      // Canonical keys only (checkout RPC + freightQuoteCheckout)
      return {
        mode: r.mode || "air",
        origin_country: oc,
        origin_city: oCity,
        destination_country: dc,
        destination_city: dCity,
        origin,
        destination,
      };
    });
    const { error } = await fromTable("forwarders")
      .update({ coverage_routes: normalized })
      .eq("id", forwarderId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Routes enregistrées");
      onSaved?.();
    }
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Enregistrer
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {routes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune route. Ajoutez des couples origine → destination (utilisés au checkout).
          </p>
        )}
        {routes.map((r, i) => (
          <div key={i} className="border border-border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Mode</Label>
              <div className="flex items-center gap-2">
                <select
                  value={r.mode ?? "air"}
                  onChange={(e) => update(i, { mode: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {["air", "sea", "road", "rail"].map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
                <Button size="icon" variant="ghost" onClick={() => remove(i)}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Origine</Label>
              <GeoFieldsRow
                value={routeToGeo(r, "origin")}
                onChange={(patch) =>
                  update(i, {
                    origin_country: patch.country !== undefined ? patch.country : r.origin_country,
                    origin_city: patch.city !== undefined ? patch.city : r.origin_city,
                  })
                }
                levels={["country", "city"]}
                required={["country"]}
                labels={{ country: "Pays origine", city: "Ville origine" }}
              />
              {!r.origin_country && r.origin && (
                <p className="text-[10px] text-muted-foreground mt-1">Legacy: {r.origin}</p>
              )}
            </div>
            <div>
              <Label className="text-xs mb-1 block">Destination</Label>
              <GeoFieldsRow
                value={routeToGeo(r, "dest")}
                onChange={(patch) =>
                  update(i, {
                    destination_country:
                      patch.country !== undefined ? patch.country : destCountryOf(r),
                    destination_city: patch.city !== undefined ? patch.city : destCityOf(r),
                    dest_country: undefined,
                    dest_city: undefined,
                  })
                }
                levels={["country", "city"]}
                required={["country"]}
                labels={{ country: "Pays destination", city: "Ville destination" }}
              />
              {!destCountryOf(r) && r.destination && (
                <p className="text-[10px] text-muted-foreground mt-1">Legacy: {r.destination}</p>
              )}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add} className="mt-2">
          <Plus size={14} /> Ajouter une route
        </Button>
      </div>

      {compact && (
        <Button onClick={save} disabled={saving} className="w-full gap-1.5">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Enregistrer
        </Button>
      )}

      <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-md text-xs text-muted-foreground">
        <Map size={14} className="mt-0.5 shrink-0 text-primary" />
        Source unique : <code className="text-[10px]">forwarders.coverage_routes</code> (clés{" "}
        <code className="text-[10px]">destination_country</code> pour le checkout).
      </div>
    </div>
  );
}
