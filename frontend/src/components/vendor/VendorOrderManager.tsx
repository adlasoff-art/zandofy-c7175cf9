import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, ChevronDown, ChevronUp, XCircle, MapPin, Hash, User as UserIcon, Bike, AlertTriangle, Send, Edit2, Truck } from "lucide-react";
import { PaymentProofUpload } from "@/components/PaymentProofUpload";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { triggerOrderStatusNotification } from "@/services/order-notifications";
import {
  STATUS_CONFIG,
  STATUS_FLOW,
  getNextStatus,
  canVendorAdvance,
  canAdminAdvance,
} from "@/lib/order-status";
import { useRoles } from "@/hooks/use-roles";
import { TrackingNumberModal, RiderAssignmentModal, DeliveryFeeModal, EditTrackingModal, generateConfirmationCode } from "./OrderTransitionModals";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getColorDisplay } from "@/utils/colorName";

interface OrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  price: number;
  quantity: number;
  color: string | null;
  size: string | null;
}

interface StatusHistoryEntry {
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  order_ref: string;
  status: string;
  payment_method: string | null;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_email: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
  created_at: string;
  tracking_number: string | null;
  supplier_order_number: string | null;
  assigned_rider_name: string | null;
  assigned_rider_id: string | null;
  delivery_choice: string | null;
  last_mile_fee: number | null;
  confirmation_code: string | null;
  shipping_payment_status: string | null;
  last_mile_payment_method: string | null;
  rider_cash_collected: boolean | null;
  shipping_payment_proof_url: string | null;
  last_mile_payment_proof_url: string | null;
  hub_pickup_proof_url: string | null;
  items: OrderItem[];
  history: StatusHistoryEntry[];
}

