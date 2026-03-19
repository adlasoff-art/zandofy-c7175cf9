import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchWithRetry } from "@/lib/api";
import {
  Package, MapPin, User as UserIcon, ChevronRight, ChevronLeft,
  Truck, CheckCircle2, Clock, Box, Gift, MessageCircle, Loader2,
  Plus, Trash2, Home, Briefcase, Star, Edit2, X, Save, Camera, Bell, XCircle,
  Search, Filter, AlertTriangle, History, RotateCcw, FileText,
} from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { LoyaltyProgress } from "@/components/LoyaltyProgress";
import { ReferralDashboard } from "@/components/ReferralDashboard";
import { AffiliateDashboard } from "@/components/AffiliateDashboard";
import { ReturnsList } from "@/components/returns/ReturnsList";
import { PaymentProofUpload } from "@/components/PaymentProofUpload";
import { ReturnRequestForm } from "@/components/returns/ReturnRequestForm";
import { DisputesList } from "@/components/disputes/DisputesList";
import { DisputeForm } from "@/components/disputes/DisputeForm";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  ACTIVE_ORDER_STATUSES,
  CUSTOMER_TRACKING_STEPS,
  NON_REVENUE_ORDER_STATUSES,
  STATUS_CONFIG,
  getStepIndex,
} from "@/lib/order-status";
import { useKycStatus } from "@/hooks/use-kyc";
import { KycBanner } from "@/components/kyc/KycBanner";
import { KycSubmissionForm } from "@/components/kyc/KycSubmissionForm";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";
import { ShieldCheck } from "lucide-react";
import { getColorDisplay } from "@/utils/colorName";

const TABS = [
  { key: "overview", label: "Aperçu", icon: Package },
  { key: "orders", label: "Commandes", icon: Package },
  { key: "tracking", label: "Suivi", icon: Truck },
  { key: "returns", label: "Retours", icon: RotateCcw },
  { key: "disputes", label: "Litiges", icon: AlertTriangle },
  { key: "referral", label: "Parrainage", icon: Gift },
  { key: "affiliate", label: "Affiliation", icon: Star },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "messages", label: "Messages", icon: MessageCircle },
  { key: "profile", label: "Profil", icon: UserIcon },
  { key: "kyc", label: "Vérification", icon: ShieldCheck },
  { key: "addresses", label: "Adresses", icon: MapPin },
];

const ORDERS_PER_PAGE = 10;

const STATUS_FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "En cours" },
  { key: "delivered", label: "Livrées" },
  { key: "cancelled", label: "Annulées" },
];

interface OrderRow {
  id: string;
  order_ref: string;
  created_at: string;
  total: number;
  status: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number | null;
  coupon_code: string | null;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  payment_method: string | null;
  tracking_number: string | null;
  supplier_order_number: string | null;
  assigned_rider_name: string | null;
  delivery_choice: string | null;
  last_mile_fee: number | null;
  confirmation_code: string | null;
  shipping_payment_status: string | null;
  last_mile_payment_method: string | null;
  last_mile_payment_status: string | null;
  rider_cash_collected: boolean | null;
  shipping_payment_proof_url: string | null;
  last_mile_payment_proof_url: string | null;
  hub_pickup_proof_url: string | null;
}

interface OrderItemRow {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  price: number;
  size: string | null;
  color: string | null;
}

