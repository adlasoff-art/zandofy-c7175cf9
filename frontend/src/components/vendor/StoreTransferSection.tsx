import { useMemo, useState } from "react";
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

interface ProfileResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Props {
  storeId: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  under_review: "En révision",
  completed: "Approuvé",
  rejected: "Rejeté",
  cancelled: "Annulé",
};

async function filterKycApproved(users: ProfileResult[]): Promise<ProfileResult[]> {
  if (!users.length) return [];
  const ids = users.map((u) => u.id);
  const { data: kycData } = await fromTable("kyc_verifications")
    .select("user_id")
    .in("user_id", ids)
    .eq("status", "approved");
  const verifiedIds = new Set((kycData || []).map((k: { user_id: string }) => k.user_id));
  return users.filter((u) => verifiedIds.has(u.id));
}

export function StoreTransferSection({ storeId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<ProfileResult | null>(null);
  const [reason, setReason] = useState("");

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

  const toUserIds = useMemo(
    () => [...new Set(existing.map((r: { to_user_id: string }) => r.to_user_id))],
    [existing],
  );

  const { data: recipientProfiles = [] } = useQuery({
    queryKey: ["transfer-recipient-profiles", toUserIds.join(",")],
    queryFn: async () => {
      if (!toUserIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", toUserIds);
      return data || [];
    },
    enabled: toUserIds.length > 0,
  });

  const recipientById = useMemo(
    () => new Map(recipientProfiles.map((p) => [p.id, p])),
    [recipientProfiles],
  );

  const isEmailSearch = searchTerm.includes("@");

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["search-transfer-recipients", searchTerm, user?.id],
    queryFn: async (): Promise<ProfileResult[]> => {
      const term = searchTerm.trim();
      if (term.length < 2) return [];

      if (isEmailSearch) {
        const { data } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, avatar_url")
          .ilike("email", term.toLowerCase())
          .neq("id", user?.id || "")
          .limit(5);
        return (data || []).filter((u) => u.email?.toLowerCase() === term.toLowerCase());
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url")
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
        .neq("id", user?.id || "")
        .limit(10);

      return filterKycApproved(data || []);
    },
    enabled: searchTerm.trim().length >= 2,
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

      await supabase.from("notifications").insert({
        user_id: selectedUser.id,
        type: "system",
        title: "Transfert de boutique proposé",
        message: "Un propriétaire souhaite vous transférer sa boutique. L'administrateur validera la demande.",
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
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const hasPending = existing.some(
    (r: { status: string }) => r.status === "pending" || r.status === "under_review",
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight size={18} className="text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Transfert de propriété</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Transférez la propriété de cette boutique à un autre utilisateur existant (email exact ou compte KYC vérifié).
        Après validation admin, vous redeviendrez client si vous n'avez plus d'autre boutique.
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

      {existing.length > 0 && (
        <div className="space-y-2 mt-3">
          <p className="text-xs font-medium text-muted-foreground">Historique des demandes</p>
          {existing.map((req: { id: string; to_user_id: string; reason?: string; status: string }) => {
            const recipient = recipientById.get(req.to_user_id);
            const label = recipient
              ? `${recipient.first_name || ""} ${recipient.last_name || ""}`.trim() || recipient.email
              : req.to_user_id.slice(0, 8);
            return (
              <div key={req.id} className="text-xs bg-muted/50 rounded p-2 flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  → {label}
                  {recipient?.email ? ` (${recipient.email})` : ""} — {req.reason || "Pas de motif"}
                </span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {STATUS_LABELS[req.status] || req.status}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

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
              Le nouveau propriétaire aura une rétention de retrait de 30 jours et des avantages réinitialisés.
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Nouveau propriétaire</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                Saisissez l'email exact du compte, ou recherchez par nom (KYC approuvé).
              </p>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="email@exemple.com ou nom..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setSelectedUser(null); }}
                  className="pl-9"
                />
              </div>
              {searching && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" /> Recherche...
                </div>
              )}

              {searchResults.length > 0 && !selectedUser && (
                <div className="border border-border rounded mt-2 max-h-40 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left text-sm"
                      onClick={() => {
                        setSelectedUser(u);
                        setSearchTerm(u.email || `${u.first_name} ${u.last_name}`);
                      }}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          {u.first_name?.[0]}
                        </div>
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

              {searchTerm.trim().length >= 2 && !searching && searchResults.length === 0 && !selectedUser && (
                <p className="text-xs text-muted-foreground mt-2">Aucun utilisateur trouvé.</p>
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
