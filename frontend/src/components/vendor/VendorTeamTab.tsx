import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVendorSubscription } from "@/hooks/use-vendor-subscription";
import { VENDOR_TIERS } from "@/lib/vendor-tiers";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, Loader2, Mail, Shield, Clock } from "lucide-react";

interface Collaborator {
  id: string;
  user_id: string;
  role: string;
  invited_email: string | null;
  status: string;
  created_at: string;
  profile_email?: string;
  profile_name?: string;
}

interface Props {
  storeId: string;
}

export function VendorTeamTab({ storeId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { subscription } = useVendorSubscription(storeId);
  const [email, setEmail] = useState("");

  // Get store max_collaborators_override
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

      // Enrich with profile info
      const userIds = data.map((c: any) => c.user_id).filter(Boolean);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, email, first_name, last_name").in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return data.map((c: any) => {
        const profile = profileMap.get(c.user_id);
        return {
          ...c,
          profile_email: profile?.email || c.invited_email,
          profile_name: profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : null,
        } as Collaborator;
      });
    },
  });

  const addCollaborator = useMutation({
    mutationFn: async (inviteEmail: string) => {
      // Check limit
      const activeCount = collaborators.filter((c) => c.status !== "removed").length;
      if (activeCount >= maxCollaborators) {
        throw new Error(`Limite de ${maxCollaborators} collaborateurs atteinte.`);
      }

      // Find user by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inviteEmail.toLowerCase().trim())
        .maybeSingle();

      if (!profile) {
        throw new Error("Aucun utilisateur trouvé avec cet email.");
      }

      if (profile.id === user?.id) {
        throw new Error("Vous ne pouvez pas vous ajouter vous-même.");
      }

      const { error } = await (supabase as any).from("store_collaborators").insert({
        store_id: storeId,
        user_id: profile.id,
        invited_email: inviteEmail.toLowerCase().trim(),
        status: "active",
        role: "member",
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
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  const removeCollaborator = useMutation({
    mutationFn: async (collabId: string) => {
      const { error } = await supabase
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

  const activeCollabs = collaborators.filter((c) => c.status !== "removed");

  return (
    <div className="space-y-6">
      {/* Header */}
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
                if (e.key === "Enter" && email.trim()) {
                  addCollaborator.mutate(email);
                }
              }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => email.trim() && addCollaborator.mutate(email)}
            disabled={!email.trim() || addCollaborator.isPending || activeCollabs.length >= maxCollaborators}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {addCollaborator.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserPlus size={14} />
            )}
            Ajouter
          </button>
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
        <div className="space-y-2">
          {activeCollabs.map((collab) => (
            <div
              key={collab.id}
              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Shield size={14} className="text-muted-foreground" />
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
          ))}
        </div>
      )}
    </div>
  );
}
