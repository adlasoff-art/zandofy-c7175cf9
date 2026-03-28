import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, Phone, CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const PROVIDERS = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "airtel", label: "Airtel Money" },
  { value: "orange", label: "Orange Money" },
  { value: "afrimoney", label: "AfriMoney" },
];

interface ShippingPaymentModalProps {
  orderId: string;
  orderRef: string;
  amount: number;
  paymentType: "shipping" | "last_mile";
  onClose: () => void;
  onSuccess: () => void;
}

export function ShippingPaymentModal({ orderId, orderRef, amount, paymentType, onClose, onSuccess }: ShippingPaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [provider, setProvider] = useState("mpesa");
  const [submitting, setSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const referenceRef = useRef<string | null>(null);

  // Load saved default payment method
  useEffect(() => {
    async function loadDefault() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from("payment_methods")
        .select("phone_number, provider")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle();
      if (data) {
        setPhoneNumber(data.phone_number);
        setProvider(data.provider);
      }
    }
    loadDefault();
  }, []);

  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const label = paymentType === "shipping" ? "Frais d'expédition" : "Frais de livraison à domicile";
  const statusField = paymentType === "shipping" ? "shipping_payment_status" : "last_mile_payment_status";

  const startPolling = (reference: string) => {
    referenceRef.current = reference;
    let attempts = 0;

    pollInterval.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        if (pollInterval.current) clearInterval(pollInterval.current);
        setPaymentStatus("failed");
        toast.error("Délai de paiement expiré");
        return;
      }
      try {
        // Strategy 1: Check local DB first (callback may have already updated)
        const { data: txData } = await (supabase as any)
          .from("payment_transactions")
          .select("status")
          .eq("reference", reference)
          .maybeSingle();

        if (txData?.status === "success") {
          if (pollInterval.current) clearInterval(pollInterval.current);
          await (supabase as any)
            .from("orders")
            .update({ [statusField]: "paid" })
            .eq("id", orderId);
          setPaymentStatus("success");
          toast.success(`${label} payés avec succès !`);
          setTimeout(() => onSuccess(), 1500);
          return;
        }

        if (txData?.status === "failed") {
          if (pollInterval.current) clearInterval(pollInterval.current);
          setPaymentStatus("failed");
          toast.error("Paiement échoué");
          return;
        }

        // Strategy 2: Every 3rd attempt, also check with KelPay API via edge function
        if (attempts % 3 === 0) {
          const checkRes = await supabase.functions.invoke("kelpay-check", {
            body: { reference },
          });

          if (checkRes.data?.status === "success") {
            if (pollInterval.current) clearInterval(pollInterval.current);
            await (supabase as any)
              .from("orders")
              .update({ [statusField]: "paid" })
              .eq("id", orderId);
            setPaymentStatus("success");
            toast.success(`${label} payés avec succès !`);
            setTimeout(() => onSuccess(), 1500);
            return;
          }

          if (checkRes.data?.status === "failed") {
            if (pollInterval.current) clearInterval(pollInterval.current);
            setPaymentStatus("failed");
            toast.error("Paiement échoué");
            return;
          }
        }
      } catch {
        // silently retry
      }
    }, 4000);
  };

  const handleSubmit = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Veuillez entrer un numéro de téléphone");
      return;
    }
    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke("kelpay-payment", {
        body: {
          order_id: orderId,
          phone_number: phoneNumber.trim(),
          amount,
          currency: "USD",
          provider,
          payment_type: paymentType,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      setPaymentStatus("pending");
      toast.success(res.data.message || "Confirmez le paiement sur votre téléphone");

      const reference = res.data.reference;
      startPolling(reference);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du paiement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            Payer {label.toLowerCase()}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <p className="text-sm text-muted-foreground">Montant à payer</p>
          <p className="text-2xl font-bold text-primary">${amount.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Commande {orderRef}</p>
        </div>

        {paymentStatus === "success" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 size={48} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Paiement confirmé !</p>
          </div>
        ) : paymentStatus === "pending" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm text-foreground font-medium">En attente de confirmation...</p>
            <p className="text-xs text-muted-foreground">Validez le paiement sur votre téléphone</p>
            <p className="text-[10px] text-muted-foreground mt-2">
              Vérification automatique en cours. Si le paiement est déjà confirmé, 
              la page se mettra à jour sous peu.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Opérateur</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setProvider(p.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        provider === p.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Numéro de téléphone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="Ex: 0991234567"
                    className="pl-9"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary rounded"
              />
              <span className="text-[11px] text-muted-foreground leading-tight">
                J'accepte les{" "}
                <Link to="/terms" target="_blank" className="text-primary underline hover:text-primary/80">
                  Conditions Générales de Vente
                </Link>.
              </span>
            </label>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !phoneNumber.trim() || !termsAccepted}
              className="w-full gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              Payer ${amount.toFixed(2)}
            </Button>

            {paymentStatus === "failed" && (
              <p className="text-xs text-destructive text-center">
                Le paiement a échoué. Veuillez réessayer.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
