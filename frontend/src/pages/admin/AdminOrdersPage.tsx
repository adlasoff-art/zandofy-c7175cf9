import { AdminLayout } from "@/components/admin/AdminLayout";
import { Search, Loader2, ChevronDown, ChevronUp, MapPin, Truck, AlertTriangle, Download, Hash, Bike, DollarSign } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { triggerOrderStatusNotification } from "@/services/order-notifications";
import { resolveDeliveryPath, checkRiderAvailability, type DeliveryZoneMatch } from "@/services/logistics-path";
import {
  STATUS_CONFIG,
  STATUS_FLOW,
  ORDER_STATUSES,
  getNextStatus,
  canAdminAdvance,
  type OrderStatus,
} from "@/lib/order-status";
import { TrackingNumberModal, RiderAssignmentModal, DeliveryFeeModal } from "@/components/vendor/OrderTransitionModals";

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [logisticsInfo, setLogisticsInfo] = useState<Record<string, { zones: DeliveryZoneMatch[]; usePlatform: boolean; riderAvailable: boolean; riderCount: number } | null>>({});
  const [loadingLogistics, setLoadingLogistics] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Modal states for admin
  const [trackingModal, setTrackingModal] = useState<string | null>(null);
  const [riderModal, setRiderModal] = useState<string | null>(null);
  const [deliveryFeeModal, setDeliveryFeeModal] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_ref, shipping_first_name, shipping_last_name, shipping_phone, shipping_address, shipping_city, shipping_country, total, status, created_at, store_id, tracking_number, assigned_rider_name, assigned_rider_id, delivery_choice, last_mile_fee, confirmation_code")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  // Cancellation requests
  const { data: cancelRequests = [] } = useQuery({
    queryKey: ["admin-cancel-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cancellation_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchSearch = !search || o.order_ref.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

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
      toast.success(`Statut → ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
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

    // shipped → assigning_rider: ask for rider selection
    if (currentStatus === "shipped" && next === "assigning_rider") {
      setRiderModal(orderId);
      return;
    }

    updateStatus(orderId, next);
  };

  const handleApproveCancellation = async (requestId: string, orderId: string) => {
    setUpdatingId(orderId);
    // Approve the request
    await supabase.from("cancellation_requests").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    }).eq("id", requestId);

    // Cancel the order
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);

    // Notify customer
    const order = orders.find(o => o.id === orderId);
    if (order) {
      await supabase.from("notifications").insert({
        user_id: (await supabase.from("orders").select("user_id").eq("id", orderId).single()).data?.user_id || "",
        title: "Commande annulée par le vendeur",
        message: `Votre commande ${order.order_ref} a été annulée par le vendeur suite à un problème lors de la préparation. Un remboursement sera traité.`,
        type: "order",
        link: `/dashboard`,
      });
    }

    toast.success("Annulation approuvée, client notifié");
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin-cancel-requests"] });
    setUpdatingId(null);
  };

  const handleRejectCancellation = async (requestId: string) => {
    await supabase.from("cancellation_requests").update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    }).eq("id", requestId);
    toast.success("Demande d'annulation rejetée");
    queryClient.invalidateQueries({ queryKey: ["admin-cancel-requests"] });
  };

  const exportCSV = () => {
    const headers = ["Réf", "Client", "Ville", "Total", "Statut", "Date"];
    const rows = filtered.map(o => [
      o.order_ref,
      `${o.shipping_first_name || ""} ${o.shipping_last_name || ""}`.trim(),
      o.shipping_city || "",
      Number(o.total).toFixed(2),
      o.status,
      format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commandes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} commandes exportées`);
  };

  const filterTabs: (OrderStatus | "all")[] = ["all", ...STATUS_FLOW, "cancelled", "returned"];

  return (
    <AdminLayout title="Commandes — God Mode">
      {/* Pending cancellation requests */}
      {cancelRequests.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle size={16} /> {cancelRequests.length} demande(s) d'annulation en attente
          </p>
          {cancelRequests.map((req: any) => {
            const order = orders.find(o => o.id === req.order_id);
            return (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-card rounded-lg p-3 border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{order?.order_ref || req.order_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground"><strong>Motif :</strong> {req.reason}</p>
                  {req.justification && <p className="text-xs text-muted-foreground">{req.justification}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveCancellation(req.id, req.order_id)}
                    disabled={updatingId === req.order_id}
                    className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
                  >
                    Approuver l'annulation
                  </button>
                  <button
                    onClick={() => handleRejectCancellation(req.id)}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Rechercher une commande..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors shrink-0">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
        {filterTabs.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
              statusFilter === s ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border"
            }`}
          >
            {s === "all" ? "Toutes" : STATUS_CONFIG[s]?.label || s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">Aucune commande trouvée.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((o) => {
              const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const next = getNextStatus(o.status);
              const canAdvance = canAdminAdvance(o.status);
              const isExpanded = expandedId === o.id;

              return (
                <div key={o.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}
                    className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/20 transition-colors text-sm"
                  >
                    <StatusIcon size={16} className={cfg.color} />
                    <span className="font-mono text-xs w-28 shrink-0">{o.order_ref}</span>
                    <span className="flex-1 min-w-0 truncate">{o.shipping_first_name} {o.shipping_last_name?.charAt(0)}.</span>
                    <span className="font-semibold w-20 text-right">${Number(o.total).toFixed(2)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.badgeClass}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">
                      {format(new Date(o.created_at), "d MMM", { locale: fr })}
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 bg-muted/10">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Client</span>
                          <p className="font-medium">{o.shipping_first_name} {o.shipping_last_name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Téléphone</span>
                          <p className="font-medium">{o.shipping_phone || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Adresse complète</span>
                          <p className="font-medium">{[o.shipping_address, o.shipping_city, o.shipping_country].filter(Boolean).join(", ") || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total</span>
                          <p className="font-bold text-primary">${Number(o.total).toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Tracking number */}
                      {o.tracking_number && (
                        <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md p-2">
                          <Hash size={12} className="text-primary shrink-0" />
                          <span className="text-muted-foreground">N° suivi :</span>
                          <span className="font-mono font-bold text-foreground">{o.tracking_number}</span>
                        </div>
                      )}

                      {/* Assigned rider */}
                      {o.assigned_rider_name && (
                        <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md p-2">
                          <Bike size={12} className="text-primary shrink-0" />
                          <span className="text-muted-foreground">Livreur :</span>
                          <span className="font-bold text-primary">{o.assigned_rider_name}</span>
                        </div>
                      )}

                      {/* Delivery choice & fee */}
                      {o.last_mile_fee != null && Number(o.last_mile_fee) > 0 && (
                        <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md p-2">
                          <DollarSign size={12} className="text-primary shrink-0" />
                          <span className="text-muted-foreground">Frais livraison :</span>
                          <span className="font-bold">${Number(o.last_mile_fee).toFixed(2)}</span>
                          {o.delivery_choice && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              o.delivery_choice === "home_delivery" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {o.delivery_choice === "home_delivery" ? "Domicile" : "Hub"}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Confirmation code */}
                      {o.confirmation_code && (
                        <div className="flex items-center gap-2 text-xs bg-primary/10 rounded-md p-2">
                          <span className="text-muted-foreground">Code confirmation :</span>
                          <span className="font-mono font-bold text-primary text-sm">{o.confirmation_code}</span>
                        </div>
                      )}

                      {/* Next step button */}
                      {next && canAdvance && (
                        <button
                          onClick={() => handleAdvance(o.id, o.status)}
                          disabled={updatingId === o.id}
                          className="w-full py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {updatingId === o.id ? <Loader2 size={12} className="animate-spin" /> : <StatusIcon size={12} />}
                          Passer à : {STATUS_CONFIG[next]?.label}
                        </button>
                      )}

                      {/* God Mode: set any status */}
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_FLOW.map((s) => {
                          const sc = STATUS_CONFIG[s];
                          const isCurrent = o.status === s;
                          return (
                            <button
                              key={s}
                              disabled={isCurrent || updatingId === o.id}
                              onClick={() => updateStatus(o.id, s)}
                              className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors disabled:opacity-40 ${
                                isCurrent
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card border-border hover:border-primary hover:text-primary"
                              }`}
                            >
                              {sc.label}
                            </button>
                          );
                        })}
                        <button
                          disabled={o.status === "cancelled" || updatingId === o.id}
                          onClick={() => updateStatus(o.id, "cancelled")}
                          className="px-2.5 py-1 text-[10px] font-medium rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                        >
                          Annuler
                        </button>
                        <button
                          disabled={o.status === "returned" || updatingId === o.id}
                          onClick={() => updateStatus(o.id, "returned")}
                          className="px-2.5 py-1 text-[10px] font-medium rounded-full border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        >
                          Retourner
                        </button>
                      </div>

                      {updatingId === o.id && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 size={12} className="animate-spin" /> Mise à jour...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transition modals for admin */}
      {trackingModal && (
        <TrackingNumberModal
          loading={!!updatingId}
          onCancel={() => setTrackingModal(null)}
          onConfirm={(trackingNumber) => {
            updateStatus(trackingModal, "in_shipping", { tracking_number: trackingNumber || null });
            setTrackingModal(null);
          }}
        />
      )}

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

      {riderModal && (
        <RiderAssignmentModal
          loading={!!updatingId}
          showDeliveryFee={true}
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
    </AdminLayout>
  );
}