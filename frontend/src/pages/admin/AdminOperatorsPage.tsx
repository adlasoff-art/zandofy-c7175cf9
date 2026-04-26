import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, PauseCircle, PlayCircle, Building2, Truck, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ShieldAlert, Clock } from "lucide-react";

type OperatorRow = {
  id: string;
  company_name: string;
  legal_name: string | null;
  contact_email: string;
  contact_phone: string;
  headquarters_city: string;
  headquarters_country: string;
  registration_number: string | null;
  tax_id: string | null;
  declared_riders_count: number;
  max_riders: number;
  vehicle_types: any;
  status: string;
  is_active: boolean;
  is_platform_owned: boolean;
  platform_commission_pct: number;
  rating_avg: number | null;
  total_deliveries: number;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
};

const STATUS_VARIANT: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "default" },
  approved: { label: "Approuvé", variant: "secondary" },
  rejected: { label: "Refusé", variant: "destructive" },
  suspended: { label: "Suspendu", variant: "outline" },
};

export default function AdminOperatorsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OperatorRow | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "suspend" | "reactivate" | null>(null);
  const [reason, setReason] = useState("");
  const [commissionPct, setCommissionPct] = useState<string>("");

  const { data: operators, isLoading } = useQuery({
    queryKey: ["admin-operators", tab],
    queryFn: async () => {
      let q = (supabase as any).from("delivery_operators").select("*").order("created_at", { ascending: false });
      if (tab !== "all") q = q.eq("status", tab);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as OperatorRow[];
    },
  });

  const { data: pendingRatesCount = 0 } = useQuery({
    queryKey: ["admin-operator-rates-pending-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("delivery_operator_rates")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const filtered = (operators || []).filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.company_name.toLowerCase().includes(s) ||
      (o.legal_name?.toLowerCase().includes(s) ?? false) ||
      o.contact_email.toLowerCase().includes(s) ||
      o.headquarters_city.toLowerCase().includes(s)
    );
  });

  const submitAction = useMutation({
    mutationFn: async () => {
      if (!selected || !actionType) throw new Error("Missing context");
      let fn = "";
      let body: Record<string, unknown> = {};
      if (actionType === "approve") {
        fn = "admin-approve-operator";
        body = { operator_id: selected.id };
        const pct = parseFloat(commissionPct);
        if (!Number.isNaN(pct) && pct >= 0 && pct <= 50) body.commission_pct_override = pct;
      } else if (actionType === "reject") {
        if (reason.trim().length < 5) throw new Error("Motif requis (5+ caractères)");
        fn = "admin-reject-operator";
        body = { operator_id: selected.id, rejection_reason: reason.trim() };
      } else if (actionType === "suspend") {
        fn = "admin-suspend-operator";
        body = { operator_id: selected.id, action: "suspend", reason: reason.trim() || undefined };
      } else if (actionType === "reactivate") {
        fn = "admin-suspend-operator";
        body = { operator_id: selected.id, action: "reactivate" };
      }
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Action effectuée" });
      qc.invalidateQueries({ queryKey: ["admin-operators"] });
      setActionType(null);
      setSelected(null);
      setReason("");
      setCommissionPct("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const counts = (operators || []).reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <AdminLayout title="Opérateurs de livraison">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Opérateurs de livraison</h1>
            <p className="text-sm text-muted-foreground">Modération KYB des entreprises de livraison du dernier kilomètre.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/admin/operator-rate-caps">
                <ShieldAlert size={14} /> Plafonds tarifaires
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/admin/operator-rates-pending">
                <Clock size={14} /> Tarifs en attente
                {pendingRatesCount ? (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 min-w-5">
                    {pendingRatesCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">En attente {counts.pending ? `(${counts.pending})` : ""}</TabsTrigger>
            <TabsTrigger value="approved">Approuvés</TabsTrigger>
            <TabsTrigger value="suspended">Suspendus</TabsTrigger>
            <TabsTrigger value="rejected">Refusés</TabsTrigger>
            <TabsTrigger value="all">Tous</TabsTrigger>
          </TabsList>
        </Tabs>

        <Input
          placeholder="Rechercher (nom, email, ville)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun opérateur dans cette catégorie.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((op) => (
              <Card key={op.id} className="hover:border-primary/50 transition">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 size={16} className="text-muted-foreground" />
                      <h3 className="font-semibold text-foreground truncate">{op.company_name}</h3>
                      <Badge variant={STATUS_VARIANT[op.status]?.variant || "default"}>
                        {STATUS_VARIANT[op.status]?.label || op.status}
                      </Badge>
                      {op.is_platform_owned && <Badge variant="outline">Plateforme</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span className="flex items-center gap-1"><MapPin size={12} />{op.headquarters_city}, {op.headquarters_country}</span>
                      <span className="flex items-center gap-1"><Users size={12} />{op.declared_riders_count} déclarés / max {op.max_riders}</span>
                      <span>{op.contact_email}</span>
                      <span>Commission {op.platform_commission_pct}%</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelected(op)}>Détails</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Drawer détail */}
      <Dialog open={!!selected && !actionType} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.company_name}</DialogTitle>
                <DialogDescription>Dossier KYB opérateur — {STATUS_VARIANT[selected.status]?.label}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <Section title="Identité entreprise">
                  <Field k="Raison sociale" v={selected.legal_name || "—"} />
                  <Field k="RCCM" v={selected.registration_number || "—"} />
                  <Field k="NIF / Tax ID" v={selected.tax_id || "—"} />
                </Section>
                <Section title="Contact">
                  <Field k="Email" v={selected.contact_email} />
                  <Field k="Téléphone" v={selected.contact_phone} />
                </Section>
                <Section title="Couverture & flotte">
                  <Field k="Siège" v={`${selected.headquarters_city}, ${selected.headquarters_country}`} />
                  <Field k="Riders déclarés" v={String(selected.declared_riders_count)} />
                  <Field k="Quota actuel" v={String(selected.max_riders)} />
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Véhicules</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(selected.vehicle_types) && selected.vehicle_types.map((v: any, i: number) => (
                        <Badge key={i} variant="outline" className="gap-1"><Truck size={12} />{v.type} × {v.count}</Badge>
                      ))}
                    </div>
                  </div>
                </Section>
                <Section title="Performance">
                  <Field k="Livraisons totales" v={String(selected.total_deliveries)} />
                  <Field k="Note moyenne" v={selected.rating_avg ? selected.rating_avg.toFixed(2) : "—"} />
                  <Field k="Commission plateforme" v={`${selected.platform_commission_pct} %`} />
                </Section>
                {selected.rejection_reason && (
                  <Section title="Motif de refus">
                    <p className="text-destructive">{selected.rejection_reason}</p>
                  </Section>
                )}
              </div>
              <DialogFooter className="flex flex-wrap gap-2">
                {selected.status === "pending" && (
                  <>
                    <Button variant="default" onClick={() => { setActionType("approve"); setCommissionPct(String(selected.platform_commission_pct)); }}>
                      <CheckCircle2 size={16} className="mr-1" /> Approuver
                    </Button>
                    <Button variant="destructive" onClick={() => setActionType("reject")}>
                      <XCircle size={16} className="mr-1" /> Refuser
                    </Button>
                  </>
                )}
                {selected.status === "approved" && (
                  <Button variant="outline" onClick={() => setActionType("suspend")}>
                    <PauseCircle size={16} className="mr-1" /> Suspendre
                  </Button>
                )}
                {selected.status === "suspended" && (
                  <Button variant="default" onClick={() => setActionType("reactivate")}>
                    <PlayCircle size={16} className="mr-1" /> Réactiver
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action dialog */}
      <Dialog open={!!actionType} onOpenChange={(o) => !o && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Approuver l'opérateur"}
              {actionType === "reject" && "Refuser la demande"}
              {actionType === "suspend" && "Suspendre l'opérateur"}
              {actionType === "reactivate" && "Réactiver l'opérateur"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionType === "approve" && (
              <div>
                <Label>Commission plateforme (%)</Label>
                <Input type="number" step="0.01" min={0} max={50} value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Laisser vide pour conserver la valeur actuelle ({selected?.platform_commission_pct}%).</p>
              </div>
            )}
            {(actionType === "reject" || actionType === "suspend") && (
              <div>
                <Label>{actionType === "reject" ? "Motif (obligatoire, 5+ caractères)" : "Motif (optionnel)"}</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Expliquez la décision…" />
              </div>
            )}
            {actionType === "reactivate" && (
              <p className="text-sm text-muted-foreground">L'opérateur retrouvera son accès complet et pourra reprendre les courses.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Annuler</Button>
            <Button onClick={() => submitAction.mutate()} disabled={submitAction.isPending}>
              {submitAction.isPending && <Loader2 size={16} className="animate-spin mr-1" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground font-medium text-right">{v}</span>
    </div>
  );
}