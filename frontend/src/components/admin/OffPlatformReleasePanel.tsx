import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DeliveryProofImage } from "@/components/DeliveryProofImage";
import { PaymentProofUpload } from "@/components/PaymentProofUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerOrderStatusNotification } from "@/services/order-notifications";
import {
  canAdminReleaseOffPlatform,
  isOffPlatformAwaitingAdminRelease,
  isOffPlatformAwaitingPayment,
  isPlatformOwnedStore,
  adminOffPlatformReleaseFields,
  offPlatformProductProofUrl,
  hasOffPlatformPaymentProof,
  type OffPlatformOrderFields,
} from "@/lib/off-platform-payment";

type Props = {
  order: OffPlatformOrderFields & {
    id: string;
    order_ref?: string;
    total?: number;
  };
  userId: string;
  /** Boutique plateforme : double validation. Indépendant : secours admin seulement. */
  isPlatformOwned?: boolean | null;
  disabled?: boolean;
  onUpdated: () => void;
};

export function OffPlatformReleasePanel({
  order,
  userId,
  isPlatformOwned,
  disabled,
  onUpdated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [overrideWithoutVendor, setOverrideWithoutVendor] = useState(false);
  const [localProofPath, setLocalProofPath] = useState<string | null>(null);

  if (!isOffPlatformAwaitingPayment(order)) {
    return null;
  }

  const platformStore = isPlatformOwnedStore(isPlatformOwned);
  const orderWithLocalProof: OffPlatformOrderFields = {
    ...order,
    product_payment_proof_url:
      localProofPath || order.product_payment_proof_url || order.shipping_payment_proof_url,
  };
  const awaitingAdmin = isOffPlatformAwaitingAdminRelease(orderWithLocalProof, isPlatformOwned);
  const canRelease = canAdminReleaseOffPlatform(
    orderWithLocalProof,
    overrideWithoutVendor,
    isPlatformOwned,
  );
  const alreadyReleased = !!order.off_platform_admin_released_at;
  const hasProof = hasOffPlatformPaymentProof(orderWithLocalProof);

  const openProof = async () => {
    const proof = offPlatformProductProofUrl(orderWithLocalProof);
    if (!proof) return;
    const { getDeliveryProofUrl } = await import("@/lib/delivery-proof-urls");
    const u = await getDeliveryProofUrl(proof);
    if (u) window.open(u, "_blank");
  };

  const releaseOrder = async () => {
    if (!canRelease || alreadyReleased) return;
    if (
      !order.off_platform_vendor_verified_at &&
      overrideWithoutVendor &&
      !confirm(
        platformStore
          ? "Libérer sans validation vendeur ? Réservé aux litiges ou vendeur injoignable."
          : "Débloquer cette commande indépendante sans validation vendeur ? Secours administrateur uniquement.",
      )
    ) {
      return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    const payload = adminOffPlatformReleaseFields(
      now,
      userId,
      order.shipping_payment_status,
    );
    const { error } = await supabase
      .from("orders")
      .update(payload as any)
      .eq("id", order.id);

    if (error) {
      toast.error("Impossible de libérer la commande.");
      setBusy(false);
      return;
    }

    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "pending",
      notes:
        overrideWithoutVendor && !order.off_platform_vendor_verified_at
          ? platformStore
            ? "Admin : libération sans validation vendeur (override)"
            : "Admin : secours indépendant sans validation vendeur"
          : platformStore
            ? "Admin : libération hors plateforme"
            : "Admin : secours — déblocage commande indépendante",
      changed_by: userId,
    });

    toast.success(
      platformStore
        ? "Commande libérée — le vendeur peut traiter la logistique."
        : "Commande débloquée — le vendeur peut traiter la logistique.",
    );
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

  const productProof = offPlatformProductProofUrl(orderWithLocalProof);
  const proofBlock = productProof ? (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Preuve de paiement :</p>
      <DeliveryProofImage
        pathOrUrl={productProof}
        alt="Preuve de paiement"
        className="w-full max-w-xs rounded-lg border border-border object-cover cursor-pointer"
        onClick={openProof}
      />
    </div>
  ) : (
    <div className="space-y-2">
      <p className="text-xs text-amber-700">Aucune preuve enregistrée — joindre une preuve pour débloquer.</p>
      <PaymentProofUpload
        orderId={order.id}
        field="product_payment_proof_url"
        label="Joindre la preuve (secours admin)"
        existingUrl={null}
        onUploaded={(path) => {
          setLocalProofPath(path);
          onUpdated();
        }}
      />
    </div>
  );

  const vendorVerifiedBlock = order.off_platform_vendor_verified_at ? (
    <p className="text-xs text-emerald-700 dark:text-emerald-400">
      Preuve validée par le vendeur le{" "}
      {format(new Date(order.off_platform_vendor_verified_at), "d MMM yyyy à HH:mm", {
        locale: fr,
      })}
    </p>
  ) : (
    <p className="text-xs text-muted-foreground">En attente de la validation vendeur.</p>
  );

  const actionButtons = !alreadyReleased && (
    <div className="flex gap-2">
      <Button
        size="sm"
        className="flex-1 text-xs gap-1"
        disabled={disabled || busy || !canRelease}
        onClick={releaseOrder}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        {platformStore ? "Libérer la commande" : "Débloquer la commande"}
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
  );

  const overrideCheckbox = !order.off_platform_vendor_verified_at && !alreadyReleased && hasProof && (
    <label className="flex items-start gap-2 text-xs cursor-pointer">
      <Checkbox
        checked={overrideWithoutVendor}
        onCheckedChange={(v) => setOverrideWithoutVendor(!!v)}
      />
      <span>
        {platformStore
          ? "Libérer sans validation vendeur (override)"
          : "Débloquer sans validation vendeur (secours)"}
      </span>
    </label>
  );

  // Boutique non-plateforme (ou flag inconnu) : secours admin — pas un frein obligatoire
  if (!platformStore) {
    return (
      <div className="space-y-2 border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
          Hors plateforme — secours administrateur (vendeur autonome)
        </p>
        <p className="text-xs text-muted-foreground">
          Le vendeur confirme normalement seul. Utilisez ce panneau uniquement si la commande
          reste bloquée (client payé sans suite).
        </p>
        {proofBlock}
        {vendorVerifiedBlock}
        {overrideCheckbox}
        {actionButtons}
        {alreadyReleased && (
          <p className="text-xs text-muted-foreground">
            Cette commande a déjà été débloquée par l&apos;administration.
          </p>
        )}
      </div>
    );
  }

  // Boutique plateforme : double validation
  return (
    <div className="space-y-2 border border-violet-200 dark:border-violet-800 rounded-lg p-3 bg-violet-50 dark:bg-violet-900/20">
      <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
        Hors plateforme — validation administrateur
      </p>

      {proofBlock}

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

      {overrideCheckbox}
      {actionButtons}

      {alreadyReleased && (
        <p className="text-xs text-muted-foreground">
          Cette commande a déjà été libérée par l&apos;administration.
        </p>
      )}
    </div>
  );
}
