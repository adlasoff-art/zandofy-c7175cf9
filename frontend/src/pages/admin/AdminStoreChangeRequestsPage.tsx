import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PenLine, Search, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const fieldLabels: Record<string, string> = {
  name: "Nom de la boutique",
  whatsapp: "Numéro WhatsApp",
  email: "Email boutique",
  contact_person: "Personne de contact",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function AdminStoreChangeRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["store-change-requests"],
    queryFn: async () => {
      const { data, error } = await fromTable("store_change_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const storeIds = [...new Set(requests.map((r: any) => r.store_id))] as string[];
  const { data: stores = [] } = useQuery({
    queryKey: ["change-req-stores", storeIds.join(",")],
    queryFn: async () => {
      if (!storeIds.length) return [];
      const { data } = await supabase.from("stores").select("id, name").in("id", storeIds);
      return data || [];
    },
    enabled: storeIds.length > 0,
  });

  const getStore = (id: string) => stores.find((s: any) => s.id === id);

  const mutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes: string }) => {
      const { error } = await fromTable("store_change_requests").update({
        status,
        admin_notes: adminNotes,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;

      // If approved, apply the change
      if (status === "approved") {
        const req = requests.find((r: any) => r.id === id);
        if (req) {
          const fieldMap: Record<string, string> = {
            name: "name",
            whatsapp: "whatsapp_number",
            email: "email",
            contact_person: "contact_person",
          };
          const col = fieldMap[req.field_name] || req.field_name;
          await supabase.from("stores").update({ [col]: req.new_value } as any).eq("id", req.store_id);

          // Audit
          await fromTable("admin_audit_logs").insert({
            admin_id: user?.id,
            action: "store_change_approved",
            target_user_id: req.requested_by,
            details: { store_id: req.store_id, field: req.field_name, old: req.old_value, new: req.new_value },
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Modification traitée" });
      qc.invalidateQueries({ queryKey: ["store-change-requests"] });
      setActionType(null);
      setSelected(null);
      setNotes("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const filtered = requests.filter((r: any) => {
    if (!search) return true;
    const store = getStore(r.store_id);
    return store?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.new_value?.toLowerCase().includes(search.toLowerCase());
  });

  const pendingCount = requests.filter((r: any) => r.status === "pending").length;

  return (
    <AdminLayout title="Demandes de modification boutique">
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-yellow-700 border-yellow-300">{pendingCount} en attente</Badge>
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucune demande.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((req: any) => {
              const store = getStore(req.store_id);
              return (
                <div key={req.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{store?.name || "Boutique"}</span>
                      <Badge className={statusColors[req.status] || ""}>{req.status === "pending" ? "En attente" : req.status === "approved" ? "Approuvé" : "Rejeté"}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">{fieldLabels[req.field_name] || req.field_name}</span>
                      {" : "}
                      <span className="line-through text-destructive/70">{req.old_value || "—"}</span>
                      {" → "}
                      <span className="text-primary font-medium">{req.new_value}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{req.created_at ? format(new Date(req.created_at), "dd MMM yyyy", { locale: fr }) : ""}</p>
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setSelected(req); setNotes(""); setActionType("approve"); }}>
                        <CheckCircle size={14} className="mr-1" /> Approuver
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => { setSelected(req); setNotes(""); setActionType("reject"); }}>
                        <XCircle size={14} className="mr-1" /> Rejeter
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!actionType} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "approve" ? "Approuver la modification" : "Rejeter la modification"}</DialogTitle>
          </DialogHeader>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optionnel)..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Annuler</Button>
            <Button
              onClick={() => selected && mutation.mutate({ id: selected.id, status: actionType === "approve" ? "approved" : "rejected", adminNotes: notes })}
              disabled={mutation.isPending}
              className={actionType === "reject" ? "bg-destructive" : "bg-green-600 hover:bg-green-700"}
            >
              {mutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