export function VendorOrderManager({ storeId }: { storeId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { isAdmin, isManager } = useRoles();
  const isStaff = isAdmin || isManager;

  // Modal states
  const [trackingModal, setTrackingModal] = useState<string | null>(null);
  const [riderModal, setRiderModal] = useState<string | null>(null);
  const [deliveryFeeModal, setDeliveryFeeModal] = useState<string | null>(null);
  const [editTrackingModal, setEditTrackingModal] = useState<string | null>(null);
  const [hasSelfDelivery, setHasSelfDelivery] = useState(false);

  // Check if store has self-delivery
  useEffect(() => {
    async function check() {
      const { data } = await supabase
        .from("vendor_subscriptions")
        .select("can_self_deliver")
        .eq("store_id", storeId)
        .maybeSingle();
      setHasSelfDelivery(data?.can_self_deliver || false);
    }
    check();
  }, [storeId]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_ref, status, payment_method, shipping_first_name, shipping_last_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_country, subtotal, shipping_cost, total, created_at, tracking_number, supplier_order_number, assigned_rider_name, assigned_rider_id, delivery_choice, last_mile_fee, confirmation_code, shipping_payment_status, last_mile_payment_method, rider_cash_collected, shipping_payment_proof_url, last_mile_payment_proof_url, hub_pickup_proof_url")
      .eq("store_id", storeId)
      .not("status", "in", "(awaiting_payment,payment_failed)")
      .order("created_at", { ascending: false }) as any;

    if (error || !data) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = data.map((o) => o.id);
    const [itemsRes, historyRes] = await Promise.all([
      orderIds.length > 0
        ? supabase.from("order_items").select("id, order_id, product_name, product_image, price, quantity, color, size").in("order_id", orderIds)
        : Promise.resolve({ data: [] }),
      orderIds.length > 0
        ? supabase.from("order_status_history").select("order_id, status, created_at").in("order_id", orderIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const itemMap = new Map<string, OrderItem[]>();
    ((itemsRes as any).data || []).forEach((item: any) => {
      const arr = itemMap.get(item.order_id) || [];
      arr.push(item);
      itemMap.set(item.order_id, arr);
    });

    const historyMap = new Map<string, StatusHistoryEntry[]>();
    ((historyRes as any).data || []).forEach((h: any) => {
      const arr = historyMap.get(h.order_id) || [];
      arr.push({ status: h.status, created_at: h.created_at });
      historyMap.set(h.order_id, arr);
    });

    setOrders(data.map((o) => ({
      ...o,
      items: itemMap.get(o.id) || [],
      history: historyMap.get(o.id) || [],
    })));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const updateStatus = async (orderId: string, newStatus: string, extraFields?: Record<string, any>) => {
    setUpdatingId(orderId);
    const updateData: any = { status: newStatus, ...extraFields };

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(`Commande passée à "${STATUS_CONFIG[newStatus]?.label || newStatus}"`);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus, ...extraFields } : o));
      triggerOrderStatusNotification(orderId, newStatus);
    }
    setUpdatingId(null);
  };

  const handleAdvance = (orderId: string, currentStatus: string) => {
    const next = getNextStatus(currentStatus);
    if (!next) return;

    // preparing → in_shipping: ask for tracking number
    if (currentStatus === "preparing" && next === "in_shipping") {
      setTrackingModal(orderId);
      return;
    }

    // in_shipping → shipped (hub): if self-delivery, ask for delivery fee
    if (currentStatus === "in_shipping" && next === "shipped" && hasSelfDelivery) {
      setDeliveryFeeModal(orderId);
      return;
    }

    // shipped → assigning_rider: ask for rider selection
    if (currentStatus === "shipped" && next === "assigning_rider") {
      setRiderModal(orderId);
      return;
    }

    updateStatus(orderId, next);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <Package size={40} className="mx-auto text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">Aucune commande reçue pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <Package size={16} /> Commandes ({orders.length})
      </h3>
      {orders.map((order) => {
        const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
        const StatusIcon = config.icon;
        const next = getNextStatus(order.status);
        const canAdvance = isStaff ? canAdminAdvance(order.status) : canVendorAdvance(order.status);
        const isExpanded = expandedId === order.id;

        return (
          <div key={order.id} className="bg-card border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : order.id)}
              className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
            >
              <StatusIcon size={18} className={config.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{order.order_ref}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.badgeClass}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {order.shipping_first_name} {order.shipping_last_name} · {order.items.length} article(s) · ${Number(order.total).toFixed(2)}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              </span>
              {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 border-t border-border space-y-3 pt-3">
                {/* Customer info + full address */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Client</span>
                    <p className="font-medium text-foreground">{order.shipping_first_name} {order.shipping_last_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Téléphone</span>
                    <p className="font-medium text-foreground">{order.shipping_phone || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground flex items-center gap-1"><MapPin size={10} /> Adresse complète</span>
                    <p className="font-medium text-foreground">
                      {[order.shipping_address, order.shipping_city, order.shipping_country].filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paiement</span>
                    <p className="font-medium text-foreground">{order.payment_method === "mobile_money" ? "Mobile Money" : order.payment_method === "cod" ? "Cash à la livraison" : order.payment_method || "—"}</p>
                  </div>
                  {order.shipping_payment_status && (
                    <div>
                      <span className="text-muted-foreground">Expédition</span>
                      <p className="font-medium text-foreground">{order.shipping_payment_status === "paid" ? "Payée" : order.shipping_payment_status === "deferred" ? "Paiement différé" : order.shipping_payment_status}</p>
                    </div>
                  )}
                  {order.delivery_choice && (
                    <div>
                      <span className="text-muted-foreground">Mode de livraison</span>
                      <p className="font-medium text-foreground">{order.delivery_choice === "home_delivery" ? "Livraison domicile" : "Retrait Hub"}</p>
                    </div>
                  )}
                  {order.last_mile_payment_method && (
                    <div>
                      <span className="text-muted-foreground">Paiement dernier km</span>
                      <p className="font-medium text-foreground">{order.last_mile_payment_method === "cash" ? "Cash au livreur" : "Mobile Money"}</p>
                    </div>
                  )}
                </div>

                {/* Supplier order number */}
                {order.supplier_order_number && (
                  <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md p-2">
                    <Hash size={12} className="text-primary shrink-0" />
                    <span className="text-muted-foreground">N° commande fournisseur :</span>
                    <span className="font-mono font-bold text-foreground">{order.supplier_order_number}</span>
                  </div>
                )}

                {/* Tracking number */}
                {order.tracking_number && (
                  <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md p-2">
                    <Hash size={12} className="text-primary shrink-0" />
                    <span className="text-muted-foreground">N° de suivi :</span>
                    <span className="font-mono font-bold text-foreground">{order.tracking_number}</span>
                  </div>
                )}

                {/* Edit tracking button — available when in_shipping or later, before delivered */}
                {["in_shipping", "shipped", "assigning_rider", "rider_assigned", "out_for_delivery"].includes(order.status) && (
                  <button
                    onClick={() => setEditTrackingModal(order.id)}
                    className="w-full py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Edit2 size={12} />
                    {order.tracking_number ? "Modifier les infos de suivi" : "Ajouter le n° de suivi (tracking)"}
                  </button>
                )}

                {/* Assigned rider */}
                {order.assigned_rider_name && (
                  <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md p-2">
                    <Bike size={12} className="text-primary shrink-0" />
                    <span className="text-muted-foreground">Livreur :</span>
                    <a href="/tracking" className="font-bold text-primary hover:underline">{order.assigned_rider_name}</a>
                  </div>
                )}

                {/* Delivery choice & fee */}
                {order.last_mile_fee != null && Number(order.last_mile_fee) > 0 && (
                  <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md p-2">
                    <span className="text-muted-foreground">Frais livraison domicile :</span>
                    <span className="font-bold text-foreground">${Number(order.last_mile_fee).toFixed(2)}</span>
                    {order.delivery_choice && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        order.delivery_choice === "home_delivery" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {order.delivery_choice === "home_delivery" ? "Livraison domicile" : "Retrait Hub"}
                      </span>
                    )}
                  </div>
                )}

                {/* Deferred shipping payment badge */}
                {order.shipping_payment_status === "deferred" && (
                  <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-md p-2">
                    <span className="text-amber-700 font-medium">⏳ Expédition à payer à l'arrivée : ${Number(order.shipping_cost || 0).toFixed(2)}</span>
                  </div>
                )}

                {/* Rider cash collection status */}
                {order.last_mile_payment_method === "cash" && order.delivery_choice === "home_delivery" && (
                  <div className={`flex items-center gap-2 text-xs rounded-md p-2 ${
                    order.rider_cash_collected ? "bg-primary/10 text-primary" : "bg-amber-50 border border-amber-200 text-amber-700"
                  }`}>
                    {order.rider_cash_collected
                      ? "✅ Cash collecté par le livreur"
                      : "⏳ En attente de confirmation cash par le livreur"
                    }
                  </div>
                )}

                {/* Payment proof uploads (vendor view) */}
                {order.shipping_payment_status === "deferred" && (
                  <PaymentProofUpload
                    orderId={order.id}
                    field="shipping_payment_proof_url"
                    label="Preuve paiement expédition (client)"
                    existingUrl={order.shipping_payment_proof_url}
                  />
                )}

                {order.delivery_choice === "hub_pickup" && order.status !== "delivered" && order.status !== "cancelled" && (
                  <PaymentProofUpload
                    orderId={order.id}
                    field="hub_pickup_proof_url"
                    label="Preuve de remise au Hub (photo)"
                    existingUrl={order.hub_pickup_proof_url}
                  />
                )}

                {order.delivery_choice === "home_delivery" && order.last_mile_payment_method === "cash" && (
                  <PaymentProofUpload
                    orderId={order.id}
                    field="last_mile_payment_proof_url"
                    label="Preuve paiement livraison (cash)"
                    existingUrl={order.last_mile_payment_proof_url}
                  />
                )}

                {order.confirmation_code && (
                  <div className="flex items-center gap-2 text-xs bg-primary/10 rounded-md p-2">
                    <span className="text-muted-foreground">Code confirmation :</span>
                    <span className="font-mono font-bold text-primary text-sm">{order.confirmation_code}</span>
                  </div>
                )}

                {/* Mini stepper with dates */}
                <OrderMiniStepper status={order.status} history={order.history} trackingNumber={order.tracking_number} />

                {/* Items */}
                <div className="space-y-1.5">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 bg-muted/30 rounded-md p-2">
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package size={12} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{item.product_name}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                          <span>{item.quantity}x ${Number(item.price).toFixed(2)}</span>
                          {item.color && (() => {
                            const cd = getColorDisplay(item.color);
                            return cd ? (
                              <span className="inline-flex items-center gap-1">
                                · {cd.hex && <span className="w-2.5 h-2.5 rounded-full border border-border inline-block shrink-0" style={{ backgroundColor: cd.hex }} />}
                                {cd.name}
                              </span>
                            ) : null;
                          })()}
                          {item.size ? <span>· {item.size}</span> : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="text-xs space-y-1 border-t border-border pt-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Expédition</span><span>${Number(order.shipping_cost).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-foreground"><span>Total</span><span>${Number(order.total).toFixed(2)}</span></div>
                </div>

                {/* Status actions */}
                {next && canAdvance && (
                  <button
                    onClick={() => handleAdvance(order.id, order.status)}
                    disabled={updatingId === order.id}
                    className="w-full py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {updatingId === order.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <StatusIcon size={12} />
                    )}
                    Passer à : {STATUS_CONFIG[next]?.label}
                  </button>
                )}

                {!canAdvance && next && !isStaff && (
                  <p className="text-[11px] text-muted-foreground text-center py-1">
                    La prochaine étape ({STATUS_CONFIG[next]?.label}) est gérée par l'administration.
                  </p>
                )}

                {/* Cancel only when pending */}
                {order.status === "pending" && (
                  <button
                    onClick={() => updateStatus(order.id, "cancelled")}
                    disabled={updatingId === order.id}
                    className="w-full py-1.5 text-xs text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    Annuler la commande
                  </button>
                )}

                {/* Vendor cancellation request at "preparing" stage */}
                {order.status === "preparing" && !isStaff && (
                  <VendorCancelRequestButton orderId={order.id} storeId={storeId} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Tracking number modal */}
      {trackingModal && (
        <TrackingNumberModal
          loading={!!updatingId}
          onCancel={() => setTrackingModal(null)}
          onConfirm={(trackingNumber, supplierOrderNumber) => {
            updateStatus(trackingModal, "in_shipping", {
              tracking_number: trackingNumber || null,
              supplier_order_number: supplierOrderNumber || null,
            });
            setTrackingModal(null);
          }}
        />
      )}

      {/* Delivery fee modal (self-delivery → shipped/hub) */}
      {deliveryFeeModal && (
        <DeliveryFeeModal
          loading={!!updatingId}
          onCancel={() => setDeliveryFeeModal(null)}
          onConfirm={(fee) => {
            updateStatus(deliveryFeeModal, "shipped", { last_mile_fee: fee });
            setDeliveryFeeModal(null);
          }}
        />
      )}

      {/* Edit tracking modal — no status change */}
      {editTrackingModal && (() => {
        const editOrder = orders.find(o => o.id === editTrackingModal);
        return (
          <EditTrackingModal
            currentTracking={editOrder?.tracking_number || ""}
            currentSupplierOrder={editOrder?.supplier_order_number || ""}
            loading={!!updatingId}
            onCancel={() => setEditTrackingModal(null)}
            onConfirm={async (trackingNumber, supplierOrderNumber) => {
              setUpdatingId(editTrackingModal);
              const updates: any = {};
              if (trackingNumber) updates.tracking_number = trackingNumber;
              if (supplierOrderNumber) updates.supplier_order_number = supplierOrderNumber;
              const { error } = await supabase.from("orders").update(updates).eq("id", editTrackingModal);
              if (error) {
                toast.error("Erreur lors de la mise à jour");
              } else {
                toast.success("Informations de suivi mises à jour");
                setOrders(prev => prev.map(o => o.id === editTrackingModal ? { ...o, ...updates } : o));
              }
              setUpdatingId(null);
              setEditTrackingModal(null);
            }}
          />
        );
      })()}

      {/* Rider assignment modal */}
      {riderModal && (
        <RiderAssignmentModal
          loading={!!updatingId}
          showDeliveryFee={hasSelfDelivery}
          onCancel={() => setRiderModal(null)}
          onConfirm={(riderId, riderName, deliveryFee, paymentMethod, confirmationCode) => {
            updateStatus(riderModal, "assigning_rider", {
              assigned_rider_id: riderId,
              assigned_rider_name: riderName,
              last_mile_fee: deliveryFee || undefined,
              last_mile_payment_method: paymentMethod,
              confirmation_code: confirmationCode,
            });
            setRiderModal(null);
          }}
        />
      )}
    </div>
  );
}

/** Order stepper with date/time under each step — enlarged for readability */
function OrderMiniStepper({ status, history, trackingNumber }: { status: string; history: StatusHistoryEntry[]; trackingNumber?: string | null }) {
  const currentIdx = STATUS_FLOW.indexOf(status as any);
  const isCancelled = status === "cancelled" || status === "returned";
  const historyMap = new Map(history.map((h) => [h.status, h.created_at]));

  if (isCancelled) {
    const cfg = STATUS_CONFIG[status];
    return (
      <div className="flex items-center gap-3 py-3">
        <XCircle size={20} className={cfg?.color || "text-destructive"} />
        <span className="text-sm font-semibold text-destructive">{cfg?.label || status}</span>
      </div>
    );
  }

  return (
    <div className="py-3 overflow-x-auto">
      <div className="flex items-start gap-0 min-w-max">
        {STATUS_FLOW.map((step, i) => {
          const done = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const cfg = STATUS_CONFIG[step];
          const ts = historyMap.get(step);
          return (
            <div key={step} className="flex items-start">
              <div className="flex flex-col items-center min-w-[52px] sm:min-w-[64px]">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    done
                      ? isCurrent
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                        : "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                  title={cfg.label}
                >
                  <cfg.icon size={14} />
                </div>
                {/* Tracking indicator on in_shipping step */}
                {step === "in_shipping" && trackingNumber && (
                  <span className="mt-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" title="Tracking disponible" />
                )}
                <span className={`text-[9px] sm:text-[10px] mt-1 text-center leading-tight max-w-[56px] sm:max-w-[68px] ${
                  done ? "text-foreground font-medium" : "text-muted-foreground"
                }`}>
                  {cfg.label}
                </span>
                {ts && (
                  <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">
                    {format(new Date(ts), "dd/MM HH:mm", { locale: fr })}
                  </span>
                )}
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div className={`w-4 sm:w-6 h-0.5 mt-3.5 sm:mt-4 shrink-0 ${i < currentIdx ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Vendor cancellation request button for "preparing" stage */
function VendorCancelRequestButton({ orderId, storeId }: { orderId: string; storeId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [justification, setJustification] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("cancellation_requests").insert({
      order_id: orderId,
      store_id: storeId,
      requested_by: user.id,
      reason: reason.trim(),
      justification: justification.trim() || null,
    });
    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      toast.success("Demande d'annulation envoyée à l'administration");
      setSent(true);
      setOpen(false);
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="w-full py-2 text-xs text-center text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
        <AlertTriangle size={12} className="inline mr-1" />
        Demande d'annulation en cours d'examen
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-1.5 text-xs text-amber-600 border border-amber-300 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
      >
        <AlertTriangle size={12} className="inline mr-1" />
        Demander l'annulation (validation admin requise)
      </button>
    );
  }

  return (
    <div className="w-full p-3 border border-amber-300 rounded-md bg-amber-50/50 dark:bg-amber-900/10 space-y-2">
      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
        <AlertTriangle size={12} /> Demande d'annulation — Justificatif requis
      </p>
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motif de l'annulation *"
        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
        style={{ fontSize: "16px" }}
      />
      <textarea
        value={justification}
        onChange={e => setJustification(e.target.value)}
        placeholder="Justificatif détaillé (optionnel)"
        rows={2}
        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
      <p className="text-[10px] text-muted-foreground">
        Le client sera informé de cette demande. L'annulation nécessite la validation d'un administrateur.
      </p>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">
          Retour
        </button>
        <button
          onClick={handleSubmit}
          disabled={sending || !reason.trim()}
          className="flex-1 px-3 py-2 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Envoyer la demande
        </button>
      </div>
    </div>
  );
}
