/**
 * ForwarderCoveragePage — coverage_routes with geo country/city (legacy string fallback).
 */
import { useState, useEffect } from "react";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { fromTable } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Map } from "lucide-react";
import { GeoFieldsRow, type GeoFieldsValue } from "@/components/address/GeoFieldsRow";
import { getCountryName } from "@/components/vendor/CountryCombobox";

type Route = {
  origin?: string;
  destination?: string;
  mode?: string;
  origin_country?: string;
  origin_city?: string;
  dest_country?: string;
  dest_city?: string;
};

function routeToGeo(r: Route, side: "origin" | "dest"): GeoFieldsValue {
  if (side === "origin") {
    return {
      country: r.origin_country || "",
      city: r.origin_city || "",
    };
  }
  return {
    country: r.dest_country || "",
    city: r.dest_city || "",
  };
}

function labelFromGeo(country?: string, city?: string, legacy?: string): string {
  if (country) {
    const parts = [city, getCountryName(country) || country].filter(Boolean);
    return parts.join(", ");
  }
  return legacy || "";
}

export default function ForwarderCoveragePage() {
  const { forwarder, refetch } = useForwarderContext();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = Array.isArray(forwarder?.coverage_routes) ? forwarder!.coverage_routes : [];
    setRoutes(
      raw.map((r: Route) => ({
        ...r,
        // hydrate structured fields from legacy free-text when missing
        origin_country: r.origin_country || "",
        origin_city: r.origin_city || "",
        dest_country: r.dest_country || "",
        dest_city: r.dest_city || "",
      })),
    );
  }, [forwarder]);

  if (!forwarder) return null;

  const update = (i: number, patch: Partial<Route>) =>
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
        dest_country: "",
        dest_city: "",
      },
    ]);
  const remove = (i: number) => setRoutes(routes.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    const normalized = routes.map((r) => {
      const origin = labelFromGeo(r.origin_country, r.origin_city, r.origin);
      const destination = labelFromGeo(r.dest_country, r.dest_city, r.destination);
      return {
        mode: r.mode || "air",
        origin_country: r.origin_country?.toUpperCase() || null,
        origin_city: r.origin_city || null,
        dest_country: r.dest_country?.toUpperCase() || null,
        dest_city: r.dest_city || null,
        origin,
        destination,
      };
    });
    const { error } = await fromTable("forwarders")
      .update({ coverage_routes: normalized })
      .eq("id", forwarder.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Routes enregistrées");
      refetch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Couverture & routes</h1>
          <p className="text-sm text-muted-foreground">Origine → destination (pays / ville) et mode opéré.</p>
        </div>
        <Button onClick={save} disabled={saving} style={{ background: "var(--forwarder-gradient)" }} className="text-white">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Enregistrer
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          {routes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune route. Ajoutez vos couples origine → destination.
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
                      dest_country: patch.country !== undefined ? patch.country : r.dest_country,
                      dest_city: patch.city !== undefined ? patch.city : r.dest_city,
                    })
                  }
                  levels={["country", "city"]}
                  required={["country"]}
                  labels={{ country: "Pays destination", city: "Ville destination" }}
                />
                {!r.dest_country && r.destination && (
                  <p className="text-[10px] text-muted-foreground mt-1">Legacy: {r.destination}</p>
                )}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add} className="mt-2">
            <Plus size={14} /> Ajouter une route
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-md text-xs text-muted-foreground">
        <Map size={14} className="mt-0.5 shrink-0 text-[hsl(var(--forwarder-primary))]" />
        Les restrictions douanières (catégories interdites par pays) sont gérées dans les profils tarifs (onglet Restrictions).
      </div>
    </div>
  );
}
