import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Smartphone, Loader2, Check } from "lucide-react";

type PaymentMethod = "card" | "mobile_money";

interface SubscriptionCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  subscriptionType: "package" | "service";
  packageId?: string;
  serviceKey?: string;
  storeId?: string;
  onSuccess?: () => void;
}

const MOMO_PROVIDERS = [
  { id: "orange_money", label: "Orange Money" },
  { id: "mpesa", label: "M-Pesa" },
  { id: "airtel_money", label: "Airtel Money" },
  { id: "afrimoney", label: "AfriMoney" },
];

export function SubscriptionCheckoutDialog({
  open,
  onOpenChange,
  itemName,
  price,
  billingCycle,
  subscriptionType,
  packageId,
  serviceKey,
  storeId,
  onSuccess,
}: SubscriptionCheckoutDialogProps) {
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [momoProvider, setMomoProvider] = useState("orange_money");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState("");

  const handlePay = async () => {
    if (paymentMethod === "mobile_money") {
      const cleanPhone = phone.replace(/[\s\-\+]/g, "");
      if (!cleanPhone || cleanPhone.length < 9) {
        toast({ title: "Numéro invalide", description: "Veuillez entrer un numéro Mobile Money valide.", variant: "destructive" });
        return;
      }
    }

    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("subscribe-payment", {
        body: {
          payment_method: paymentMethod,
          store_id: storeId,
          subscription_type: subscriptionType,
          package_id: packageId,
          service_key: serviceKey,
          billing_cycle: billingCycle,
          amount: price,
          item_name: itemName,
          phone_number: paymentMethod === "mobile_money" ? phone.replace(/[\s\-\+]/g, "") : undefined,
          provider: paymentMethod === "mobile_money" ? momoProvider : undefined,
        },
      });

      if (error || !data?.success) {
        toast({
          title: "Paiement refusé",
          description: data?.error || error?.message || "Erreur lors du paiement.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      if (paymentMethod === "card" && data.redirect_url) {
        // Redirect to card payment page
        window.location.href = data.redirect_url;
        return;
      }

      if (paymentMethod === "mobile_money") {
        // MoMo: wait for PIN validation
        setReference(data.reference);
        setPending(true);
        setProcessing(false);

        // Poll for payment status
        pollPaymentStatus(data.payment_id);
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      setProcessing(false);
    }
  };

  const pollPaymentStatus = async (paymentId: string) => {
    let attempts = 0;
    const maxAttempts = 90; // 3 minutes

    const interval = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPending(false);
        toast({ title: "Délai dépassé", description: "Le paiement n'a pas été confirmé à temps. Réessayez.", variant: "destructive" });
        return;
      }

      try {
        const { data } = await (supabase as any)
          .from("subscription_payments")
          .select("status")
          .eq("id", paymentId)
          .maybeSingle();

        if (data?.status === "success") {
          clearInterval(interval);
          setPending(false);
          toast({ title: "Paiement confirmé !", description: `Votre abonnement ${itemName} est activé.` });
          onSuccess?.();
          onOpenChange(false);
        } else if (data?.status === "failed") {
          clearInterval(interval);
          setPending(false);
          toast({ title: "Paiement échoué", description: "Le paiement a été refusé. Réessayez.", variant: "destructive" });
        }
      } catch {}
    }, 2000);
  };

  const handleCancel = () => {
    setPending(false);
    setProcessing(false);
    setReference("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!processing && !pending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Souscrire à {itemName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-muted rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{itemName}</span>
              <span className="font-bold text-foreground">${price}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Cycle : {billingCycle === "yearly" ? "Annuel" : "Mensuel"}
            </div>
          </div>

          {!pending && (
            <>
              {/* Payment method selection */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Méthode de paiement</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("mobile_money")}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-xs font-medium ${
                      paymentMethod === "mobile_money"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <Smartphone size={16} />
                    Mobile Money
                  </button>
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-xs font-medium ${
                      paymentMethod === "card"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <CreditCard size={16} />
                    Carte bancaire
                  </button>
                </div>
              </div>

              {/* Mobile Money form */}
              {paymentMethod === "mobile_money" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Opérateur</label>
                    <select
                      value={momoProvider}
                      onChange={(e) => setMomoProvider(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {MOMO_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Numéro Mobile Money</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0850000000"
                      className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={processing}
                className="w-full py-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    Payer ${price}
                  </>
                )}
              </button>

              <p className="text-[10px] text-muted-foreground text-center">
                Le paiement hors plateforme et le paiement à la livraison ne sont pas disponibles pour les abonnements.
              </p>
            </>
          )}

          {/* Pending state (Mobile Money) */}
          {pending && (
            <div className="text-center space-y-3 py-4">
              <Loader2 size={32} className="animate-spin mx-auto text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">En attente de confirmation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Validez le paiement sur votre téléphone ({momoProvider.replace("_", " ")}).
                </p>
                {reference && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Réf: <span className="font-mono text-foreground">{reference}</span>
                  </p>
                )}
              </div>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
