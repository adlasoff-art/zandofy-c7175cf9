import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, Phone, CheckCircle2, CreditCard, Smartphone, Banknote, Upload, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { compressImage } from "@/utils/image-compress";

const PROVIDERS = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "airtel", label: "Airtel Money" },
  { value: "orange", label: "Orange Money" },
  { value: "afrimoney", label: "AfriMoney" },
];

type PaymentOption = "card" | "mobile_money" | "off_platform";

interface DeferredPaymentModalProps {
  orderId: string;
  orderRef: string;
  amount: number;
  paymentType: "shipping" | "last_mile";
  onClose: () => void;
  onSuccess: () => void;
}

export function DeferredPaymentModal({ orderId, orderRef, amount, paymentType, onClose, onSuccess }: DeferredPaymentModalProps) {
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("mobile_money");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [provider, setProvider] = useState("mpesa");
  const [submitting, setSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const label = paymentType === "shipping" ? "Frais d'expédition" : "Frais de livraison à domicile";
  const statusField = paymentType === "shipping" ? "shipping_payment_status" : "last_mile_payment_status";
  const proofField = paymentType === "shipping" ? "shipping_payment_proof_url" : "last_mile_payment_proof_url";

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

  const startPolling = (reference: string) => {
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
        const { data: txData } = await (supabase as any)
          .from("payment_transactions")
          .select("status")
          .eq("reference", reference)
          .maybeSingle();

        if (txData?.status === "success") {
          if (pollInterval.current) clearInterval(pollInterval.current);
          await (supabase as any).from("orders").update({ [statusField]: "paid" }).eq("id", orderId);
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

        if (attempts % 3 === 0) {
          const checkRes = await supabase.functions.invoke("kelpay-check", { body: { reference } });
          if (checkRes.data?.status === "success") {
            if (pollInterval.current) clearInterval(pollInterval.current);
            await (supabase as any).from("orders").update({ [statusField]: "paid" }).eq("id", orderId);
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

  const handleMobileMoneyPayment = async () => {
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
      startPolling(res.data.reference);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du paiement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardPayment = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("keccel-cardpay", {
        body: {
          order_id: orderId,
          payment_method: "card",
          payment_type: paymentType,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      if (data?.fallback_terminal_url) {
        window.location.href = data.fallback_terminal_url;
        return;
      }
      // If no redirect, assume success
      await (supabase as any).from("orders").update({ [statusField]: "paid" }).eq("id", orderId);
      setPaymentStatus("success");
      toast.success(`${label} payés avec succès !`);
      setTimeout(() => onSuccess(), 1500);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du paiement par carte");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProofUpload = async (file: File) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Fichier trop volumineux (max 10 Mo)");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format non supporté. Utilisez JPG, PNG ou WebP.");
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop() || "jpg";
      const path = `payment-proofs/${orderId}/${proofField}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("delivery-proofs").upload(path, compressed, { upsert: true, cacheControl: "31536000" });
      if (uploadError) {
        const rls = /row-level security|RLS/i.test(uploadError.message);
        toast.error(
          rls
            ? "Envoi du fichier refusé (droits). Reconnectez-vous ou contactez le support."
            : `Échec de l'envoi : ${uploadError.message}`,
        );
        return;
      }
      const { error: updateError } = await supabase.from("orders").update({ [proofField]: path } as any).eq("id", orderId);
      if (updateError) {
        toast.error(`Fichier envoyé mais commande non mise à jour : ${updateError.message}`);
        return;
      }
      setProofUploaded(true);
      toast.success("Preuve de paiement envoyée. En attente de validation.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'upload";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleOffPlatformConfirm = () => {
    toast.success("Commande mise à jour. La preuve de paiement sera validée par le vendeur.");
    setTimeout(() => onSuccess(), 1000);
  };

  const handleSubmit = () => {
    if (paymentOption === "mobile_money") handleMobileMoneyPayment();
    else if (paymentOption === "card") handleCardPayment();
    // off_platform doesn't have a submit — uses proof upload
  };

  const paymentOptions: { id: PaymentOption; label: string; icon: React.ReactNode; sub: string }[] = [
    { id: "card", label: "Carte bancaire", icon: <CreditCard size={16} />, sub: "Visa, Mastercard" },
    { id: "mobile_money", label: "Mobile Money", icon: <Smartphone size={16} />, sub: "M-Pesa, Orange, Airtel" },
    { id: "off_platform", label: "Hors plateforme", icon: <Banknote size={16} />, sub: "Transfert P2P + preuve" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
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
          </div>
        ) : (
          <>
            {/* Payment method selection */}
            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">Mode de paiement</label>
              <div className="grid gap-2">
                {paymentOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPaymentOption(opt.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                      paymentOption === opt.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className={`p-1.5 rounded-md ${paymentOption === opt.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground">{opt.sub}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${paymentOption === opt.id ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                      {paymentOption === opt.id && <div className="w-2 h-2 bg-primary-foreground rounded-full m-auto mt-[2px]" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Money form */}
            {paymentOption === "mobile_money" && (
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
            )}

            {/* Off-platform: proof upload */}
            {paymentOption === "off_platform" && (
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  <p className="font-semibold">📋 Paiement hors plateforme</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Effectuez le paiement du montant exact (${amount.toFixed(2)}) par transfert P2P</li>
                    <li>Prenez une capture d'écran de la transaction</li>
                    <li>Uploadez la preuve ci-dessous</li>
                    <li>Le vendeur validera le paiement</li>
                  </ol>
                </div>

                {proofUploaded ? (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <CheckCircle2 size={32} className="text-primary" />
                    <p className="text-sm font-medium text-foreground">Preuve envoyée !</p>
                    <p className="text-xs text-muted-foreground">En attente de validation par le vendeur.</p>
                    <Button size="sm" onClick={handleOffPlatformConfirm} className="mt-2">
                      Fermer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Preuve de paiement</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleProofUpload(f); e.target.value = ""; }}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleProofUpload(f); e.target.value = ""; }}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 gap-1.5 text-xs"
                      >
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        Importer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex-1 gap-1.5 text-xs"
                      >
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                        Photo
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Capture d'écran avec N° transaction, destinataire, montant et date visibles (JPG, PNG, max 10 Mo)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Card payment info */}
            {paymentOption === "card" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3 text-xs text-blue-700 dark:text-blue-400">
                <p>Vous serez redirigé vers la passerelle de paiement sécurisée pour régler <strong>${amount.toFixed(2)}</strong> par carte bancaire.</p>
              </div>
            )}

            {/* Terms + submit (for card and mobile money only) */}
            {paymentOption !== "off_platform" && (
              <>
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
                  disabled={submitting || !termsAccepted || (paymentOption === "mobile_money" && !phoneNumber.trim())}
                  className="w-full gap-2"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : paymentOption === "card" ? <CreditCard size={14} /> : <Smartphone size={14} />}
                  Payer ${amount.toFixed(2)}
                </Button>
              </>
            )}

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
