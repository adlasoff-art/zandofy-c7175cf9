import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVendorSubscription } from "@/hooks/use-vendor-subscription";
import { VENDOR_TIERS } from "@/lib/vendor-tiers";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, Loader2, Mail, Shield, ShieldCheck, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const AVAILABLE_PERMISSIONS = [
  { value: "orders", label: "Commandes", description: "Voir et gérer les commandes" },
  { value: "products", label: "Catalogue", description: "Ajouter/modifier les produits" },
  { value: "messages", label: "Messages", description: "Chat avec les clients" },
  { value: "analytics", label: "Statistiques", description: "Voir les stats de la boutique" },
] as const;

interface Collaborator {
  id: string;
  user_id: string;
  role: string;
  invited_email: string | null;
  status: string;
  permissions: string[] | null;
  sub_role: string | null;
  created_at: string;
  profile_email?: string;
  profile_name?: string;
  is_kyc_verified?: boolean;
}

interface Props {
  storeId: string;
}

export function VendorTeamTab({ storeId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { subscription } = useVendorSubscription(storeId);
  const [email, setEmail] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["orders"]);

  const { data: storeData } = useQuery({
    queryKey: ["store-collab-limit", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stores")
        .select("max_collaborators_override")
        .eq("id", storeId)
        .single();
      return data as { max_collaborators_override: number | null } | null;
    },
  });

  const tier = subscription?.tier || "beginner";
  const tierLimit = VENDOR_TIERS[tier]?.maxCollaborators || 2;
  const maxCollaborators = storeData?.max_collaborators_override ?? tierLimit;

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: ["store-collaborators", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("store_collaborators")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });

      if (!data) return [];

      const userIds = data.map((c: any) => c.user_id).filter(Boolean);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, email, first_name, last_name").in("id", userIds)
        : { data: [] };

      // Check KYC status via kyc_verifications table
      const { data: kycData } = userIds.length
        ? await supabase.from("kyc_verifications").select("user_id, status").in("user_id", userIds).eq("status", "approved")
        : { data: [] };
      const kycSet = new Set((kycData || []).map((k: any) => k.user_id));

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return data.map((c: any) => {
        const profile = profileMap.get(c.user_id);
        return {
          ...c,
          profile_email: profile?.email || c.invited_email,
          profile_name: profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : null,
          is_kyc_verified: kycSet.has(c.user_id),
        } as Collaborator;
      });
    },
  });

  const addCollaborator = useMutation({
    mutationFn: async (inviteEmail: string) => {
      const activeCount = collaborators.filter((c) => c.status !== "removed").length;
      if (activeCount >= maxCollaborators) {
        throw new Error(`Limite de ${maxCollaborators} collaborateurs atteinte.`);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, is_kyc_verified")
        .eq("email", inviteEmail.toLowerCase().trim())
        .maybeSingle();

      if (!profile) throw new Error("Aucun utilisateur trouvé avec cet email.");
      if (profile.id === user?.id) throw new Error("Vous ne pouvez pas vous ajouter vous-même.");
      if (!profile.is_kyc_verified) throw new Error("Ce collaborateur doit d'abord compléter sa vérification d'identité (KYC).");

      if (selectedPermissions.length === 0) throw new Error("Sélectionnez au moins une permission.");

      const { error } = await (supabase as any).from("store_collaborators").insert({
        store_id: storeId,
        user_id: profile.id,
        invited_email: inviteEmail.toLowerCase().trim(),
        status: "active",
        role: "member",
        sub_role: selectedPermissions[0],
        permissions: selectedPermissions,
      } as any);

      if (error) {
        if (error.code === "23505") throw new Error("Ce collaborateur existe déjà.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-collaborators", storeId] });
      toast.success("Collaborateur ajouté !");
      setEmail("");
      setSelectedPermissions(["orders"]);
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  const updatePermissions = useMutation({
    mutationFn: async ({ collabId, permissions }: { collabId: string; permissions: string[] }) => {
      const { error } = await (supabase as any)
        .from("store_collaborators")
        .update({ permissions, sub_role: permissions[0] || "orders" } as any)
        .eq("id", collabId)
        .eq("store_id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-collaborators", storeId] });
      toast.success("Permissions mises à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const removeCollaborator = useMutation({
    mutationFn: async (collabId: string) => {
      const { error } = await (supabase as any)
        .from("store_collaborators")
        .delete()
        .eq("id", collabId)
        .eq("store_id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-collaborators", storeId] });
      toast.success("Collaborateur retiré");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const togglePermission = (value: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const toggleCollabPermission = (collab: Collaborator, perm: string) => {
    const current = collab.permissions || ["orders"];
    const updated = current.includes(perm)
      ? current.filter((p) => p !== perm)
      : [...current, perm];
    if (updated.length === 0) {
      toast.error("Au moins une permission requise");
      return;
    }
    updatePermissions.mutate({ collabId: collab.id, permissions: updated });
  };

  const activeCollabs = collaborators.filter((c) => c.status !== "removed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Users size={18} className="text-primary" />
            Équipe
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeCollabs.length}/{maxCollaborators} collaborateurs
          </p>
        </div>
      </div>

      {/* Invite form */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <label className="text-sm font-medium text-foreground">Inviter un collaborateur</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.trim()) addCollaborator.mutate(email);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => email.trim() && addCollaborator.mutate(email)}
            disabled={!email.trim() || addCollaborator.isPending || activeCollabs.length >= maxCollaborators}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {addCollaborator.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Ajouter
          </button>
        </div>

        {/* Permission selection for new collaborator */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Permissions du nouveau membre :</p>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_PERMISSIONS.map((perm) => (
              <label
                key={perm.value}
                className="flex items-start gap-2 p-2 rounded-md border border-border bg-background cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedPermissions.includes(perm.value)}
                  onCheckedChange={() => togglePermission(perm.value)}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-xs font-medium text-foreground">{perm.label}</span>
                  <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {activeCollabs.length >= maxCollaborators && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Limite atteinte. Contactez l'administration pour augmenter votre quota.
          </p>
        )}
      </div>

      {/* Collaborator list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      ) : activeCollabs.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Users size={40} className="mx-auto text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Aucun collaborateur dans votre équipe.</p>
          <p className="text-xs text-muted-foreground">Invitez des membres pour gérer votre boutique ensemble.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCollabs.map((collab) => (
            <div key={collab.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {collab.is_kyc_verified ? (
                    <ShieldCheck size={14} className="text-emerald-500" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {collab.profile_name || collab.profile_email || "Utilisateur"}
                  </p>
                  <div className="flex items-center gap-2">
                    {collab.profile_email && (
                      <span className="text-xs text-muted-foreground truncate">{collab.profile_email}</span>
                    )}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      collab.status === "active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {collab.status === "active" ? "Actif" : collab.status === "pending" ? "En attente" : collab.status}
                    </span>
                    {!collab.is_kyc_verified && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        KYC manquant
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeCollaborator.mutate(collab.id)}
                  disabled={removeCollaborator.isPending}
                  className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Retirer"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Inline permissions */}
              <div className="flex flex-wrap gap-1.5 pl-12">
                {AVAILABLE_PERMISSIONS.map((perm) => {
                  const active = (collab.permissions || ["orders"]).includes(perm.value);
                  return (
                    <button
                      key={perm.value}
                      onClick={() => toggleCollabPermission(collab, perm.value)}
                      disabled={updatePermissions.isPending}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                        active
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/30"
                      }`}
                    >
                      {perm.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
