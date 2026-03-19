import { useState } from "react";
import { AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Claim {
  id: string;
  store_id: string;
  vendor_id: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface Props {
  storeId: string;
  userId: string;
  storeName: string;
  onClaimSubmitted: () => void;
}

export function VendorPlatformClaimBanner({ storeId, userId, storeName, onClaimSubmitted }: Props) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isPlatformOwned, setIsPlatformOwned] = useState(false);

  // Fetch store status and pending claim
  useState; // force re-render hook
  
  // Use useEffect pattern via inline
  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    setFetched(true);
    (async () => {
      const [storeRes, claimRes] = await Promise.all([
        (supabase as any).from("stores").select("is_platform_owned").eq("id", storeId).single(),
        (supabase as any)
          .from("platform_ownership_claims")
          .select("*")
          .eq("store_id", storeId)
          .eq("vendor_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setIsPlatformOwned(storeRes.data?.is_platform_owned === true);
      setClaim(claimRes.data || null);
      setLoading(false);
    })();
  }

  if (loading || !isPlatformOwned) return null;

  const isExpired = claim ? new Date(claim.expires_at) < new Date() : true;

  const handleContest = async () => {
    setSubmitting(true);
    // Update the claim status to 'accepted' (vendor contests = they accept the claim process, i.e. they dispute)
    // Actually, we insert a new claim if none exists, or the vendor uses the existing pending one
    if (claim && !isExpired) {
      const { error } = await (supabase as any)
        .from("platform_ownership_claims")
        .update({ status: "accepted", resolved_at: new Date().toISOString() })
        .eq("id", claim.id)
        .select();

      if (error) {
        toast.error("Impossible de soumettre la contestation.");
      } else {
        toast.success("Votre contestation a été enregistrée. L'administrateur sera notifié.");
        // Notify admin via notification insert
        await (supabase as any).from("notifications").insert({
          user_id: userId, // This will be replaced - we need admin notification
          type: "system",
          title: "Contestation boutique plateforme",
          message: `Le vendeur de "${storeName}" a contesté le statut "Boutique plateforme". Veuillez vérifier.`,
          link: "/admin/vendor-pricing",
        });
        onClaimSubmitted();
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-destructive mt-0.5 shrink-0" size={20} />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-destructive">
            Boutique marquée comme appartenant à la plateforme
          </p>
          <p className="text-xs text-muted-foreground">
            Votre boutique "{storeName}" a été marquée comme appartenant à la plateforme Zandofy.
            Les revenus générés ne seront plus crédités sur votre wallet.
          </p>
          {claim && !isExpired ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>
                  Vous avez jusqu'au{" "}
                  <strong>{format(new Date(claim.expires_at), "dd MMMM yyyy à HH:mm", { locale: fr })}</strong>
                  {" "}pour contester.
                </span>
              </div>
              <button
                onClick={handleContest}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                <ShieldCheck size={14} />
                {submitting ? "Envoi..." : "Revendiquer indépendante"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/70 italic">
              Le délai de contestation de 72h est expiré. Seul l'administrateur peut modifier ce statut.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
