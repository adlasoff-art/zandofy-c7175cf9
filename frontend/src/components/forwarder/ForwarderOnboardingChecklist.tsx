/**
 * ForwarderOnboardingChecklist — Affinage UX /forwarder/* (Phase B2.2)
 *
 * Étapes : KYB approuvé · ≥1 profil tarifaire · ≥1 tier (KG/CBM/pièce) · ≥1 route.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fromTable } from "@/lib/supabase-helpers";
import type { ForwarderRow } from "@/hooks/use-forwarder-context";

type Step = {
  key: string;
  label: string;
  done: boolean;
  to: string;
  cta: string;
  hint?: string;
};

export function ForwarderOnboardingChecklist({ forwarder }: { forwarder: ForwarderRow }) {
  const { data: profilesCount = 0 } = useQuery({
    queryKey: ["forwarder-onb-profiles", forwarder.id],
    enabled: !!forwarder.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await fromTable("forwarder_pricing_profiles")
        .select("id", { count: "exact", head: true })
        .eq("forwarder_id", forwarder.id)
        .eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: tiersCount = 0 } = useQuery({
    queryKey: ["forwarder-onb-tiers", forwarder.id],
    enabled: !!forwarder.id,
    staleTime: 60_000,
    queryFn: async () => {
      const profileIds = await fromTable("forwarder_pricing_profiles")
        .select("id")
        .eq("forwarder_id", forwarder.id);
      const ids = (profileIds.data ?? []).map((p: any) => p.id);
      if (ids.length === 0) return 0;
      const [kg, cbm, piece] = await Promise.all([
        fromTable("forwarder_kg_tiers").select("id", { count: "exact", head: true }).in("profile_id", ids),
        fromTable("forwarder_cbm_tiers").select("id", { count: "exact", head: true }).in("profile_id", ids),
        fromTable("forwarder_piece_tiers").select("id", { count: "exact", head: true }).in("profile_id", ids),
      ]);
      return (kg.count ?? 0) + (cbm.count ?? 0) + (piece.count ?? 0);
    },
  });

  const routesCount = Array.isArray(forwarder.coverage_routes) ? forwarder.coverage_routes.length : 0;

  const steps: Step[] = [
    {
      key: "kyb",
      label: "KYB approuvé",
      done: forwarder.status === "approved",
      to: "/forwarder/settings",
      cta: "Voir le statut",
    },
    {
      key: "profiles",
      label: "Créer au moins 1 profil tarifaire",
      done: profilesCount >= 1,
      to: "/forwarder/profiles",
      cta: "Créer un profil",
      hint: `${profilesCount} actif${profilesCount > 1 ? "s" : ""}`,
    },
    {
      key: "tiers",
      label: "Définir au moins 1 tier (KG, CBM ou à la pièce)",
      done: tiersCount >= 1,
      to: "/forwarder/profiles",
      cta: "Ajouter un tier",
      hint: `${tiersCount} tier${tiersCount > 1 ? "s" : ""}`,
    },
    {
      key: "coverage",
      label: "Déclarer au moins 1 route de couverture",
      done: routesCount >= 1,
      to: "/forwarder/coverage",
      cta: "Ajouter une route",
      hint: `${routesCount}`,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (allDone) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[hsl(var(--forwarder-success))]/10 text-[hsl(var(--forwarder-success))] text-xs font-medium border border-[hsl(var(--forwarder-success))]/20">
        <Sparkles size={14} />
        Espace transitaire configuré — vos tarifs sont disponibles pour les vendeurs.
      </div>
    );
  }

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <Card className="border-[hsl(var(--forwarder-primary))]/30">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Mise en route ({doneCount}/{steps.length})</p>
            <p className="text-xs text-muted-foreground">
              Complétez ces étapes pour que vos tarifs apparaissent dans les devis vendeurs.
            </p>
          </div>
          <div className="text-xs font-bold text-[hsl(var(--forwarder-primary))]">{pct}%</div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "var(--forwarder-gradient)" }}
          />
        </div>
        <ul className="space-y-1.5">
          {steps.map((s) => (
            <li
              key={s.key}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm ${
                s.done ? "text-muted-foreground" : "bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {s.done ? (
                  <CheckCircle2 size={14} className="text-[hsl(var(--forwarder-success))] shrink-0" />
                ) : (
                  <Circle size={14} className="text-muted-foreground shrink-0" />
                )}
                <span className={`truncate ${s.done ? "line-through" : ""}`}>{s.label}</span>
                {s.hint && (
                  <span className="text-[10px] text-muted-foreground shrink-0">· {s.hint}</span>
                )}
              </div>
              {!s.done && (
                <Link
                  to={s.to}
                  className="text-xs font-medium text-[hsl(var(--forwarder-primary))] hover:underline flex items-center gap-1 shrink-0"
                >
                  {s.cta} <ArrowRight size={11} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}