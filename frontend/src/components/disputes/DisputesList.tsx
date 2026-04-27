import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, Loader2, MessageCircle, ChevronLeft } from "lucide-react";
import { DisputeChat } from "./DisputeChat";
import { DisputeSLABadge } from "./DisputeSLABadge";
import { DisputeEvidenceUpload } from "./DisputeEvidenceUpload";
import { DisputeRefundPanel } from "./DisputeRefundPanel";

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  open: { label: "Ouvert", class: "bg-amber-100 text-amber-700" },
  under_review: { label: "En examen", class: "bg-blue-100 text-blue-700" },
  resolved: { label: "Résolu", class: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Fermé", class: "bg-muted text-muted-foreground" },
};

const REASON_MAP: Record<string, string> = {
  return_rejected: "Retour refusé",
  quality_issue: "Qualité non conforme",
  not_received: "Non reçue",
  partial_delivery: "Livraison partielle",
  overcharged: "Surfacturation",
  vendor_unresponsive: "Vendeur non réactif",
  other: "Autre",
};

export function DisputesList() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: disputes = [] as any[], isLoading, refetch } = useQuery({
    queryKey: ["my-disputes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("disputes")
        .select("*, orders!inner(total)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  if (disputes.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={32} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Aucun litige en cours</p>
      </div>
    );
  }

  const selected = disputes.find(d => d.id === selectedId);

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedId(null)} className="text-sm text-primary flex items-center gap-1">
          <ChevronLeft size={14} /> Retour aux litiges
        </button>
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{REASON_MAP[selected.reason] || selected.reason}</span>
            <div className="flex items-center gap-2">
              <DisputeSLABadge
                slaResponseDueAt={selected.sla_response_due_at}
                slaResolutionDueAt={selected.sla_resolution_due_at}
                vendorFirstResponseAt={selected.vendor_first_response_at}
                escalatedAt={selected.escalated_at}
                isOverdue={selected.is_overdue}
                status={selected.status}
              />
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_MAP[selected.status]?.class || ""}`}>
                {STATUS_MAP[selected.status]?.label || selected.status}
              </span>
            </div>
          </div>
          {selected.description && <p className="text-xs text-muted-foreground">{selected.description}</p>}
          {selected.resolution && (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded p-2 text-xs text-emerald-700 dark:text-emerald-400">
              <strong>Résolution :</strong> {selected.resolution}
            </div>
          )}
        </div>

        <DisputeRefundPanel
          disputeId={selected.id}
          orderTotal={Number(selected.orders?.total || 0)}
          viewerRole="client"
          proposedAmount={selected.proposed_refund_amount}
          proposedMethod={selected.proposed_refund_method}
          proposedStatus={selected.proposed_refund_status}
          finalRefundAmount={selected.final_refund_amount}
          finalRefundMethod={selected.final_refund_method}
          onChanged={() => refetch()}
        />

        <div className="bg-card border border-border rounded-lg p-4">
          <DisputeEvidenceUpload
            disputeId={selected.id}
            canUpload={["open","under_review","escalated"].includes(selected.status)}
          />
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <DisputeChat disputeId={selected.id} disputeStatus={selected.status} viewerRole="client" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {disputes.map(d => {
        const st = STATUS_MAP[d.status] || STATUS_MAP.open;
        return (
          <button
            key={d.id}
            onClick={() => setSelectedId(d.id)}
            className="w-full bg-card border border-border rounded-lg p-4 space-y-2 text-left hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-sm font-medium text-foreground">{REASON_MAP[d.reason] || d.reason}</span>
              </div>
              <div className="flex items-center gap-2">
                <DisputeSLABadge
                  slaResponseDueAt={d.sla_response_due_at}
                  slaResolutionDueAt={d.sla_resolution_due_at}
                  vendorFirstResponseAt={d.vendor_first_response_at}
                  escalatedAt={d.escalated_at}
                  isOverdue={d.is_overdue}
                  status={d.status}
                />
                <MessageCircle size={12} className="text-muted-foreground" />
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${st.class}`}>{st.label}</span>
              </div>
            </div>
            {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{format(new Date(d.created_at), "dd MMM yyyy", { locale: fr })}</span>
              <span className="capitalize text-xs">Priorité : {d.priority}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
