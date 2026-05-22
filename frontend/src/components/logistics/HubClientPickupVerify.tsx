import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

interface Props {
  orderId: string;
  orderRef: string;
  onVerified?: () => void;
}

/**
 * H5 — Staff hub validates client pickup at agency (hub_pickup orders).
 * Uses RPC verify_hub_pickup (admin/manager roles).
 */
export function HubClientPickupVerify({ orderId, orderRef, onVerified }: Props) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  const verify = useMutation({
    mutationFn: async () => {
      const trimmed = code.trim();
      if (trimmed.length < 6) throw new Error("Saisissez le code à 6 chiffres du client");
      const { data, error } = await (supabase as any).rpc("verify_hub_pickup", {
        p_order_id: orderId,
        p_code: trimmed,
        p_proof_url: proofUrl.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Colis remis au client", {
        description: `Commande ${orderRef} — livraison confirmée.`,
      });
      setCode("");
      setProofUrl("");
      qc.invalidateQueries({ queryKey: ["shipper-hub-pickups"] });
      qc.invalidateQueries({ queryKey: ["shipper-hub-orders"] });
      onVerified?.();
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? e);
      if (msg.includes("invalid_code")) {
        toast.error("Code incorrect");
      } else if (msg.includes("already_verified")) {
        toast.error("Retrait déjà validé");
      } else if (msg.includes("forbidden")) {
        toast.error("Accès refusé — rôle hub requis");
      } else {
        toast.error(msg || "Vérification impossible");
      }
    },
  });

  return (
    <div className="space-y-2 pt-2 border-t border-border/60">
      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-primary" />
        Retrait client à l&apos;agence
      </p>
      <Input
        placeholder="Code client (6 chiffres)"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="font-mono text-lg tracking-widest"
        inputMode="numeric"
        maxLength={6}
      />
      <Input
        placeholder="URL preuve (photo) — optionnel"
        value={proofUrl}
        onChange={(e) => setProofUrl(e.target.value)}
        className="text-xs"
      />
      <Button
        size="sm"
        className="w-full"
        disabled={verify.isPending || code.length < 6}
        onClick={() => verify.mutate()}
      >
        {verify.isPending ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          "Confirmer remise au client"
        )}
      </Button>
    </div>
  );
}
