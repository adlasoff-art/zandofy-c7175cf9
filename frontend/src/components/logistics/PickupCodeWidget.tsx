import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";

/**
 * Widget pickup_code (Phase 10.5)
 *
 * - mode="hub" : affiche le code à 6 chiffres aux staff hub/admin afin qu'ils
 *   le communiquent au livreur lors du retrait du colis.
 * - mode="rider" : permet au livreur assigné de saisir le code reçu et
 *   confirmer la prise en charge (passage statut → picked_up_by_operator).
 *
 * Sécurité : appuyé sur les RPC `get_pickup_code_for_order` et
 * `verify_order_pickup_code` (SECURITY DEFINER, contrôle des rôles serveur).
 */
export function PickupCodeWidget({
  orderId,
  mode,
}: {
  orderId: string;
  mode: "hub" | "rider";
}) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const { data: pickupCode, isLoading } = useQuery({
    queryKey: ["pickup-code", orderId],
    enabled: mode === "hub",
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_pickup_code_for_order",
        { _order_id: orderId },
      );
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    staleTime: 30_000,
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (code.length !== 6) throw new Error("Le code doit contenir 6 chiffres");
      const { data, error } = await (supabase as any).rpc(
        "verify_order_pickup_code",
        { _order_id: orderId, _code: code.trim() },
      );
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res?.ok) {
        const msg =
          res?.error === "invalid_code"
            ? "Code incorrect"
            : res?.error === "not_authorized"
              ? "Vous n'êtes pas autorisé à valider ce retrait"
              : res?.error === "no_code"
                ? "Aucun code généré pour cette commande"
                : "Vérification impossible";
        throw new Error(msg);
      }
      return res;
    },
    onSuccess: () => {
      toast({ title: "Retrait confirmé", description: "Vous avez pris le colis en charge." });
      setCode("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["rider-orders"] });
    },
    onError: (e: any) =>
      toast({ title: "Échec", description: e.message, variant: "destructive" }),
  });

  if (mode === "hub") {
    return (
      <Card className="border-primary/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="text-primary" size={16} />
            Code de remise au livreur
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="animate-spin text-muted-foreground" size={16} />
          ) : pickupCode ? (
            <div className="space-y-1">
              <p className="text-3xl font-mono font-bold tracking-widest text-foreground">
                {pickupCode}
              </p>
              <p className="text-xs text-muted-foreground">
                Communiquez ce code au livreur. Il doit le saisir pour valider la prise en charge.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Code non encore généré (en attente d'arrivée au hub).
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="text-primary" size={16} />
          Confirmer la prise en charge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Demandez le code de remise au staff du hub puis saisissez-le ci-dessous.
        </p>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="font-mono text-lg tracking-widest"
          />
          <Button
            onClick={() => verify.mutate()}
            disabled={verify.isPending || code.length !== 6}
          >
            {verify.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
            Valider
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PickupCodeWidget;