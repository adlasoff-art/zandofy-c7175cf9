/**
 * AdminCoverageRequestsPage — Demandes de couverture clients
 * Route: /admin/coverage-requests
 *
 * Liste les demandes envoyées via l'Edge Function `request-delivery-coverage`
 * et permet à un admin de les marquer comme traitées (fulfilled).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, MapPin, Check, Truck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type CoverageRequest = {
  id: string;
  user_id: string;
  country_code: string;
  city: string;
  commune: string | null;
  quartier: string | null;
  notes: string | null;
  requested_at: string;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  fulfilled_operator_id: string | null;
};

type ForwarderCoverageRequest = {
  id: string;
  user_id: string;
  origin_country: string;
  destination_country: string;
  destination_city: string | null;
  mode: string;
  notes: string | null;
  status: string;
  requested_at: string;
  resolved_at: string | null;
};

export default function AdminCoverageRequestsPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<"local" | "forwarder">("local");
  const [tab, setTab] = useState<"pending" | "fulfilled">("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coverage-requests", tab],
    enabled: scope === "local",
    queryFn: async () => {
      const q = (supabase as any)
        .from("coverage_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      const { data, error } =
        tab === "pending"
          ? await q.is("fulfilled_at", null)
          : await q.not("fulfilled_at", "is", null);
      if (error) throw error;
      return (data || []) as CoverageRequest[];
    },
  });

  const { data: fwdData, isLoading: fwdLoading } = useQuery({
    queryKey: ["admin-forwarder-coverage-requests", tab],
    enabled: scope === "forwarder",
    queryFn: async () => {
      const status = tab === "pending" ? ["pending", "notified"] : ["resolved", "dismissed"];
      const { data, error } = await (supabase as any)
        .from("forwarder_coverage_requests")
        .select("*")
        .in("status", status)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ForwarderCoverageRequest[];
    },
  });

  const fulfill = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("coverage_requests")
        .update({
          fulfilled_at: new Date().toISOString(),
          fulfilled_by: userData.user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande marquée comme traitée");
      qc.invalidateQueries({ queryKey: ["admin-coverage-requests"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const resolveFwd = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("forwarder_coverage_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: userData.user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande marquée comme traitée");
      qc.invalidateQueries({ queryKey: ["admin-forwarder-coverage-requests"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  return (
    <AdminLayout title="Demandes de couverture">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demandes de couverture</h1>
          <p className="text-sm text-muted-foreground">
            Zones non desservies signalées par les clients depuis le checkout.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">En attente</TabsTrigger>
            <TabsTrigger value="fulfilled">Traitées</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
          <TabsList>
            <TabsTrigger value="local" className="gap-1.5">
              <MapPin size={14} /> Livraison locale
            </TabsTrigger>
            <TabsTrigger value="forwarder" className="gap-1.5">
              <Truck size={14} /> Transitaires
            </TabsTrigger>
          </TabsList>

          <TabsContent value="local" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin size={16} />
                  {data?.length ?? 0} demande{(data?.length ?? 0) > 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : !data || data.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Aucune demande {tab === "pending" ? "en attente" : "traitée"}.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Localisation</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">
                            {formatDistanceToNow(new Date(r.requested_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.city}, {r.country_code}
                            {r.commune && <> · {r.commune}</>}
                            {r.quartier && <> · {r.quartier}</>}
                          </TableCell>
                          <TableCell className="text-xs max-w-[260px] truncate">
                            {r.notes || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {r.fulfilled_at ? (
                              <Badge variant="secondary">Traitée</Badge>
                            ) : (
                              <Badge variant="outline">En attente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!r.fulfilled_at && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => fulfill.mutate(r.id)}
                                disabled={fulfill.isPending}
                              >
                                <Check size={14} className="mr-1" /> Marquer traitée
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forwarder" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck size={16} />
                  {fwdData?.length ?? 0} demande{(fwdData?.length ?? 0) > 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fwdLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : !fwdData || fwdData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Aucune demande {tab === "pending" ? "en attente" : "traitée"}.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fwdData.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">
                            {formatDistanceToNow(new Date(r.requested_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.origin_country} → {r.destination_country}
                            {r.destination_city && <> · {r.destination_city}</>}
                          </TableCell>
                          <TableCell className="text-xs uppercase">{r.mode}</TableCell>
                          <TableCell>
                            {r.status === "resolved" ? (
                              <Badge variant="secondary">Traitée</Badge>
                            ) : r.status === "dismissed" ? (
                              <Badge variant="outline">Rejetée</Badge>
                            ) : (
                              <Badge variant="outline">En attente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {(r.status === "pending" || r.status === "notified") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => resolveFwd.mutate(r.id)}
                                disabled={resolveFwd.isPending}
                              >
                                <Check size={14} className="mr-1" /> Marquer traitée
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}