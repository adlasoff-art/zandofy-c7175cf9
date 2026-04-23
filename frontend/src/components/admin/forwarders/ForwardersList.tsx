import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Pencil, MapPin, DollarSign, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { ForwarderFormDialog, type Forwarder } from "./ForwarderFormDialog";
import { ForwarderCoverageDialog } from "./ForwarderCoverageDialog";
import { ForwarderTiersDialog } from "./ForwarderTiersDialog";
import { ForwarderPricingProfilesDialog } from "./ForwarderPricingProfilesDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const sb = supabase as any;

export function ForwardersList() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Forwarder | null>(null);
  const [coverageFor, setCoverageFor] = useState<Forwarder | null>(null);
  const [tiersFor, setTiersFor] = useState<Forwarder | null>(null);
  const [profilesFor, setProfilesFor] = useState<Forwarder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Forwarder | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-forwarders"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("forwarders")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Forwarder[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sb.from("forwarders").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-forwarders"] }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("forwarders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transitaire supprimé");
      qc.invalidateQueries({ queryKey: ["admin-forwarders"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">{rows.length} transitaire(s)</h2>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={14} className="mr-1" /> Nouveau
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Aucun transitaire enregistré. Cliquez sur « Nouveau » pour commencer.
          </div>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {rows.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                    {f.logo_url ? (
                      <img src={f.logo_url} alt={f.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Truck size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <Badge variant="outline" className="text-[10px]">{f.slug}</Badge>
                      {!f.is_active && <Badge variant="secondary" className="text-[10px]">Inactif</Badge>}
                    </div>
                    {f.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{f.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={!!f.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: f.id!, is_active: v })}
                  />
                  <Button size="icon" variant="ghost" title="Couverture" onClick={() => setCoverageFor(f)}>
                    <MapPin size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" title="Tarifs (paliers CBM, pièces, règles)" onClick={() => setProfilesFor(f)}>
                    <DollarSign size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" title="Multiplicateurs (legacy)" onClick={() => setTiersFor(f)}>
                    <span className="text-[10px] font-bold">×</span>
                  </Button>
                  <Button size="icon" variant="ghost" title="Modifier" onClick={() => { setEditing(f); setFormOpen(true); }}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Supprimer"
                    onClick={() => setDeleteTarget(f)}
                  >
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ForwarderFormDialog open={formOpen} onOpenChange={setFormOpen} forwarder={editing} />
        <ForwarderCoverageDialog
          open={!!coverageFor}
          onOpenChange={(v) => !v && setCoverageFor(null)}
          forwarderId={coverageFor?.id ?? null}
          forwarderName={coverageFor?.name}
        />
        <ForwarderTiersDialog
          open={!!tiersFor}
          onOpenChange={(v) => !v && setTiersFor(null)}
          forwarderId={tiersFor?.id ?? null}
          forwarderName={tiersFor?.name}
        />
        <ForwarderPricingProfilesDialog
          open={!!profilesFor}
          onOpenChange={(v) => !v && setProfilesFor(null)}
          forwarderId={profilesFor?.id ?? null}
          forwarderName={profilesFor?.name}
        />
        <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le transitaire ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le transitaire « {deleteTarget?.name} » sera supprimé définitivement,
                ainsi que sa couverture et ses paliers tarifaires.
                Les commandes déjà assignées ne seront pas modifiées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteTarget?.id) remove.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}