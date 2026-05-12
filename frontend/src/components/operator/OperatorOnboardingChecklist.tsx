/**
 * OperatorOnboardingChecklist — Affinage UX /operator/* (Phase B2.1)
 *
 * Affiche une checklist guidée pour mettre l'opérateur en production :
 *   1. Flotte ≥ 3 véhicules déclarés
 *   2. Au moins 1 livreur actif
 *   3. Au moins 1 ville couverte
 *   4. Au moins 1 tarif approuvé
 *
 * Si toutes les étapes sont validées, le widget se replie en bandeau succès.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fromTable } from "@/lib/supabase-helpers";
import type { OperatorRow } from "@/hooks/use-operator-context";

const MIN_FLEET = 3;

type Step = {
  key: string;
  label: string;
  done: boolean;
  to: string;
  cta: string;
  hint?: string;
};

export function OperatorOnboardingChecklist({ operator }: { operator: OperatorRow }) {
  const { data: ridersActive = 0 } = useQuery({
    queryKey: ["operator-onb-riders", operator.id],
    enabled: !!operator.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await fromTable("delivery_operator_riders")
        .select("id", { count: "exact", head: true })
        .eq("operator_id", operator.id)
        .eq("status", "active");
      return count ?? 0;
    },
  });

  const { data: citiesCount = 0 } = useQuery({
    queryKey: ["operator-onb-cities", operator.id],
    enabled: !!operator.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await fromTable("delivery_operator_cities")
        .select("id", { count: "exact", head: true })
        .eq("operator_id", operator.id)
        .eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: ratesApproved = 0 } = useQuery({
    queryKey: ["operator-onb-rates", operator.id],
    enabled: !!operator.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await fromTable("delivery_operator_rates")
        .select("id", { count: "exact", head: true })
        .eq("operator_id", operator.id)
        .eq("status", "approved")
        .eq("is_active", true);
      return count ?? 0;
    },
  });

  const fleetCount = Array.isArray(operator.vehicle_types)
    ? operator.vehicle_types.reduce((s, v) => s + Number(v.count || 0), 0)
    : 0;

  const steps: Step[] = [
    {
      key: "fleet",
      label: `Déclarer au moins ${MIN_FLEET} véhicules`,
      done: fleetCount >= MIN_FLEET,
      to: "/operator/fleet",
      cta: "Compléter la flotte",
      hint: `${fleetCount}/${MIN_FLEET}`,
    },
    {
      key: "riders",
      label: "Activer au moins 1 livreur",
      done: ridersActive >= 1,
      to: "/operator/fleet",
      cta: "Inviter un livreur",
      hint: `${ridersActive} actif${ridersActive > 1 ? "s" : ""}`,
    },
    {
      key: "coverage",
      label: "Couvrir au moins 1 ville",
      done: citiesCount >= 1,
      to: "/operator/coverage",
      cta: "Ajouter une ville",
      hint: `${citiesCount}`,
    },
    {
      key: "rates",
      label: "Faire approuver au moins 1 tarif",
      done: ratesApproved >= 1,
      to: "/operator/rates",
      cta: "Définir un tarif",
      hint: `${ratesApproved} approuvé${ratesApproved > 1 ? "s" : ""}`,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (allDone) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[hsl(var(--operator-success))]/10 text-[hsl(var(--operator-success))] text-xs font-medium border border-[hsl(var(--operator-success))]/20">
        <Sparkles size={14} />
        Configuration complète — votre entreprise est prête à recevoir des courses au checkout.
      </div>
    );
  }

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <Card className="border-[hsl(var(--operator-primary))]/30">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Mise en route ({doneCount}/{steps.length})</p>
            <p className="text-xs text-muted-foreground">
              Complétez ces étapes pour apparaître au checkout des clients.
            </p>
          </div>
          <div className="text-xs font-bold text-[hsl(var(--operator-primary))]">{pct}%</div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "var(--operator-gradient)" }}
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
                  <CheckCircle2 size={14} className="text-[hsl(var(--operator-success))] shrink-0" />
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
                  className="text-xs font-medium text-[hsl(var(--operator-primary))] hover:underline flex items-center gap-1 shrink-0"
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