import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/utils/image-compress";
import { Loader2, Truck, User, DollarSign, Hash, Edit2, Globe, Link as LinkIcon, Camera, CheckCircle2, ShieldCheck, Package } from "lucide-react";

export function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

interface SupplierPlatform {
  id: string;
  name: string;
}

/** Modal: confirmed → preparing — requires supplier platform, supplier order number, supplier link */
export function SupplierInfoModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (platformId: string, supplierOrderNumber: string, supplierLink: string, trackingNumber: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [platforms, setPlatforms] = useState<SupplierPlatform[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [supplierOrderNumber, setSupplierOrderNumber] = useState("");
  const [supplierLink, setSupplierLink] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from("supplier_platforms")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setPlatforms((data as SupplierPlatform[]) || []);
      setLoadingPlatforms(false);
    }
    load();
  }, []);

  const canSubmit = selectedPlatform && supplierOrderNumber.trim().length > 0 && supplierLink.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card rounded-xl w-full max-w-sm p-5 space-y-4 border border-border max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Globe size={16} className="text-primary" /> Informations fournisseur
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Renseignez les détails de la commande fournisseur avant de passer en préparation.
        </p>

        {/* Supplier platform — required */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            Plateforme fournisseur <span className="text-destructive">*</span>
          </label>
          {loadingPlatforms ? (
            <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-primary" /></div>
          ) : (
            <select
              value={selectedPlatform}
              onChange={e => setSelectedPlatform(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">-- Sélectionner --</option>
              {platforms.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Supplier order number — required */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            N° de commande fournisseur <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={supplierOrderNumber}
            onChange={e => setSupplierOrderNumber(e.target.value)}
            placeholder="Ex: 73829461023847"
            maxLength={200}
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ fontSize: "16px" }}
          />
        </div>

        {/* Supplier link — required */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block flex items-center gap-1">
            <LinkIcon size={12} /> Lien boutique fournisseur <span className="text-destructive">*</span>
          </label>
          <input
            type="url"
            value={supplierLink}
            onChange={e => setSupplierLink(e.target.value)}
            placeholder="https://..."
            maxLength={500}
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ fontSize: "16px" }}
          />
        </div>

        {/* Tracking number — optional */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            N° de suivi (tracking) <span className="text-muted-foreground text-[10px]">(optionnel)</span>
          </label>
          <input
            type="text"
            value={trackingNumber}
            onChange={e => setTrackingNumber(e.target.value)}
            placeholder="Ex: AWB-2026-001234"
            maxLength={200}
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ fontSize: "16px" }}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(selectedPlatform, supplierOrderNumber.trim(), supplierLink.trim(), trackingNumber.trim())}
            disabled={loading || !canSubmit}
            className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal: in_shipping → shipped — requires tracking number + delivery fee */
export function ShippedTransitionModal({
  onConfirm,
  onCancel,
  loading,
  currentTrackingNumber,
  hasSelfDelivery,
}: {
  onConfirm: (trackingNumber: string, deliveryFee: number) => void;
  onCancel: () => void;
  loading: boolean;
  currentTrackingNumber: string | null;
  hasSelfDelivery: boolean;
}) {
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber || "");
  const [deliveryFee, setDeliveryFee] = useState("");

  const canSubmit = trackingNumber.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card rounded-xl w-full max-w-sm p-5 space-y-4 border border-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Truck size={16} className="text-primary" /> Arrivée au Hub
        </h3>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            N° de suivi (tracking) <span className="text-destructive">*</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Le numéro de suivi est obligatoire pour passer à l'étape Hub.
          </p>
          <input
            type="text"
            value={trackingNumber}
            onChange={e => setTrackingNumber(e.target.value)}
            placeholder="Ex: AWB-2026-001234"
            maxLength={200}
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
            style={{ fontSize: "16px" }}
          />
        </div>

        {hasSelfDelivery && (
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block flex items-center gap-1">
              <DollarSign size={12} /> Frais de livraison à domicile
            </label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Ce montant sera proposé au client. Il pourra choisir entre livraison à domicile ou retrait au Hub.
            </p>
            <input
              type="number"
              value={deliveryFee}
              onChange={e => setDeliveryFee(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ fontSize: "16px" }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(trackingNumber.trim(), parseFloat(deliveryFee || "0"))}
            disabled={loading || !canSubmit}
            className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal: edit tracking number and supplier order number without changing order status */
export function EditTrackingModal({
  currentTracking,
  currentSupplierOrder,
  onConfirm,
  onCancel,
  loading,
}: {
  currentTracking: string;
  currentSupplierOrder: string;
  onConfirm: (trackingNumber: string, supplierOrderNumber: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [trackingValue, setTrackingValue] = useState(currentTracking);
  const [supplierOrderValue, setSupplierOrderValue] = useState(currentSupplierOrder);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card rounded-xl w-full max-w-sm p-5 space-y-4 border border-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Edit2 size={16} className="text-primary" /> Modifier les informations de suivi
        </h3>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            N° de commande fournisseur
          </label>
          <input
            type="text"
            value={supplierOrderValue}
            onChange={e => setSupplierOrderValue(e.target.value)}
            placeholder="Ex: 73829461023847"
            maxLength={200}
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
            style={{ fontSize: "16px" }}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            N° de suivi (tracking)
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            AWB ou numéro de tracking du transporteur. Indispensable pour le suivi client.
          </p>
          <input
            type="text"
            value={trackingValue}
            onChange={e => setTrackingValue(e.target.value)}
            placeholder="Ex: AWB-2026-001234"
            maxLength={200}
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ fontSize: "16px" }}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(trackingValue.trim(), supplierOrderValue.trim())}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

interface RiderOption {
  id: string;
  name: string;
  email: string;
}

/** Modal: assign rider + set delivery fee when advancing shipped → assigning_rider */
export function RiderAssignmentModal({
  onConfirm,
  onCancel,
  loading,
  showDeliveryFee,
}: {
  onConfirm: (riderId: string, riderName: string, deliveryFee: number, paymentMethod: string, confirmationCode: string) => void;
  onCancel: () => void;
  loading: boolean;
  showDeliveryFee: boolean;
}) {
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [selectedRider, setSelectedRider] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  useEffect(() => {
    async function fetchRiders() {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "rider");

      if (!roleData || roleData.length === 0) {
        setLoadingRiders(false);
        return;
      }

      const userIds = roleData.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      setRiders(
        (profiles || []).map(p => ({
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Livreur",
          email: p.email || "",
        }))
      );
      setLoadingRiders(false);
    }
    fetchRiders();
  }, []);

  const selectedRiderObj = riders.find(r => r.id === selectedRider);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card rounded-xl w-full max-w-sm p-5 space-y-4 border border-border max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <User size={16} className="text-primary" /> Assigner un livreur
        </h3>

        {loadingRiders ? (
          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-primary" /></div>
        ) : riders.length === 0 ? (
          <p className="text-xs text-destructive">Aucun livreur disponible. Ajoutez le rôle "rider" à un utilisateur.</p>
        ) : (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sélectionner un livreur</label>
              <select
                value={selectedRider}
                onChange={e => setSelectedRider(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">-- Choisir --</option>
                {riders.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.email})</option>
                ))}
              </select>
            </div>

            {showDeliveryFee && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                    <DollarSign size={12} /> Frais de livraison à domicile
                  </label>
                  <input
                    type="number"
                    value={deliveryFee}
                    onChange={e => setDeliveryFee(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mode de paiement livraison</label>
                  <div className="flex gap-2">
                    {[
                      { key: "cash", label: "Cash" },
                      { key: "mobile_money", label: "Mobile Money" },
                    ].map(m => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setPaymentMethod(m.key)}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          paymentMethod === m.key
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-foreground border-border hover:border-primary"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">
            Annuler
          </button>
          <button
            onClick={() => {
              if (!selectedRiderObj) return;
              const code = generateConfirmationCode();
              onConfirm(
                selectedRiderObj.id,
                selectedRiderObj.name,
                showDeliveryFee ? parseFloat(deliveryFee || "0") : 0,
                paymentMethod,
                code
              );
            }}
            disabled={loading || !selectedRider}
            className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />}
            Assigner
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal: vendor sets delivery fee before advancing to "shipped" (hub arrival) for self-delivery stores */
export function DeliveryFeeModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (fee: number) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [fee, setFee] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card rounded-xl w-full max-w-sm p-5 space-y-4 border border-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <DollarSign size={16} className="text-primary" /> Frais de livraison à domicile
        </h3>
        <p className="text-xs text-muted-foreground">
          Définissez le montant des frais de livraison à domicile. Le client verra ce montant et pourra choisir entre la livraison à domicile ou la récupération au Hub.
        </p>
        <input
          type="number"
          value={fee}
          onChange={e => setFee(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
          className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          autoFocus
          style={{ fontSize: "16px" }}
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(parseFloat(fee || "0"))}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal: hub pickup — vendor verifies confirmation code server-side and marks as delivered */
export function HubPickupModal({
  orderRef,
  orderId,
  shippingPaymentStatus,
  shippingCost,
  onConfirm,
  onCancel,
  loading,
}: {
  orderRef: string;
  orderId: string;
  shippingPaymentStatus: string | null;
  shippingCost: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [inputCode, setInputCode] = useState("");
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!inputCode.trim()) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-confirmation-code", {
        body: { order_id: orderId, code: inputCode.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        setCodeValid(false);
        setErrorMsg(data.retry_after
          ? `Trop de tentatives. Réessayez dans ${data.retry_after}s.`
          : data.error);
      } else if (data?.success) {
        setCodeValid(true);
      }
    } catch (e: any) {
      setCodeValid(false);
      setErrorMsg(e.message || "Erreur de vérification");
    } finally {
      setVerifying(false);
    }
  };

  const shippingPaid = shippingPaymentStatus === "paid" || shippingCost === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card rounded-xl w-full max-w-sm p-5 space-y-4 border border-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" /> Retrait au Hub — {orderRef}
        </h3>

        <p className="text-[11px] text-muted-foreground">
          Demandez le code de confirmation au client pour vérifier son identité avant de remettre le colis.
        </p>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            Code de confirmation du client
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={e => {
                setInputCode(e.target.value.toUpperCase());
                setCodeValid(null);
                setErrorMsg(null);
              }}
              placeholder="Ex: ABC123"
              maxLength={10}
              className="flex-1 px-3 py-2.5 text-sm font-mono tracking-widest bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
              autoFocus
              style={{ fontSize: "16px" }}
            />
            <button
              onClick={handleVerify}
              disabled={!inputCode.trim() || verifying}
              className="px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              {verifying ? <Loader2 size={14} className="animate-spin" /> : "Vérifier"}
            </button>
          </div>
          {codeValid === false && errorMsg && (
            <p className="text-xs text-destructive mt-1">❌ {errorMsg}</p>
          )}
          {codeValid === true && (
            <p className="text-xs text-primary mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Code vérifié — commande marquée comme livrée !
            </p>
          )}
        </div>

        {!shippingPaid && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            ⚠️ L'expédition (${shippingCost.toFixed(2)}) n'a pas encore été payée. 
            Assurez-vous que le client a effectué le paiement ou ajoutez la preuve de paiement manuellement.
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">
            {codeValid ? "Fermer" : "Annuler"}
          </button>
          {codeValid && (
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Hub proof photo upload inline component for vendor */
export function HubProofPhotoUpload({
  orderId,
  existingUrl,
  onUploaded,
}: {
  orderId: string;
  existingUrl: string | null;
  onUploaded?: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | null>(existingUrl);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = "webp";
      const path = `hub-proofs/${orderId}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("delivery-proofs")
        .upload(path, compressed, { contentType: "image/webp", upsert: true });
      if (uploadError) throw uploadError;

      // Bucket privé : on stocke le path en DB.
      await (supabase as any)
        .from("orders")
        .update({ hub_pickup_proof_url: path })
        .eq("id", orderId);

      setUrl(path);
      onUploaded?.(path);
    } catch (err: any) {
      console.error("Hub proof upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <Camera size={14} className="text-primary" />
        📦 Photo du colis au Hub
      </p>
      <p className="text-[10px] text-muted-foreground">
        Prenez une photo du colis pour prouver son arrivée au Hub et inciter le client à récupérer ou payer la livraison.
      </p>
      {url ? (
        <div className="relative">
          <img src={url} alt="Preuve hub" className="w-full h-32 object-cover rounded-md" />
          <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
            ✓ Envoyée
          </span>
        </div>
      ) : (
        <label className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors ${uploading ? "opacity-50" : ""}`}>
          {uploading ? <Loader2 size={14} className="animate-spin text-primary" /> : <Camera size={14} className="text-primary" />}
          <span className="text-xs text-primary font-medium">
            {uploading ? "Envoi en cours..." : "Prendre / Ajouter une photo"}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
