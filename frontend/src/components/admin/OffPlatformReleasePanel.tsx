import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DeliveryProofImage } from "@/components/DeliveryProofImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerOrderStatusNotification } from "@/services/order-notifications";
import {
  canAdminReleaseOffPlatform,
  isOffPlatformAwaitingAdminRelease,
  isOffPlatformAwaitingPayment,
  type OffPlatformOrderFields,
} from "@/lib/off-platform-payment";

type Props = {
  order: OffPlatformOrderFields & {
    id: string;
    order_ref?: string;
    total?: number;
  };
  userId: string;
  disabled?: boolean;
  onUpdated: () => void;
};

export function OffPlatformReleasePanel({ order, userId, disabled, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [overrideWithoutVendor, setOverrideWithoutVendor] = useState(false);

  if (!isOffPlatformAwaitingPayment(order)) {
    return null;
  }

  const awaitingAdmin = isOffPlatformAwaitingAdminRelease(order);
  const canRelease = canAdminReleaseOffPlatform(order, overrideWithoutVendor);
  const alreadyReleased = !!order.off_platform_admin_released_at;

  const openProof = async () => {
    if (!order.shipping_payment_proof_url) return;
    const { getDeliveryProofUrl } = await import("@/lib/delivery-proof-urls");
    const u = await getDeliveryProofUrl(order.shipping_payment_proof_url);
    if (u) window.open(u, "_blank");
  };

  const releaseOrder = async () => {
    if (!canRelease || alreadyReleased) return;
    if (
      !order.off_platform_vendor_verified_at &&
      overrideWithoutVendor &&
      !confirm(
        "Libérer sans validation vendeur ? Réservé aux litiges ou vendeur injoignable.",
      )
    ) {
      return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("orders")
      .update({
        status: "pending",
        shipping_payment_status: "paid",
        off_platform_admin_released_at: now,
        off_platform_admin_released_by: userId,
      } as any)
      .eq("id", order.id);

    if (error) {
      toast.error("Impossible de libérer la commande.");
      setBusy(false);
      return;
    }

    if (overrideWithoutVendor && !order.off_platform_vendor_verified_at) {
      await supabase.from("order_status_history").insert({
        order_id: order.id,
        status: "awaiting_payment",
        notes: "Admin : libération sans validation vendeur (override)",
        changed_by: userId,
      });
    }

    toast.success("Commande libérée — le vendeur peut traiter la logistique.");
    triggerOrderStatusNotification(order.id, "pending");
    onUpdated();
    setBusy(false);
  };

  const rejectOrder = async () => {
    if (!confirm("Refuser le paiement hors plateforme pour cette commande ?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "payment_failed" } as any)
      .eq("id", order.id);
    if (error) {
      toast.error("Erreur lors du refus.");
    } else {
      toast.error("Paiement refusé.");
      onUpdated();
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2 border border-violet-200 dark:border-violet-800 rounded-lg p-3 bg-violet-50 dark:bg-violet-900/20">
      <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
        Hors plateforme — validation administrateur
      </p>

      {order.shipping_payment_proof_url ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Preuve de paiement client :</p>
          <DeliveryProofImage
            pathOrUrl={order.shipping_payment_proof_url}
            alt="Preuve de paiement"
            className="w-full max-w-xs rounded-lg border border-border object-cover cursor-pointer"
            onClick={openProof}
          />
        </div>
      ) : (
        <p className="text-xs text-amber-700">Aucune preuve uploadée par le client.</p>
      )}

      {order.off_platform_vendor_verified_at && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Preuve validée par le vendeur le{" "}
          {format(new Date(order.off_platform_vendor_verified_at), "d MMM yyyy à HH:mm", {
            locale: fr,
          })}
        </p>
      )}

      {awaitingAdmin && !alreadyReleased && (
        <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
          Prête à libérer — contrôle final administrateur requis.
        </p>
      )}

      {!order.off_platform_vendor_verified_at && !alreadyReleased && (
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <Checkbox
            checked={overrideWithoutVendor}
            onCheckedChange={(v) => setOverrideWithoutVendor(!!v)}
          />
          <span>Libérer sans validation vendeur (override)</span>
        </label>
      )}

      {!alreadyReleased && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 text-xs gap-1"
            disabled={disabled || busy || !canRelease}
            onClick={releaseOrder}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Libérer la commande
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1 text-xs gap-1"
            disabled={disabled || busy}
            onClick={rejectOrder}
          >
            <X size={12} /> Refuser
          </Button>
        </div>
      )}

      {alreadyReleased && (
        <p className="text-xs text-muted-foreground">Cette commande a déjà été libérée par l&apos;administration.</p>
      )}
    </div>
  );
}
