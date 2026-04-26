import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Users, ArrowUp } from "lucide-react";

type QuotaRow = {
  id: string;
  operator_id: string;
  current_quota: number;
  requested_quota: number;
  justification: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  operator?: { company_name: string; headquarters_city: string; max_riders: number } | null;
};

const STATUS_VARIANT: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "default" },
  approved: { label: "Approuvée", variant: "secondary" },
  rejected: { label: "Refusée", variant: "destructive" },
};

export default function AdminOperatorQuotaRequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState<QuotaRow | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [grantedQuota, setGrantedQuota] = useState<string>("");
  const [reason, setReason] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-quota-requests", tab],
    queryFn: async () => {
      let q = (supabase as any)
        .from("operator_quota_requests")
        .select("*, operator:delivery_operators(company_name, headquarters_city, max_riders)")
        .order("created_at", { ascending: false });
      if (tab !== "all") q = q.eq("status", tab);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as QuotaRow[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!selected || !decision) throw new Error("Missing");
      const body: Record<string, unknown> = { request_id: selected.id, decision };
      if (decision === "approve") {
        const g = parseInt(grantedQuota, 10);
        if (!Number.isFinite(g) || g < selected.current_quota || g > 30) {
          throw new Error(`Quota accordé invalide (entre ${selected.current_quota} et 30)`);
        }
        body.granted_quota = g;
      } else if (decision === "reject") {
        if (reason.trim()) body.rejection_reason = reason.trim();
      }
      const { data, error } = await supabase.functions.invoke("admin-review-quota-request", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Décision enregistrée" });
      qc.invalidateQueries({ queryKey: ["admin-quota-requests"] });
      setDecision(null);
      setSelected(null);
      setReason("");
      setGrantedQuota("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const counts = (requests || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <AdminLayout title="Demandes de quota livreurs">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Demandes d'augmentation du nombre maximum de livreurs envoyées par les opérateurs.
        </p>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">En attente {counts.pending ? `(${counts.pending})` : ""}</TabsTrigger>
            <TabsTrigger value="approved">Approuvées</TabsTrigger>
            <TabsTrigger value="rejected">Refusées</TabsTrigger>
            <TabsTrigger value="all">Toutes</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
        ) : !requests || requests.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune demande dans cette catégorie.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {requests.map((r) => (
              <Card key={r.id} className="hover:border-primary/50 transition">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Users size={16} className="text-muted-foreground" />
                      <h3 className="font-semibold text-foreground truncate">{r.operator?.company_name || "—"}</h3>
                      <Badge variant={STATUS_VARIANT[r.status]?.variant || "default"}>
                        {STATUS_VARIANT[r.status]?.label || r.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span>{r.operator?.headquarters_city || ""}</span>
                      <span className="flex items-center gap-1">
                        Quota actuel <strong className="text-foreground">{r.current_quota}</strong>
                        <ArrowUp size={12} />
                        Demandé <strong className="text-foreground">{r.requested_quota}</strong>
                      </span>
                      <span>Soumis le {new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    {r.justification && (
                      <p className="text-xs text-foreground/80 mt-2 line-clamp-2">"{r.justification}"</p>
                    )}
                  </div>
                  {r.status === "pending" ? (
                    <Button size="sm" onClick={() => { setSelected(r); setGrantedQuota(String(r.requested_quota)); }}>
                      Examiner
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Détails</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected && !decision} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.operator?.company_name || "Opérateur"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Quota actuel :</span> <strong>{selected.current_quota}</strong></p>
                <p><span className="text-muted-foreground">Quota demandé :</span> <strong>{selected.requested_quota}</strong></p>
                <p><span className="text-muted-foreground">Statut :</span> <Badge variant={STATUS_VARIANT[selected.status]?.variant}>{STATUS_VARIANT[selected.status]?.label}</Badge></p>
                {selected.justification && (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground tracking-wide mt-3 mb-1">Justification</p>
                    <p className="text-foreground/90 bg-muted rounded p-2 text-sm">{selected.justification}</p>
                  </div>
                )}
                {selected.rejection_reason && (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground tracking-wide mt-3 mb-1">Motif de refus</p>
                    <p className="text-destructive">{selected.rejection_reason}</p>
                  </div>
                )}
              </div>
              {selected.status === "pending" && (
                <DialogFooter>
                  <Button variant="destructive" onClick={() => setDecision("reject")}>
                    <XCircle size={16} className="mr-1" /> Refuser
                  </Button>
                  <Button onClick={() => setDecision("approve")}>
                    <CheckCircle2 size={16} className="mr-1" /> Approuver
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "approve" ? "Approuver la demande" : "Refuser la demande"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {decision === "approve" && selected && (
              <div>
                <Label>Quota accordé (entre {selected.current_quota} et 30)</Label>
                <Input
                  type="number"
                  min={selected.current_quota}
                  max={30}
                  value={grantedQuota}
                  onChange={(e) => setGrantedQuota(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Vous pouvez accorder un quota différent de celui demandé ({selected.requested_quota}).
                </p>
              </div>
            )}
            {decision === "reject" && (
              <div>
                <Label>Motif (optionnel)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Annuler</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}