interface StatusHistoryRow {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface SavedAddress {
  id: string;
  label: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postal_code: string | null;
  is_default: boolean;
}

interface ProfileData {
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string;
  gender: string;
  date_of_birth: string;
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { kycStatus, needsKyc, isOrderBlocked, kycVerification, canResubmit, refetchKyc } = useKycStatus();
  const [showKycForm, setShowKycForm] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, order_ref, created_at, total, status, subtotal, shipping_cost, discount_amount, coupon_code, shipping_first_name, shipping_last_name, shipping_address, shipping_city, shipping_country, payment_method, tracking_number, supplier_order_number, assigned_rider_name, delivery_choice, last_mile_fee, confirmation_code, shipping_payment_status, last_mile_payment_method, last_mile_payment_status, rider_cash_collected, shipping_payment_proof_url, last_mile_payment_proof_url, hub_pickup_proof_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }) as any;
    setOrders(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadOrders();
  }, [user, navigate, loadOrders]);

  useEffect(() => {
    if (!selectedOrder) { setOrderItems([]); setStatusHistory([]); return; }
    async function loadDetails() {
      const [itemsRes, historyRes] = await Promise.all([
        supabase
          .from("order_items")
          .select("id, product_name, product_image, quantity, price, size, color")
          .eq("order_id", selectedOrder),
        supabase
          .from("order_status_history")
          .select("id, status, notes, created_at")
          .eq("order_id", selectedOrder)
          .order("created_at", { ascending: true }),
      ]);
      setOrderItems(itemsRes.data || []);
      setStatusHistory(historyRes.data || []);
    }
    loadDetails();
  }, [selectedOrder]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <h1 className="text-xl font-bold text-foreground mb-4">{t("dashboard.title")}</h1>

        <div className="flex gap-1 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedOrder(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap border transition-all ${
                activeTab === tab.key
                  ? "bg-foreground text-card border-foreground"
                  : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : (
          <>
            {activeTab === "overview" && (
              <>
                {needsKyc && <KycBanner kycStatus={kycStatus} needsKyc={needsKyc} isOrderBlocked={isOrderBlocked} onStartKyc={() => setActiveTab("kyc")} />}
                <OverviewTab orders={orders} user={user} />
              </>
            )}
            {activeTab === "orders" && (
              <OrdersTab
                orders={orders}
                selectedOrder={selectedOrder}
                setSelectedOrder={setSelectedOrder}
                orderItems={orderItems}
                statusHistory={statusHistory}
                onCancelSuccess={loadOrders}
              />
            )}
            {activeTab === "tracking" && <TrackingTab orders={orders} />}
            {activeTab === "returns" && <ReturnsList />}
            {activeTab === "disputes" && <DisputesList />}
            {activeTab === "referral" && <ReferralDashboard />}
            {activeTab === "affiliate" && <AffiliateDashboard />}
            {activeTab === "notifications" && <NotificationsTab />}
            {activeTab === "messages" && <MessagesRedirectTab />}
            {activeTab === "profile" && <ProfileTab user={user} />}
            {activeTab === "kyc" && (
              <div className="space-y-6">
                <KycBanner kycStatus={kycStatus} needsKyc={needsKyc} isOrderBlocked={isOrderBlocked} onStartKyc={() => setShowKycForm(true)} />
                {kycStatus !== "not_started" && !showKycForm && (
                  <div className="bg-card rounded-lg p-5 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-foreground">Statut de vérification</h3>
                      <KycStatusBadge status={kycStatus} />
                    </div>
                    {kycVerification?.rejection_reason && (
                      <p className="text-sm text-destructive">Raison : {kycVerification.rejection_reason}</p>
                    )}
                    {canResubmit && (
                      <Button size="sm" onClick={() => setShowKycForm(true)}>Resoumettre les documents</Button>
                    )}
                  </div>
                )}
                {(showKycForm || kycStatus === "not_started") && kycStatus !== "pending" && kycStatus !== "approved" && (
                  <div className="bg-card rounded-lg p-6 border border-border">
                    <h3 className="font-bold text-foreground mb-4">Vérification d'identité</h3>
                    <KycSubmissionForm existingKyc={canResubmit ? kycVerification : null} onSuccess={() => { setShowKycForm(false); refetchKyc(); }} />
                  </div>
                )}
                {kycStatus === "approved" && (
                  <div className="bg-card rounded-lg p-6 border border-border text-center space-y-2">
                    <ShieldCheck size={32} className="mx-auto text-primary" />
                    <h3 className="font-bold text-foreground">Identité vérifiée</h3>
                    <p className="text-sm text-muted-foreground">Vous avez accès à toutes les options de paiement et livraison avancées.</p>
                  </div>
                )}
              </div>
            )}
            {activeTab === "addresses" && <AddressesTab userId={user.id} />}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function OverviewTab({ orders, user }: { orders: OrderRow[]; user: any }) {
  const validOrders = orders.filter((o) => !NON_REVENUE_ORDER_STATUSES.includes(o.status as never));
  const activeOrders = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status as never)).length;
  const totalSpent = validOrders.reduce((sum, order) => {
    const subtotal = Number(order.subtotal || 0);
    const discount = Number(order.discount_amount || 0);
    return sum + Math.max(0, subtotal - discount);
  }, 0);
  const cancelledCount = orders.filter(o => o.status === "cancelled").length;
  const returnedCount = orders.filter(o => o.status === "returned").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Bienvenue</p>
          <p className="text-sm font-bold text-foreground mt-1 truncate">{user.email}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">En cours</p>
          <p className="text-2xl font-bold text-primary mt-1">{activeOrders}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total commandes</p>
          <p className="text-2xl font-bold text-foreground mt-1">{validOrders.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total dépensé</p>
          <p className="text-2xl font-bold text-foreground mt-1">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Annulées</p>
          <p className="text-2xl font-bold text-destructive mt-1">{cancelledCount}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Retournées</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">{returnedCount}</p>
        </div>
      </div>
      <LoyaltyProgress />
    </div>
  );
}

