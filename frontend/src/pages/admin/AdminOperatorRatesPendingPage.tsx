/**
 * AdminOperatorRatesPendingPage — Lot 11B Phase B8
 *
 * Liste les tarifs opérateurs en attente de validation et permet
 * d'approuver / refuser via les edge functions admin-approve-operator-rate
 * et admin-reject-operator-rate.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from "lucide-react";

type PendingRate = {
  id: string;
  operator_id: string;
  zone_name: string;
  city: string;
  country_code: string;
  commune: string | null;
  quartier: string | null;
  base_price: number;
  surcharge: number;
  price_per_km: number;
  estimated_minutes: number;
  currency: string;
  submitted_at: string;
  is_active: boolean;
  delivery_operators: {
    company_name: string;
    contact_email: string;
    is_platform_owned: boolean;
  } | null;
};

type CityCap = {
  city: string;
  country_code: string;
  max_base_price: number;
  max_surcharge: number;
  max_estimated_minutes: number;
};

export default function AdminOperatorRatesPendingPage() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<PendingRate | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: rates, isLoading } = useQuery({
    queryKey: ["admin-operator-rates-pending"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_operator_rates")
        .select(
          "id, operator_id, zone_name, city, country_code, commune, quartier, base_price, surcharge, price_per_km, estimated_minutes, currency, submitted_at, is_active, delivery_operators(company_name, contact_email, is_platform_owned)"
        )
        .eq("status", "pending")
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PendingRate[];
    },
  });

  const { data: caps } = useQuery({
    queryKey: ["admin-operator-rate-caps-lookup"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_operator_city_caps")
        .select("city, country_code, max_base_price, max_surcharge, max_estimated_minutes");
      if (error) throw error;
      return (data ?? []) as unknown as CityCap[];
    },
  });

  const findCap = (city: string, country: string): CityCap | undefined =>
    caps?.find(
      (c) =>
        c.city.toLowerCase() === city.toLowerCase() &&
        c.country_code.toUpperCase() === country.toUpperCase()
    );

  const approveMut = useMutation({
    mutationFn: async (rate_id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-approve-operator-rate", {
        body: { rate_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Tarif approuvé");
      qc.invalidateQueries({ queryKey: ["admin-operator-rates-pending"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Erreur lors de l'approbation"),
  });

  const rejectMut = useMutation({
    mutationFn: async (vars: { rate_id: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-reject-operator-rate", {
        body: vars,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Tarif refusé");
      setRejectTarget(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-operator-rates-pending"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Erreur lors du refus"),
  });

  const submitReject = () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      toast.error("Indiquez une raison (3 caractères minimum)");
      return;
    }
    rejectMut.mutate({ rate_id: rejectTarget.id, reason: rejectReason.trim() });
  };

  return (
    <AdminLayout title="Tarifs opérateurs en attente">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Clock className="h-7 w-7" />
              Tarifs opérateurs en attente
            </h1>
            <p className="text-muted-foreground mt-1">
              Validez ou refusez les tarifs soumis par les opérateurs tiers avant qu'ils n'apparaissent au checkout.
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {rates?.length ?? 0} en attente
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !rates || rates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucun tarif en attente de validation.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rates.map((r) => {
              const cap = findCap(r.city, r.country_code);
              const overBase = cap && r.base_price > cap.max_base_price;
              const overSurcharge = cap && r.surcharge > cap.max_surcharge;
              const overEta = cap && r.estimated_minutes > cap.max_estimated_minutes;
              const noCap = !cap;

              return (
                <Card key={r.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">
                            {r.delivery_operators?.company_name ?? "Opérateur inconnu"}
                          </h3>
                          {r.delivery_operators?.is_platform_owned && (
                            <Badge variant="outline">Plateforme</Badge>
                          )}
                          <Badge variant="secondary">
                            {r.country_code} · {r.city}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Zone : <span className="font-medium">{r.zone_name}</span>
                          {r.commune && ` · Commune : ${r.commune}`}
                          {r.quartier && ` · Quartier : ${r.quartier}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Soumis le {new Date(r.submitted_at).toLocaleString("fr-FR")}
                          {" · "}
                          {r.delivery_operators?.contact_email}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMut.mutate(r.id)}
                          disabled={approveMut.isPending}
                        >
                          {approveMut.isPending && approveMut.variables === r.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setRejectTarget(r);
                            setRejectReason("");
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Refuser
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <Metric
                        label="Base"
                        value={`${r.base_price} ${r.currency}`}
                        capValue={cap ? `${cap.max_base_price}` : undefined}
                        warn={!!overBase}
                      />
                      <Metric
                        label="Surcharge"
                        value={`${r.surcharge} ${r.currency}`}
                        capValue={cap ? `${cap.max_surcharge}` : undefined}
                        warn={!!overSurcharge}
                      />
                      <Metric label="Prix / km" value={`${r.price_per_km} ${r.currency}`} />
                      <Metric
                        label="ETA (min)"
                        value={`${r.estimated_minutes}`}
                        capValue={cap ? `${cap.max_estimated_minutes}` : undefined}
                        warn={!!overEta}
                      />
                    </div>

                    {noCap && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded p-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        Aucun plafond défini pour {r.city} ({r.country_code}). Pensez à en créer un dans
                        « Plafonds tarifaires ».
                      </div>
                    )}
                    {(overBase || overSurcharge || overEta) && (
                      <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded p-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        Ce tarif dépasse le plafond admin. Le trigger DB devrait l'avoir refusé — vérifier.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser ce tarif</DialogTitle>
            <DialogDescription>
              {rejectTarget?.delivery_operators?.company_name} — {rejectTarget?.zone_name} (
              {rejectTarget?.city})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Raison du refus *</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex : tarif au-dessus du marché, ETA irréaliste, zone non couverte officiellement…"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Communiquée à l'opérateur (notification + email).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={submitReject} disabled={rejectMut.isPending}>
              {rejectMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Metric({
  label,
  value,
  capValue,
  warn,
}: {
  label: string;
  value: string;
  capValue?: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded border p-2 ${warn ? "border-destructive bg-destructive/5" : "border-border"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
      {capValue !== undefined && (
        <div className={`text-[10px] ${warn ? "text-destructive" : "text-muted-foreground"}`}>
          plafond : {capValue}
        </div>
      )}
    </div>
  );
}