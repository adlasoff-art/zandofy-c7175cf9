import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Loader2, Plane, Ship, Truck, TrainFront, Building2, Mail, Phone, ExternalLink, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * CarrierDashboardPage — read-only view for users linked to a forwarder
 * (either via forwarders.linked_transporter_user_id or
 * forwarder_pricing_profiles.linked_transporter_user_id override).
 *
 * No mutations. Editing of profiles/tiers is reserved to admins.
 */

const MODE_ICON: Record<string, JSX.Element> = {
  air: <Plane size={12} />,
  sea: <Ship size={12} />,
  road: <Truck size={12} />,
  rail: <TrainFront size={12} />,
};

interface ForwarderRow {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

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
  city_name?: string | null;
  cbm_tier_count?: number;
  piece_tier_count?: number;
  override_for_me?: boolean;
}

export default function CarrierDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [forwarders, setForwarders] = useState<ForwarderRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 1. Forwarders directly linked to me
      const { data: linkedForwarders } = await (supabase as any)
        .from("forwarders")
        .select("id, name, slug, logo_url, description, contact_email, contact_phone, is_active")
        .eq("linked_transporter_user_id", user.id);

      // 2. Profiles overridden to me
      const { data: overrideProfiles } = await (supabase as any)
        .from("forwarder_pricing_profiles")
        .select(
          "id, forwarder_id, mode, service_class, country_code, city_id, currency, deposit_pct, transit_min_days, transit_max_days, is_active",
        )
        .eq("linked_transporter_user_id", user.id);

      const forwarderIdsFromOverrides = (overrideProfiles ?? []).map((p: any) => p.forwarder_id);
      const forwarderIds = new Set<string>([
        ...(linkedForwarders ?? []).map((f: any) => f.id),
        ...forwarderIdsFromOverrides,
      ]);

      if (forwarderIds.size === 0) {
        if (!cancelled) {
          setForwarders([]);
          setProfiles([]);
          setLoading(false);
        }
        return;
      }

      // 3. Fetch missing forwarders (those reached only via overrides)
      const linkedIds = new Set((linkedForwarders ?? []).map((f: any) => f.id));
      const missingIds = [...forwarderIds].filter((id) => !linkedIds.has(id));
      let allForwarders = (linkedForwarders ?? []) as ForwarderRow[];
      if (missingIds.length > 0) {
        const { data: extra } = await (supabase as any)
          .from("forwarders")
          .select("id, name, slug, logo_url, description, contact_email, contact_phone, is_active")
          .in("id", missingIds);
        allForwarders = [...allForwarders, ...((extra ?? []) as ForwarderRow[])];
      }

      // 4. Fetch ALL profiles for those forwarders (visibility on inherited ones too)
      const { data: allProfiles } = await (supabase as any)
        .from("forwarder_pricing_profiles")
        .select(
          "id, forwarder_id, mode, service_class, country_code, city_id, currency, deposit_pct, transit_min_days, transit_max_days, is_active, linked_transporter_user_id",
        )
        .in("forwarder_id", [...forwarderIds]);

      const profilesArr = (allProfiles ?? []) as Array<ProfileRow & { linked_transporter_user_id: string | null }>;
      const profileIds = profilesArr.map((p) => p.id);
      const cityIds = [...new Set(profilesArr.map((p) => p.city_id).filter(Boolean))] as string[];

      const [citiesRes, cbmRes, pieceRes] = await Promise.all([
        cityIds.length
          ? (supabase as any).from("cities").select("id, name").in("id", cityIds)
          : Promise.resolve({ data: [] }),
        profileIds.length
          ? (supabase as any).from("forwarder_cbm_tiers").select("profile_id").in("profile_id", profileIds)
          : Promise.resolve({ data: [] }),
        profileIds.length
          ? (supabase as any).from("forwarder_piece_tiers").select("profile_id").in("profile_id", profileIds)
          : Promise.resolve({ data: [] }),
      ]);

      const cityMap = new Map((citiesRes.data ?? []).map((c: any) => [c.id, c.name]));
      const cbmCount = new Map<string, number>();
      const pieceCount = new Map<string, number>();
      (cbmRes.data ?? []).forEach((t: any) => cbmCount.set(t.profile_id, (cbmCount.get(t.profile_id) ?? 0) + 1));
      (pieceRes.data ?? []).forEach((t: any) => pieceCount.set(t.profile_id, (pieceCount.get(t.profile_id) ?? 0) + 1));

      const enriched: ProfileRow[] = profilesArr.map((p) => ({
        id: p.id,
        forwarder_id: p.forwarder_id,
        mode: p.mode,
        service_class: p.service_class,
        country_code: p.country_code,
        city_id: p.city_id,
        currency: p.currency,
        deposit_pct: p.deposit_pct,
        transit_min_days: p.transit_min_days,
        transit_max_days: p.transit_max_days,
        is_active: p.is_active,
        city_name: p.city_id ? (cityMap.get(p.city_id) as string | undefined) ?? null : null,
        cbm_tier_count: cbmCount.get(p.id) ?? 0,
        piece_tier_count: pieceCount.get(p.id) ?? 0,
        override_for_me: p.linked_transporter_user_id === user.id,
      }));

      if (!cancelled) {
        setForwarders(allForwarders);
        setProfiles(enriched);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck size={24} className="text-primary" /> Espace Transporteur
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Consultez les profils tarifaires liés à votre compte.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">
              <ExternalLink size={14} className="mr-1" /> Mon tableau de bord
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
          <Info size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Cette interface est en <strong>lecture seule</strong>. Pour toute modification de profil, palier ou tarif,
            contactez votre administrateur Zandofy.
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : forwarders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Building2 size={40} className="text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold text-foreground">Aucun profil transporteur lié</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Votre compte n'est rattaché à aucun transitaire. Contactez l'administration pour être lié à un compte transporteur.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {forwarders.map((fw) => {
              const fwProfiles = profiles.filter((p) => p.forwarder_id === fw.id);
              return (
                <section key={fw.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <header className="flex items-start gap-4 p-4 border-b border-border bg-muted/20">
                    {fw.logo_url ? (
                      <img
                        src={fw.logo_url}
                        alt={fw.name}
                        className="w-14 h-14 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                        <Building2 size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-foreground">{fw.name}</h2>
                        {fw.is_active ? (
                          <Badge variant="default">Actif</Badge>
                        ) : (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                      </div>
                      {fw.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{fw.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {fw.contact_email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} /> {fw.contact_email}
                          </span>
                        )}
                        {fw.contact_phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={12} /> {fw.contact_phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </header>

                  {fwProfiles.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Aucun profil tarifaire enregistré pour ce transitaire.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                          <tr>
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
                          {fwProfiles.map((p) => (
                            <tr key={p.id} className="border-t border-border hover:bg-muted/10">
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="gap-1">
                                  {MODE_ICON[p.mode] ?? null}
                                  {p.mode}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{p.service_class}</td>
                              <td className="px-3 py-2">
                                {p.country_code}
                                {p.city_name ? <span className="text-muted-foreground"> · {p.city_name}</span> : null}
                                {p.override_for_me && (
                                  <Badge variant="secondary" className="ml-2 text-[10px]">
                                    override
                                  </Badge>
                                )}
                              </td>
                              <td className="px-3 py-2">{p.currency}</td>
                              <td className="px-3 py-2">{p.deposit_pct ? `${p.deposit_pct}%` : "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {p.transit_min_days && p.transit_max_days
                                  ? `${p.transit_min_days}–${p.transit_max_days} j`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                CBM: {p.cbm_tier_count} · Pièce: {p.piece_tier_count}
                              </td>
                              <td className="px-3 py-2">
                                {p.is_active ? (
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
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}