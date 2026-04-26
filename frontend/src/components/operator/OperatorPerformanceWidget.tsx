/**
 * OperatorPerformanceWidget — Lot 11B Phase B9
 *
 * Affiche le score de fiabilité de l'opérateur connecté + KPIs clés
 * (acceptation, expiration, refus, délai réponse, note client).
 * Source : vue v_operator_performance (RLS : owner peut lire son propre row).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Star,
  Clock,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface Props {
  operatorId: string;
}

export function OperatorPerformanceWidget({ operatorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["operator-performance-self", operatorId],
    enabled: !!operatorId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_operator_performance")
        .select("*")
        .eq("operator_id", operatorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !data) return null;

  const score = data.reliability_score !== null ? Number(data.reliability_score) : null;
  const scoreColor =
    score === null
      ? "text-muted-foreground"
      : score >= 75
        ? "text-emerald-500"
        : score >= 50
          ? "text-amber-500"
          : "text-red-500";
  const scoreLabel =
    score === null
      ? "Pas encore noté"
      : score >= 75
        ? "Excellent"
        : score >= 50
          ? "À surveiller"
          : "Action requise";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={16} className="text-[hsl(var(--operator-primary))]" />
          Ma performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={`text-4xl font-bold ${scoreColor}`}>
              {score !== null ? score.toFixed(1) : "—"}
              <span className="text-sm text-muted-foreground font-normal ml-1">/100</span>
            </p>
            <p className={`text-xs font-medium ${scoreColor}`}>{scoreLabel}</p>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            Sur {data.reliability_window_days ?? 30}j glissants
            <br />
            {data.total_assignments ?? 0} assignation(s)
          </div>
        </div>

        {data.auto_suspended_at && (
          <div className="mb-3 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-600 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Compte suspendu automatiquement</p>
              {data.auto_suspension_reason && <p className="mt-0.5">{data.auto_suspension_reason}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Mini icon={TrendingUp} label="Acceptation" value={`${data.acceptance_rate ?? 0}%`} />
          <Mini icon={TrendingDown} label="Refus" value={`${data.decline_rate ?? 0}%`} />
          <Mini icon={Clock} label="Expiration" value={`${data.expiry_rate ?? 0}%`} />
          <Mini
            icon={Activity}
            label="Délai réponse"
            value={`${Math.round(Number(data.avg_response_minutes ?? 0))}min`}
          />
          <Mini
            icon={Star}
            label="Note client"
            value={
              data.customer_rating_count
                ? `${Number(data.customer_rating_avg ?? 0).toFixed(1)}/5`
                : "—"
            }
          />
        </div>

        <p className="text-[10px] text-muted-foreground mt-3">
          Score = 50 % acceptation + 30 % anti-expiration + 20 % note client.
        </p>
      </CardContent>
    </Card>
  );
}

function Mini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-md p-2 border border-border bg-muted/30">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon size={10} /> {label}
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}