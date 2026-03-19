import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Truck, User, DollarSign, Hash } from "lucide-react";

function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Modal: enter supplier order number (required) + tracking number (optional) when advancing preparing → in_shipping */
export function TrackingNumberModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (trackingNumber: string, supplierOrderNumber: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [trackingValue, setTrackingValue] = useState("");
  const [supplierOrderValue, setSupplierOrderValue] = useState("");

  const canSubmit = supplierOrderValue.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card rounded-xl w-full max-w-sm p-5 space-y-4 border border-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Hash size={16} className="text-primary" /> Informations fournisseur
        </h3>

        {/* Supplier order number — required */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            N° de commande fournisseur <span className="text-destructive">*</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Référence de commande Alibaba, 1688, Pinduoduo, AliExpress, Taobao, etc.
          </p>
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

        {/* Tracking number — optional */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            N° de suivi (tracking)
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            AWB ou numéro de tracking du colis. Peut être ajouté plus tard si indisponible.
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
      // Get all users with rider role
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

export { generateConfirmationCode };
