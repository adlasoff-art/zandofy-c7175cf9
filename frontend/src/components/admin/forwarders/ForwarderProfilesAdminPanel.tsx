import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plane, Ship, Truck, TrainFront, ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

interface ProfileRow {
  id: string;
  forwarder_id: string;
  mode: string;
  service_class: string;
  country_code: string;
  city_id: string | null;
  currency: string;
  deposit_pct: number;
  transit_min_days: number | null;
  transit_max_days: number | null;
  is_active: boolean;
  forwarder_name?: string;
  city_name?: string | null;
  cbm_tier_count?: number;
  piece_tier_count?: number;
}

const MODE_ICON: Record<string, JSX.Element> = {
  air: <Plane size={12} />,
  sea: <Ship size={12} />,
  road: <Truck size={12} />,
  rail: <TrainFront size={12} />,
};

/**
 * Read-only consolidated view of the new freight pricing system.
 * Source of truth: forwarder_pricing_profiles + tiers.
 * For editing, redirect to /admin/forwarders.
 */
export function ForwarderProfilesAdminPanel() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: profiles, error } = await (supabase as any)
        .from("forwarder_pricing_profiles")
        .select(
          "id, forwarder_id, mode, service_class, country_code, city_id, currency, deposit_pct, transit_min_days, transit_max_days, is_active",
        )
        .order("country_code", { ascending: true });

      if (error || !profiles) {
        if (!cancelled) setLoading(false);
        return;
      }

      const forwarderIds = [...new Set(profiles.map((p: any) => p.forwarder_id))];
      const cityIds = [...new Set(profiles.map((p: any) => p.city_id).filter(Boolean))];
      const profileIds = profiles.map((p: any) => p.id);

      const [forwardersRes, citiesRes, cbmRes, pieceRes] = await Promise.all([
        (supabase as any).from("forwarders").select("id, name").in("id", forwarderIds),
        cityIds.length > 0
          ? (supabase as any).from("cities").select("id, name").in("id", cityIds)
          : Promise.resolve({ data: [] }),
        (supabase as any).from("forwarder_cbm_tiers").select("profile_id").in("profile_id", profileIds),
        (supabase as any).from("forwarder_piece_tiers").select("profile_id").in("profile_id", profileIds),
      ]);

      const fwMap = new Map((forwardersRes.data ?? []).map((f: any) => [f.id, f.name]));
      const cityMap = new Map((citiesRes.data ?? []).map((c: any) => [c.id, c.name]));
      const cbmCount = new Map<string, number>();
      const pieceCount = new Map<string, number>();
      (cbmRes.data ?? []).forEach((t: any) => cbmCount.set(t.profile_id, (cbmCount.get(t.profile_id) ?? 0) + 1));
      (pieceRes.data ?? []).forEach((t: any) => pieceCount.set(t.profile_id, (pieceCount.get(t.profile_id) ?? 0) + 1));

      const enriched = profiles.map((p: any) => ({
        ...p,
        forwarder_name: fwMap.get(p.forwarder_id) ?? "—",
        city_name: p.city_id ? cityMap.get(p.city_id) ?? null : null,
        cbm_tier_count: cbmCount.get(p.id) ?? 0,
        piece_tier_count: pieceCount.get(p.id) ?? 0,
      }));

      if (!cancelled) {
        setRows(enriched);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.forwarder_name?.toLowerCase().includes(q) ||
      r.country_code.toLowerCase().includes(q) ||
      r.city_name?.toLowerCase().includes(q) ||
      r.mode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="font-semibold text-foreground">Système unifié de tarification fret (nouveau)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Cette vue consolide tous les profils tarifaires (CBM + pièce) gérés depuis{" "}
          <Link to="/admin/forwarders" className="text-primary underline">
            Admin → Transitaires
          </Link>
          . Pour ajouter ou modifier un profil, ses paliers ou ses couvertures, utilisez l'écran dédié.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Rechercher par transitaire, pays, ville, mode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md h-9"
        />
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/forwarders">
            <ExternalLink size={14} className="mr-1" /> Gérer les transitaires
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun profil tarifaire enregistré.{" "}
          <Link to="/admin/forwarders" className="text-primary underline">
            Créer un profil
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Transitaire</th>
                <th className="px-3 py-2 text-left">Mode</th>
                <th className="px-3 py-2 text-left">Service</th>
                <th className="px-3 py-2 text-left">Couverture</th>
                <th className="px-3 py-2 text-left">Devise</th>
                <th className="px-3 py-2 text-left">Acompte</th>
                <th className="px-3 py-2 text-left">Transit</th>
                <th className="px-3 py-2 text-left">Paliers</th>
                <th className="px-3 py-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.forwarder_name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="gap-1">
                      {MODE_ICON[r.mode] ?? null}
                      {r.mode}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.service_class}</td>
                  <td className="px-3 py-2">
                    {r.country_code}
                    {r.city_name ? <span className="text-muted-foreground"> · {r.city_name}</span> : null}
                  </td>
                  <td className="px-3 py-2">{r.currency}</td>
                  <td className="px-3 py-2">{r.deposit_pct ? `${r.deposit_pct}%` : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.transit_min_days && r.transit_max_days
                      ? `${r.transit_min_days}–${r.transit_max_days} j`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    CBM: {r.cbm_tier_count} · Pièce: {r.piece_tier_count}
                  </td>
                  <td className="px-3 py-2">
                    {r.is_active ? (
                      <Badge variant="default">Actif</Badge>
                    ) : (
                      <Badge variant="secondary">Inactif</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}