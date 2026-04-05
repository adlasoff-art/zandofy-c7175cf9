import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Search, Loader2, AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Props {
  storeId: string;
}

export function StoreTransferSection({ storeId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [reason, setReason] = useState("");

  // Existing transfer requests
  const { data: existing = [] } = useQuery({
    queryKey: ["my-transfer-requests", storeId],
    queryFn: async () => {
      const { data } = await fromTable("store_transfer_requests")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Search KYC-verified users
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["search-kyc-users", searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url")
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .neq("id", user?.id || "")
        .limit(10);

      // Filter only KYC verified users
      if (!data?.length) return [];
      const ids = data.map((u) => u.id);
      const { data: kycData } = await fromTable("kyc_verifications")
        .select("user_id")
        .in("user_id", ids)
        .eq("status", "approved");
      const verifiedIds = new Set((kycData || []).map((k: any) => k.user_id));
      return data.filter((u) => verifiedIds.has(u.id));
    },
    enabled: searchTerm.length >= 2,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser || !user?.id) throw new Error("Utilisateur non sélectionné");
      const { error } = await fromTable("store_transfer_requests").insert({
        store_id: storeId,
        from_user_id: user.id,
        to_user_id: selectedUser.id,
        transfer_type: "owner_initiated",
        reason,
        status: "pending",
        kyc_verified_from: true,
        kyc_verified_to: true,
      });
      if (error) throw error;

      // Notify the target user
      await supabase.from("notifications").insert({
        user_id: selectedUser.id,
        type: "system",
        title: "Transfert de boutique proposé",
        message: `Un propriétaire souhaite vous transférer sa boutique. Consultez vos notifications.`,
        link: "/vendor",
      });
    },
    onSuccess: () => {
      toast({ title: "Demande soumise", description: "L'administrateur examinera votre demande." });
      qc.invalidateQueries({ queryKey: ["my-transfer-requests"] });
      setShowDialog(false);
      setSelectedUser(null);
      setReason("");
      setSearchTerm("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const hasPending = existing.some((r: any) => r.status === "pending" || r.status === "under_review");

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight size={18} className="text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Transfert de propriété</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Transférez la propriété de cette boutique à un autre utilisateur vérifié (KYC).
        Le nouveau propriétaire sera soumis à une période de rétention de 30 jours et perdra certains avantages.
      </p>

      {hasPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800 flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>Une demande de transfert est déjà en cours.</span>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={hasPending}
        className="border-primary text-primary"
      >
        <ArrowLeftRight size={14} className="mr-1" /> Transférer cette boutique
      </Button>

      {/* History */}
      {existing.length > 0 && (
        <div className="space-y-2 mt-3">
          <p className="text-xs font-medium text-muted-foreground">Historique des demandes</p>
          {existing.map((req: any) => (
            <div key={req.id} className="text-xs bg-muted/50 rounded p-2 flex justify-between">
              <span>→ {req.to_user_id?.slice(0, 8)}... — {req.reason || "Pas de motif"}</span>
              <Badge variant="outline" className="text-xs">
                {req.status === "pending" ? "En attente" : req.status === "completed" ? "Approuvé" : req.status === "rejected" ? "Rejeté" : req.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight size={18} /> Transférer la boutique
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-xs text-destructive">
              <Shield size={14} className="inline mr-1" />
              <strong>Avertissement :</strong> Ce transfert est irréversible une fois approuvé par l'administrateur.
              Le nouveau propriétaire sera soumis à une rétention de retrait de 30 jours et perdra l'accès aux coupons, collaborateurs, self-delivery et WhatsApp.
            </div>

            {/* User search */}
            <div>
              <label className="text-sm font-medium text-foreground">Nouveau propriétaire (KYC vérifié uniquement)</label>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setSelectedUser(null); }}
                  className="pl-9"
                />
              </div>
              {searching && <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Recherche...</div>}

              {searchResults.length > 0 && !selectedUser && (
                <div className="border border-border rounded mt-2 max-h-40 overflow-y-auto">
                  {searchResults.map((u: any) => (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left text-sm"
                      onClick={() => { setSelectedUser(u); setSearchTerm(`${u.first_name} ${u.last_name}`); }}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">{u.first_name?.[0]}</div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <CheckCircle size={14} className="text-green-500 ml-auto shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {selectedUser && (
                <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded p-2 text-sm">
                  <CheckCircle size={14} className="text-green-600" />
                  <span className="font-medium">{selectedUser.first_name} {selectedUser.last_name}</span>
                  <span className="text-xs text-muted-foreground">({selectedUser.email})</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Raison du transfert</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Décrivez pourquoi vous souhaitez transférer cette boutique..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !selectedUser || !reason.trim()}
            >
              {submitMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
