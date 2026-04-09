import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bug, CheckCircle2, Clock, AlertTriangle, Loader2, ChevronDown, ChevronUp, Monitor, Smartphone, Globe } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

type ErrorStatus = "new" | "in_progress" | "resolved";

const STATUS_CONFIG: Record<ErrorStatus, { label: string; color: string; icon: typeof Bug }> = {
  new: { label: "Nouveau", color: "destructive", icon: AlertTriangle },
  in_progress: { label: "En cours", color: "default", icon: Clock },
  resolved: { label: "Corrigé", color: "secondary", icon: CheckCircle2 },
};

export default function AdminErrorReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState("active");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-error-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("error_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "resolved") {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = user?.id ?? null;
      }
      if (notes !== undefined) {
        updates.admin_notes = notes;
      }
      const { error } = await (supabase as any)
        .from("error_reports")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-error-reports"] });
      toast.success("Rapport mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const activeReports = reports.filter((r: any) => r.status !== "resolved");
  const resolvedReports = reports.filter((r: any) => r.status === "resolved");
  const displayed = tab === "active" ? activeReports : resolvedReports;

  const countByStatus = (status: string) => reports.filter((r: any) => r.status === status).length;

  return (
    <AdminLayout title="Rapports d'erreurs">
      <div className="p-4 md:p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus("new")}</p>
                <p className="text-xs text-muted-foreground">Nouveaux</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus("in_progress")}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countByStatus("resolved")}</p>
                <p className="text-xs text-muted-foreground">Corrigés</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="active">
              Actifs ({activeReports.length})
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Historique corrigés ({resolvedReports.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
              </div>
            ) : displayed.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  {tab === "active" ? "Aucune erreur active 🎉" : "Aucun bug corrigé pour l'instant."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {displayed.map((report: any) => {
                  const isExpanded = expandedId === report.id;
                  const status = (report.status ?? "new") as ErrorStatus;
                  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
                  const Icon = cfg.icon;

                  return (
                    <Card key={report.id} className="overflow-hidden">
                      <button
                        className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : report.id)}
                      >
                        <Icon className="w-5 h-5 mt-0.5 shrink-0 text-destructive" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={cfg.color as any}>{cfg.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(report.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                            </span>
                            {report.page_path && (
                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{report.page_path}</span>
                            )}
                          </div>
                          <p className="mt-1 text-sm font-medium truncate">{report.error_message}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            {report.user_email && <span>👤 {report.user_email}</span>}
                            {report.user_role && <span>({report.user_role})</span>}
                            {report.browser && <span><Globe className="inline w-3 h-3" /> {report.browser}</span>}
                            {report.os && <span><Monitor className="inline w-3 h-3" /> {report.os}</span>}
                            {report.screen_width && (
                              <span>
                                <Smartphone className="inline w-3 h-3" /> {report.screen_width}×{report.screen_height}
                              </span>
                            )}
                            {report.is_pwa && <Badge variant="outline" className="text-[10px] px-1 py-0">PWA</Badge>}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                      </button>

                      {isExpanded && (
                        <div className="border-t p-4 space-y-4 bg-muted/20">
                          {/* Stack trace */}
                          {report.error_stack && (
                            <div>
                              <p className="text-xs font-semibold mb-1">Stack trace</p>
                              <ScrollArea className="max-h-48">
                                <pre className="text-xs font-mono whitespace-pre-wrap bg-background p-3 rounded border">
                                  {report.error_stack}
                                </pre>
                              </ScrollArea>
                            </div>
                          )}

                          {/* Component stack */}
                          {report.component_stack && (
                            <div>
                              <p className="text-xs font-semibold mb-1">Component stack</p>
                              <ScrollArea className="max-h-32">
                                <pre className="text-xs font-mono whitespace-pre-wrap bg-background p-3 rounded border">
                                  {report.component_stack}
                                </pre>
                              </ScrollArea>
                            </div>
                          )}

                          {/* Admin notes */}
                          <div>
                            <p className="text-xs font-semibold mb-1">Notes admin</p>
                            <Textarea
                              placeholder="Ajouter des notes sur ce bug..."
                              value={adminNotes[report.id] ?? report.admin_notes ?? ""}
                              onChange={(e) => setAdminNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                              rows={2}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select
                              value={status}
                              onValueChange={(val) =>
                                updateMutation.mutate({
                                  id: report.id,
                                  status: val,
                                  notes: adminNotes[report.id],
                                })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">Nouveau</SelectItem>
                                <SelectItem value="in_progress">En cours</SelectItem>
                                <SelectItem value="resolved">Corrigé</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateMutation.mutate({
                                  id: report.id,
                                  status,
                                  notes: adminNotes[report.id],
                                })
                              }
                              disabled={updateMutation.isPending}
                            >
                              Sauvegarder notes
                            </Button>

                            {report.resolved_at && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                Corrigé le {format(new Date(report.resolved_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
