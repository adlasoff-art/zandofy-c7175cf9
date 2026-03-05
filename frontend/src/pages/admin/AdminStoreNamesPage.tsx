import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, Store, Clock, ArrowRight } from "lucide-react";

export default function AdminStoreNamesPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-store-name-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, pending_name, name_change_status, owner_id, logo_url, created_at")
        .eq("name_change_status", "pending_review");
      if (error) throw error;
      return data || [];
    },
  });

  const handleAction = async (action: "approved" | "rejected") => {
    if (!selected) return;
    setLoading(true);

    const updates: Record<string, any> = {
      name_change_status: action,
    };

    if (action === "approved") {
      updates.name = selected.pending_name;
      updates.pending_name = null;
    }

    await supabase.from("stores").update(updates).eq("id", selected.id);

    // Notify store owner
    if (selected.owner_id) {
      const title = action === "approved"
        ? "Nom de boutique approuvé !"
        : "Changement de nom refusé";
      const message = action === "approved"
        ? `Votre boutique s'appelle désormais "${selected.pending_name}".`
        : adminNotes || "Votre demande de changement de nom n'a pas été approuvée.";

      await supabase.from("notifications").insert({
        user_id: selected.owner_id,
        type: "vendor",
        title,
        message,
        link: "/vendor",
      });
    }

    setLoading(false);
    setSelected(null);
    setAdminNotes("");
    queryClient.invalidateQueries({ queryKey: ["admin-store-name-requests"] });
    toast({ title: action === "approved" ? "Nom approuvé" : "Demande refusée" });
  };

  return (
    <AdminLayout title="Changements de nom boutique">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={18} className="text-amber-500" />
            Demandes en attente ({stores?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : !stores?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune demande de changement de nom en attente
            </p>
          ) : (
            <div className="space-y-3">
              {stores.map((store: any) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between border border-border rounded-md p-4"
                >
                  <div className="flex items-center gap-3">
                    {store.logo_url ? (
                      <img src={store.logo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Store size={18} className="text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{store.name}</span>
                        <ArrowRight size={14} className="text-muted-foreground" />
                        <span className="font-semibold text-primary">{store.pending_name}</span>
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">En attente</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setSelected(store); }}
                      className="gap-1.5"
                    >
                      <XCircle size={14} /> Refuser
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        setSelected(store);
                        // Quick approve without dialog
                      }}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={14} /> Approuver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setAdminNotes(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Demande de changement de nom</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="border border-border rounded-md p-3 space-y-2">
                <p><strong>Nom actuel :</strong> {selected.name}</p>
                <p><strong>Nouveau nom :</strong> <span className="text-primary font-semibold">{selected.pending_name}</span></p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optionnel, visible en cas de refus)</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Raison du refus..."
                  rows={3}
                />
              </div>

              <DialogFooter className="gap-2 flex-col sm:flex-row">
                <Button
                  variant="destructive"
                  onClick={() => handleAction("rejected")}
                  disabled={loading}
                  className="gap-1.5"
                >
                  <XCircle size={14} /> Refuser
                </Button>
                <Button
                  onClick={() => handleAction("approved")}
                  disabled={loading}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Approuver
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
