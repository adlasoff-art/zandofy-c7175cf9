import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const PROVIDERS = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "airtel", label: "Airtel Money" },
  { value: "orange", label: "Orange Money" },
  { value: "afrimoney", label: "AfriMoney" },
];

interface RetryPaymentModalProps {
  orderId: string;
  orderRef: string;
  amount: number;
  currency?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RetryPaymentModal({ orderId, orderRef, amount, currency = "CDF", onClose, onSuccess }: RetryPaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [provider, setProvider] = useState("mpesa");
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Load saved payment methods
  useEffect(() => {
    async function loadDefault() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

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
          currency,
          provider,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      setReference(res.data.reference);
      setPaymentStatus("pending");
      setPolling(true);
      toast.success(res.data.message || "Confirmez le paiement sur votre téléphone");

      // Start polling
      let attempts = 0;
      pollInterval.current = setInterval(async () => {
        attempts++;
        if (attempts > 60) {
          // 5 minutes max
          if (pollInterval.current) clearInterval(pollInterval.current);
          setPolling(false);
          setPaymentStatus("failed");
          toast.error("Délai de paiement expiré");
          return;
        }

        try {
          const checkRes = await supabase.functions.invoke("kelpay-check", {
            body: { reference: res.data.reference },
          });

          if (checkRes.data?.status === "success") {
            if (pollInterval.current) clearInterval(pollInterval.current);
            setPolling(false);
            setPaymentStatus("success");
            toast.success("Paiement confirmé !");
            setTimeout(() => onSuccess(), 1500);
          } else if (checkRes.data?.status === "failed") {
            if (pollInterval.current) clearInterval(pollInterval.current);
            setPolling(false);
            setPaymentStatus("failed");
            toast.error("Paiement échoué");
          }
        } catch {
          // silently retry
        }
      }, 5000);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la relance du paiement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Relancer le paiement</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="text-sm text-muted-foreground">
          Commande <strong className="text-foreground">{orderRef}</strong> · Montant : <strong className="text-foreground">${amount.toFixed(2)} {currency}</strong>
        </div>

        {paymentStatus === "success" ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-primary" />
            <p className="text-sm font-bold text-foreground">Paiement confirmé !</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Opérateur</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setProvider(p.value)}
                      className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                        provider === p.value
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Numéro de téléphone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="0XXXXXXXXX"
                    className="pl-9"
                    disabled={polling}
                  />
                </div>
              </div>
            </div>

            {polling && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <Loader2 size={14} className="animate-spin" />
                <span>En attente de confirmation sur votre téléphone... {reference && `(Réf: ${reference})`}</span>
              </div>
            )}

            {paymentStatus === "failed" && (
              <p className="text-xs text-destructive text-center">Le paiement a échoué. Vous pouvez réessayer.</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={polling}>
                Annuler
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting || polling}>
                {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                {polling ? "En attente..." : paymentStatus === "failed" ? "Réessayer" : "Payer"}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