function OrdersTab({ orders, selectedOrder, setSelectedOrder, orderItems, statusHistory, onCancelSuccess }: {
  orders: OrderRow[];
  selectedOrder: string | null;
  setSelectedOrder: (id: string | null) => void;
  orderItems: OrderItemRow[];
  statusHistory: StatusHistoryRow[];
  onCancelSuccess: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  // Filter orders
  const filtered = orders.filter(o => {
    if (statusFilter === "active") return ACTIVE_ORDER_STATUSES.includes(o.status as never);
    if (statusFilter === "delivered") return o.status === "delivered";
    if (statusFilter === "cancelled") return ["cancelled", "returned", "payment_failed"].includes(o.status);
    return true;
  }).filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return o.order_ref.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / ORDERS_PER_PAGE);
  const paginated = filtered.slice(page * ORDERS_PER_PAGE, (page + 1) * ORDERS_PER_PAGE);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [statusFilter, searchQuery]);

  if (selectedOrder) {
    return (
      <OrderDetailView
        order={orders.find(o => o.id === selectedOrder)!}
        orderItems={orderItems}
        statusHistory={statusHistory}
        onBack={() => setSelectedOrder(null)}
        onCancelSuccess={onCancelSuccess}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par référence..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-all ${
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{filtered.length} commande{filtered.length > 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Aucune commande trouvée.</p>
      ) : (
        <div className="space-y-2">
          {paginated.map(order => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const canCancel = order.status === "pending";
            return (
              <div key={order.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground text-sm">{order.order_ref}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${status.badgeClass}`}>{status.label}</span>
                    {(order.shipping_first_name || order.shipping_last_name) && (
                      <span className="text-xs text-foreground font-medium">
                        {[order.shipping_first_name, order.shipping_last_name].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(order.created_at).toLocaleDateString("fr-FR")} · ${Number(order.total).toFixed(2)}
                    {order.coupon_code && ` · 🏷️ ${order.coupon_code}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canCancel && <CancelOrderButton orderId={order.id} orderRef={order.order_ref} onSuccess={onCancelSuccess} small />}
                  <button onClick={() => setSelectedOrder(order.id)} className="text-xs text-primary font-medium flex items-center gap-0.5">
                    Détails <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

function OrderDetailView({ order, orderItems, statusHistory, onBack, onCancelSuccess }: {
  order: OrderRow;
  orderItems: OrderItemRow[];
  statusHistory: StatusHistoryRow[];
  onBack: () => void;
  onCancelSuccess: () => void;
}) {
  const { toast } = useToast();
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  if (!order) return null;
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const canCancel = order.status === "pending";
  const canReturn = order.status === "delivered";
  const canDispute = ["delivered", "returned"].includes(order.status);

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <button onClick={onBack} className="text-sm text-primary flex items-center gap-1">
        <ChevronLeft size={14} /> Retour aux commandes
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">{order.order_ref}</h3>
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${status.badgeClass}`}>{status.label}</span>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div><span className="text-muted-foreground">Date</span><p className="font-medium">{new Date(order.created_at).toLocaleDateString("fr-FR")}</p></div>
        <div><span className="text-muted-foreground">Sous-total</span><p className="font-medium">${Number(order.subtotal).toFixed(2)}</p></div>
        <div><span className="text-muted-foreground">Livraison</span><p className="font-medium">{Number(order.shipping_cost) === 0 ? "Gratuite" : `$${Number(order.shipping_cost).toFixed(2)}`}</p></div>
        <div><span className="text-muted-foreground">Total</span><p className="font-bold text-primary">${Number(order.total).toFixed(2)}</p></div>
      </div>

      {order.coupon_code && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Star size={14} />
          <span>Code promo : <strong>{order.coupon_code}</strong> (-${Number(order.discount_amount || 0).toFixed(2)})</span>
        </div>
      )}

      {/* Payment & delivery details */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {order.payment_method && (
          <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
            Paiement : {order.payment_method === "stripe" ? "Carte bancaire" : order.payment_method === "mobile_money" ? "Mobile Money" : order.payment_method === "cod" ? "Cash à la livraison" : order.payment_method}
          </span>
        )}
        {order.shipping_payment_status && (
          <span className={`px-2 py-0.5 rounded-full font-medium ${order.shipping_payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            Expédition : {order.shipping_payment_status === "paid" ? "Payée" : order.shipping_payment_status === "deferred" ? "Paiement différé" : order.shipping_payment_status}
          </span>
        )}
        {order.delivery_choice && (
          <span className={`px-2 py-0.5 rounded-full font-medium ${order.delivery_choice === "home_delivery" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
            {order.delivery_choice === "home_delivery" ? "Livraison domicile" : "Retrait Hub"}
          </span>
        )}
        {order.last_mile_payment_method && (
          <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
            Dernier km : {order.last_mile_payment_method === "cash" ? "Cash au livreur" : "Mobile Money"}
          </span>
        )}
      </div>

      {/* Shipping info - full address */}
      {(order.shipping_first_name || order.shipping_last_name) && (
        <div className="text-sm">
          <p className="text-muted-foreground text-xs mb-1">Destinataire</p>
          <p className="font-medium text-foreground">{order.shipping_first_name} {order.shipping_last_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[order.shipping_address, order.shipping_city, order.shipping_country].filter(Boolean).join(", ")}
          </p>
        </div>
      )}

      {/* Supplier order number & tracking — visible from in_shipping onwards */}
      {(order.supplier_order_number || order.tracking_number) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Informations de suivi</p>
          {order.supplier_order_number && (
            <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2.5">
              <Package size={14} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-muted-foreground block">N° commande fournisseur</span>
                <span className="font-mono font-bold text-foreground">{order.supplier_order_number}</span>
              </div>
            </div>
          )}
          {order.tracking_number && (
            <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2.5">
              <Truck size={14} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-muted-foreground block">N° de suivi (tracking)</span>
                <span className="font-mono font-bold text-foreground">{order.tracking_number}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assigned rider */}
      {order.assigned_rider_name && (
        <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2.5">
          <Truck size={14} className="text-primary shrink-0" />
          <span className="text-muted-foreground">Livreur :</span>
          <a href="/tracking" className="font-bold text-primary hover:underline">{order.assigned_rider_name}</a>
        </div>
      )}

      {/* Delivery choice for client */}
      {order.status === "shipped" && !order.delivery_choice && order.last_mile_fee != null && Number(order.last_mile_fee) > 0 && (
        <DeliveryChoicePanel order={order} />
      )}
      {order.status === "shipped" && !order.delivery_choice && (order.last_mile_fee == null || Number(order.last_mile_fee) === 0) && (
        <DeliveryChoicePanel order={order} />
      )}

      {/* Deferred shipping payment notice */}
      {order.shipping_payment_status === "deferred" && order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-2.5">
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              ⏳ Frais d'expédition à régler à l'arrivée : <strong>${Number(order.shipping_cost || 0).toFixed(2)}</strong>
            </span>
          </div>
          <PaymentProofUpload
            orderId={order.id}
            field="shipping_payment_proof_url"
            label="Preuve de paiement expédition"
            existingUrl={order.shipping_payment_proof_url}
          />
        </div>
      )}

      {/* Last-mile payment proof for cash delivery */}
      {order.delivery_choice === "home_delivery" && order.last_mile_payment_method === "cash" && order.status !== "delivered" && order.status !== "cancelled" && (
        <PaymentProofUpload
          orderId={order.id}
          field="last_mile_payment_proof_url"
          label="Preuve de paiement livraison (cash)"
          existingUrl={order.last_mile_payment_proof_url}
        />
      )}

      {/* Hub pickup proof upload */}
      {order.delivery_choice === "hub_pickup" && order.status !== "delivered" && order.status !== "cancelled" && (
        <PaymentProofUpload
          orderId={order.id}
          field="hub_pickup_proof_url"
          label="Preuve de retrait au Hub"
          existingUrl={order.hub_pickup_proof_url}
        />
      )}

      {/* Show chosen delivery method */}
      {order.delivery_choice && (
        <div className={`flex items-center gap-2 text-sm rounded-md p-2.5 ${
          order.delivery_choice === "home_delivery" ? "bg-blue-50 dark:bg-blue-900/20" : "bg-amber-50 dark:bg-amber-900/20"
        }`}>
          <span className="text-muted-foreground">Mode de réception :</span>
          <span className="font-bold text-foreground">
            {order.delivery_choice === "home_delivery" ? "Livraison à domicile" : "Retrait au Hub"}
          </span>
          {order.last_mile_fee != null && Number(order.last_mile_fee) > 0 && order.delivery_choice === "home_delivery" && (
            <span className="text-xs text-muted-foreground">(${Number(order.last_mile_fee).toFixed(2)})</span>
          )}
        </div>
      )}

      {/* Confirmation code entry for hub pickup */}
      {order.delivery_choice === "hub_pickup" && order.status !== "delivered" && order.status !== "cancelled" && (
        <ConfirmationCodeEntry orderId={order.id} onSuccess={onCancelSuccess} />
      )}

      {/* Items */}
      {orderItems.length > 0 && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">Articles ({orderItems.length})</h4>
          <div className="space-y-2">
            {orderItems.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                {item.product_image && (
                  <img src={item.product_image} alt="" className="w-12 h-12 object-cover rounded border border-border" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.product_name}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span>Qté: {item.quantity}</span>
                    {item.size && <span>· {item.size}</span>}
                    {item.color && (() => {
                      const cd = getColorDisplay(item.color);
                      return cd ? (
                        <span className="inline-flex items-center gap-1">
                          · {cd.hex && <span className="w-2.5 h-2.5 rounded-full border border-border inline-block shrink-0" style={{ backgroundColor: cd.hex }} />}
                          {cd.name}
                        </span>
                      ) : null;
                    })()}
                  </p>
                </div>
                <span className="text-sm font-medium text-foreground">${(Number(item.price) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stepper with dates */}
      <TrackingStepper status={order.status} statusHistory={statusHistory} />

      {/* Status History Timeline */}
      {statusHistory.length > 0 && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <History size={14} /> Historique détaillé
          </h4>
          <div className="relative pl-4 space-y-3">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
            {statusHistory.map((entry, i) => {
              const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              const isLast = i === statusHistory.length - 1;
              return (
                <div key={entry.id} className="relative flex items-start gap-3">
                  <div className={`relative z-10 w-4 h-4 rounded-full flex items-center justify-center shrink-0 -ml-4 ${
                    isLast ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Icon size={8} />
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className={`text-xs font-medium ${isLast ? "text-primary" : "text-foreground"}`}>
                      {cfg.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(entry.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                    {entry.notes && (
                      <p className="text-[10px] text-muted-foreground italic mt-0.5">{entry.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-border pt-4 flex flex-wrap gap-2">
        {canCancel && <CancelOrderButton orderId={order.id} orderRef={order.order_ref} onSuccess={onCancelSuccess} />}
        {order.status === "delivered" && (
          <Button variant="outline" size="sm" onClick={async () => {
            const { data: sess } = await supabase.auth.getSession();
            if (!sess.session) return;
            try {
              const resp = await fetchWithRetry(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice`,
                { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session.access_token}` }, body: JSON.stringify({ orderId: order.id, format: "pdf" }), retries: 2, timeout: 20000 }
              );
              if (!resp.ok) throw new Error(resp.status === 401 ? "Session expirée" : `Erreur ${resp.status}`);
              const blob = await resp.blob();
              if (blob.size === 0) return;
              const url = URL.createObjectURL(blob);
              const w = window.open(url, "_blank", "noopener,noreferrer");
              if (w) setTimeout(() => URL.revokeObjectURL(url), 60000);
            } catch (e) {
              toast({ title: "Erreur", description: e instanceof Error ? e.message : "Impossible de télécharger la facture.", variant: "destructive" });
            }
          }}>
            <FileText size={14} className="mr-1" /> Télécharger PDF
          </Button>
        )}
        {canReturn && !showReturnForm && (
          <Button variant="outline" size="sm" onClick={() => setShowReturnForm(true)}>
            <RotateCcw size={14} className="mr-1" /> Demander un retour
          </Button>
        )}
        {canDispute && !showDisputeForm && (
          <Button variant="outline" size="sm" onClick={() => setShowDisputeForm(true)}>
            <AlertTriangle size={14} className="mr-1" /> Ouvrir un litige
          </Button>
        )}
      </div>

      {/* Return Request Form */}
      {showReturnForm && (
        <ReturnRequestForm
          orderId={order.id}
          orderRef={order.order_ref}
          storeId={null}
          orderTotal={Number(order.total)}
          onSuccess={() => { setShowReturnForm(false); onCancelSuccess(); }}
          onCancel={() => setShowReturnForm(false)}
        />
      )}

      {/* Dispute Form */}
      {showDisputeForm && (
        <DisputeForm
          orderId={order.id}
          storeId={null}
          onSuccess={() => { setShowDisputeForm(false); onCancelSuccess(); }}
          onCancel={() => setShowDisputeForm(false)}
        />
      )}
    </div>
  );
}

function CancelOrderButton({ orderId, orderRef, onSuccess, small }: {
  orderId: string;
  orderRef: string;
  onSuccess: () => void;
  small?: boolean;
}) {
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);
    setCancelling(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Commande annulée", description: `${orderRef} a été annulée.` });
      onSuccess();
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {small ? (
          <button className="text-[10px] text-destructive font-medium hover:underline whitespace-nowrap">Annuler</button>
        ) : (
          <Button variant="destructive" size="sm">
            <XCircle size={14} className="mr-1" /> Annuler la commande
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-destructive" />
            Annuler {orderRef} ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. La commande sera marquée comme annulée et ne pourra plus être modifiée.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Non, garder</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {cancelling ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Oui, annuler
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TrackingStepper({ status, statusHistory }: { status: string; statusHistory?: StatusHistoryRow[] }) {
  const currentIdx = getStepIndex(status);
  const isCancelled = status === "cancelled" || status === "returned";
  const historyMap = new Map((statusHistory || []).map((h) => [h.status, h.created_at]));

  if (isCancelled) {
    const cfg = STATUS_CONFIG[status];
    return (
      <div className="flex items-center gap-2 py-3">
        <XCircle size={18} className={cfg?.color || "text-destructive"} />
        <span className="text-sm font-medium text-destructive">{cfg?.label || status}</span>
      </div>
    );
  }

  // 3 rows of 3 steps — snake flow: Row1 L→R, Row2 R→L (reversed display), Row3 L→R
  const ROW1 = CUSTOMER_TRACKING_STEPS.slice(0, 3); // Reçue, Confirmée, En préparation
  const ROW2 = CUSTOMER_TRACKING_STEPS.slice(3, 6); // En expédition, Arrivée hub, Assignation livreur
  const ROW3 = CUSTOMER_TRACKING_STEPS.slice(6, 9); // Livreur assigné, En livraison, Livrée

  const renderStep = (step: typeof CUSTOMER_TRACKING_STEPS[0], globalIdx: number, isCurrent: boolean, done: boolean) => {
    const Icon = step.icon;
    const ts = historyMap.get(step.key);
    return (
      <div key={step.key} className="flex flex-col items-center gap-1 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
          isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/30 scale-110"
            : done ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}>
          <Icon size={18} />
        </div>
        <span className={`text-xs font-semibold text-center leading-tight px-0.5 ${
          isCurrent ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
        }`}>
          {step.label}
        </span>
        {ts && (
          <span className="text-[10px] text-muted-foreground leading-tight">
            {format(new Date(ts), "dd/MM HH:mm", { locale: fr })}
          </span>
        )}
      </div>
    );
  };

  const renderRow = (steps: typeof CUSTOMER_TRACKING_STEPS, startIndex: number) => (
    <div className="flex items-start w-full">
      {steps.map((step, i) => {
        const globalIdx = startIndex + i;
        const done = globalIdx <= currentIdx;
        const isCur = globalIdx === currentIdx;
        return (
          <div key={step.key} className="flex items-start flex-1 min-w-0">
            {renderStep(step, globalIdx, isCur, done)}
            {i < steps.length - 1 && (
              <div className={`h-0.5 mt-5 flex-shrink-0 w-4 sm:w-6 ${globalIdx < currentIdx ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // Row 2 is displayed reversed visually (snake: goes right-to-left)
  const renderRowReversed = (steps: typeof CUSTOMER_TRACKING_STEPS, startIndex: number) => {
    const reversed = [...steps].reverse();
    return (
      <div className="flex items-start w-full">
        {reversed.map((step, i) => {
          const globalIdx = startIndex + (steps.length - 1 - i);
          const done = globalIdx <= currentIdx;
          const isCur = globalIdx === currentIdx;
          return (
            <div key={step.key} className="flex items-start flex-1 min-w-0">
              {renderStep(step, globalIdx, isCur, done)}
              {i < reversed.length - 1 && (
                <div className={`h-0.5 mt-5 flex-shrink-0 w-4 sm:w-6 ${
                  // For reversed row, connector between globalIdx of current and next (which is lower index)
                  Math.min(startIndex + (steps.length - 1 - i), startIndex + (steps.length - 2 - i)) < currentIdx ? "bg-primary" : "bg-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="py-3 space-y-0">
      {/* Row 1: L → R */}
      {renderRow(ROW1, 0)}
      {/* Snake connector: top-right down to row 2 right */}
      <div className="flex justify-end pr-[16%]">
        <div className={`w-0.5 h-5 ${currentIdx >= 2 ? "bg-primary" : "bg-border"}`} />
      </div>
      {/* Row 2: R → L (reversed) */}
      {renderRowReversed(ROW2, 3)}
      {/* Snake connector: bottom-left down to row 3 left */}
      <div className="flex justify-start pl-[16%]">
        <div className={`w-0.5 h-5 ${currentIdx >= 5 ? "bg-primary" : "bg-border"}`} />
      </div>
      {/* Row 3: L → R */}
      {renderRow(ROW3, 6)}
    </div>
  );
}

/** Client chooses between home delivery or hub pickup */
function DeliveryChoicePanel({ order }: { order: OrderRow }) {
  const { toast } = useToast();
  const [choosing, setChoosing] = useState(false);

  const handleChoice = async (choice: "home_delivery" | "hub_pickup") => {
    setChoosing(true);
    const { error } = await supabase
      .from("orders")
      .update({ delivery_choice: choice })
      .eq("id", order.id);
    setChoosing(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: choice === "home_delivery" ? "Livraison à domicile sélectionnée" : "Retrait au Hub sélectionné" });
      window.location.reload();
    }
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
      <p className="text-sm font-bold text-foreground">🏠 Choisissez votre mode de réception</p>
      {order.last_mile_fee != null && Number(order.last_mile_fee) > 0 && (
        <p className="text-xs text-muted-foreground">
          Frais de livraison à domicile : <strong className="text-foreground">${Number(order.last_mile_fee).toFixed(2)}</strong>
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => handleChoice("home_delivery")}
          disabled={choosing}
          className="flex-1 px-3 py-2.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {choosing ? <Loader2 size={12} className="animate-spin mx-auto" /> : "🚚 Livraison à domicile"}
        </button>
        <button
          onClick={() => handleChoice("hub_pickup")}
          disabled={choosing}
          className="flex-1 px-3 py-2.5 text-xs font-medium bg-card text-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          🏪 Retrait au Hub
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        🚀 Profitez d'une livraison rapide et sans effort directement chez vous !
      </p>
    </div>
  );
}

/** Client enters confirmation code for hub pickup */
function ConfirmationCodeEntry({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    // Check if code matches
    const { data } = await supabase
      .from("orders")
      .select("confirmation_code")
      .eq("id", orderId)
      .single();

    if (data?.confirmation_code && data.confirmation_code.toUpperCase() === code.trim().toUpperCase()) {
      // Code matches - mark as delivered
      await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
      toast({ title: "✅ Commande confirmée !", description: "Votre commande est marquée comme livrée." });
      onSuccess();
    } else {
      toast({ title: "Code incorrect", description: "Vérifiez le code fourni par le vendeur.", variant: "destructive" });
    }
    setVerifying(false);
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
      <p className="text-sm font-bold text-foreground">🔐 Code de confirmation</p>
      <p className="text-xs text-muted-foreground">
        Saisissez le code à 6 caractères fourni par le vendeur lors de la récupération de votre colis au Hub.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="EX: A3B7K2"
          maxLength={6}
          className="flex-1 px-3 py-2.5 text-sm font-mono text-center tracking-widest bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
          style={{ fontSize: "16px" }}
        />
        <button
          onClick={handleVerify}
          disabled={verifying || code.length < 6}
          className="px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
        >
          {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Valider
        </button>
      </div>
    </div>
  );
}

function TrackingTab({ orders }: { orders: OrderRow[] }) {
  const activeOrders = orders.filter(o => !["delivered", "cancelled", "returned"].includes(o.status));
  if (activeOrders.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aucune commande en cours de livraison.</p>;
  }
  return (
    <div className="space-y-4">
      {activeOrders.map(order => (
        <div key={order.id} className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-sm text-foreground">{order.order_ref}</span>
          </div>
          <TrackingStepper status={order.status} />
        </div>
      ))}
    </div>
  );
}

function ProfileTab({ user }: { user: any }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({ first_name: "", last_name: "", phone: "", avatar_url: "", gender: "", date_of_birth: "" });

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("first_name, last_name, phone, avatar_url, gender, date_of_birth").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: (data as any).phone || "",
          avatar_url: data.avatar_url || "",
          gender: (data as any).gender || "",
          date_of_birth: (data as any).date_of_birth || "",
        });
      }
      setLoading(false);
    });
  }, [user.id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: profile.first_name || null,
      last_name: profile.last_name || null,
      phone: profile.phone || null,
      avatar_url: profile.avatar_url || null,
      gender: profile.gender || null,
      date_of_birth: profile.date_of_birth || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil mis à jour !" });
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 8 caractères.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mot de passe modifié avec succès !" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erreur upload", description: error.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("product-media").getPublicUrl(path);
    setProfile(prev => ({ ...prev, avatar_url: urlData.publicUrl }));
    toast({ title: "Photo mise à jour !" });
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Profile info */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
          <UserIcon size={18} /> Mon Profil
        </h3>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={24} className="text-muted-foreground" />
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
              <Camera size={12} />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}`.trim() : "Votre nom"}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input className="mt-1 bg-muted" value={user.email || ""} disabled />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Prénom</Label>
              <Input className="mt-1" value={profile.first_name} onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))} placeholder="Votre prénom" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nom</Label>
              <Input className="mt-1" value={profile.last_name} onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))} placeholder="Votre nom" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Téléphone</Label>
            <Input className="mt-1" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+221 7X XXX XX XX" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Sexe</Label>
              <select
                className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-md bg-card"
                value={profile.gender}
                onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
              >
                <option value="">Non renseigné</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Date de naissance</Label>
              <Input
                type="date"
                className="mt-1"
                value={profile.date_of_birth}
                onChange={e => setProfile(p => ({ ...p, date_of_birth: e.target.value }))}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="mt-2">
            {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Password change */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
          🔒 Modifier le mot de passe
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Nouveau mot de passe</Label>
            <Input type="password" className="mt-1" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 caractères" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Confirmer le nouveau mot de passe</Label>
            <Input type="password" className="mt-1" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Retapez le mot de passe" />
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive">Les mots de passe ne correspondent pas.</p>
          )}
          <Button onClick={handlePasswordChange} disabled={changingPassword || !newPassword || !confirmPassword} variant="outline" className="mt-2">
            {changingPassword ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
            Changer le mot de passe
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification, unreadCount } = useNotifications();
  const navigate = useNavigate();

  const typeIcons: Record<string, React.ReactNode> = {
    order: <Package size={16} className="text-blue-500" />,
    message: <MessageCircle size={16} className="text-primary" />,
    promo: <Gift size={16} className="text-orange-500" />,
    info: <Bell size={16} className="text-muted-foreground" />,
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="max-w-xl space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</p>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
            <CheckCircle2 size={12} className="mr-1" /> Tout marquer comme lu
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell size={32} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Aucune notification</p>
        </div>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            className={`bg-card border rounded-lg p-4 flex items-start gap-3 cursor-pointer hover:border-primary/50 transition-colors ${
              !n.is_read ? "border-primary bg-primary/5" : "border-border"
            }`}
            onClick={() => {
              if (!n.is_read) markAsRead(n.id);
              if (n.link) navigate(n.link);
            }}
          >
            <div className="mt-0.5 shrink-0">{typeIcons[n.type] || typeIcons.info}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${!n.is_read ? "font-semibold" : ""} text-foreground`}>{n.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
              className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function MessagesRedirectTab() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/messages"); }, [navigate]);
  return null;
}

function AddressesTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "Domicile", first_name: "", last_name: "", phone: "", address: "", city: "", country: "Sénégal", postal_code: "" });
  const [saving, setSaving] = useState(false);

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("saved_addresses").select("*").eq("user_id", userId).order("is_default", { ascending: false });
    setAddresses((data || []) as SavedAddress[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const resetForm = () => {
    setForm({ label: "Domicile", first_name: "", last_name: "", phone: "", address: "", city: "", country: "Sénégal", postal_code: "" });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (addr: SavedAddress) => {
    setForm({
      label: addr.label,
      first_name: addr.first_name,
      last_name: addr.last_name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      country: addr.country,
      postal_code: addr.postal_code || "",
    });
    setEditId(addr.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name || !form.phone || !form.address || !form.city) {
      toast({ title: "Champs requis", description: "Remplissez tous les champs obligatoires.", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editId) {
      await supabase.from("saved_addresses").update({ ...form, postal_code: form.postal_code || null }).eq("id", editId);
    } else {
      await supabase.from("saved_addresses").insert({
        user_id: userId,
        ...form,
        postal_code: form.postal_code || null,
        is_default: addresses.length === 0,
      });
    }
    setSaving(false);
    resetForm();
    fetchAddresses();
    toast({ title: editId ? "Adresse modifiée !" : "Adresse ajoutée !" });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("saved_addresses").delete().eq("id", id);
    fetchAddresses();
    toast({ title: "Adresse supprimée" });
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from("saved_addresses").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("saved_addresses").update({ is_default: true }).eq("id", id);
    fetchAddresses();
    toast({ title: "Adresse par défaut mise à jour" });
  };

  const labelIcons: Record<string, React.ReactNode> = {
    "Domicile": <Home size={14} />,
    "Bureau": <Briefcase size={14} />,
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4 max-w-xl">
      {addresses.map(addr => (
        <div key={addr.id} className={`bg-card border rounded-lg p-4 ${addr.is_default ? "border-primary" : "border-border"}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-primary">{labelIcons[addr.label] || <MapPin size={16} />}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground">{addr.label}</span>
                {addr.is_default && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">Par défaut</span>}
              </div>
              <p className="text-sm text-foreground">{addr.first_name} {addr.last_name}</p>
              <p className="text-xs text-muted-foreground">{addr.address}, {addr.city}, {addr.country}</p>
              <p className="text-xs text-muted-foreground">{addr.phone}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!addr.is_default && (
                <button onClick={() => handleSetDefault(addr.id)} className="text-[11px] text-primary font-medium hover:underline">
                  Par défaut
                </button>
              )}
              <button onClick={() => handleEdit(addr)} className="p-1.5 text-muted-foreground hover:text-primary">
                <Edit2 size={14} />
              </button>
              <button onClick={() => handleDelete(addr.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">{editId ? "Modifier l'adresse" : "Nouvelle adresse"}</h4>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Libellé</Label>
              <select className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-md bg-card" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}>
                <option>Domicile</option>
                <option>Bureau</option>
                <option>Autre</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prénom *</Label>
              <Input className="mt-1" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Nom *</Label>
              <Input className="mt-1" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Téléphone *</Label>
            <Input className="mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+221 7X XXX XX XX" />
          </div>
          <div>
            <Label className="text-xs">Adresse *</Label>
            <Input className="mt-1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Ville *</Label>
              <Input className="mt-1" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Pays</Label>
              <Input className="mt-1" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Code postal</Label>
              <Input className="mt-1" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
            {editId ? "Modifier" : "Ajouter"}
          </Button>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="w-full py-3 text-sm font-medium border border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Ajouter une adresse
        </button>
      )}
    </div>
  );
}
