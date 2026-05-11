import { useState, useEffect, useCallback } from "react";
import { compressImage } from "@/utils/image-compress";
import { useI18n } from "@/contexts/I18nContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchWithRetry } from "@/lib/api";
import {
  Package, MapPin, User as UserIcon, ChevronRight, ChevronLeft,
  Truck, CheckCircle2, Clock, Box, Gift, MessageCircle, Loader2,
  Plus, Trash2, Home, Briefcase, Star, Edit2, X, Save, Camera, Bell, XCircle,
  Search, Filter, AlertTriangle, History, RotateCcw, FileText, CreditCard,
} from "lucide-react";
import { RetryPaymentModal } from "@/components/payments/RetryPaymentModal";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { useNotifications } from "@/hooks/use-notifications";
import { LoyaltyProgress } from "@/components/LoyaltyProgress";
import { ReferralDashboard } from "@/components/ReferralDashboard";
import { AffiliateDashboard } from "@/components/AffiliateDashboard";
import { ReturnsList } from "@/components/returns/ReturnsList";
import { PaymentProofUpload } from "@/components/PaymentProofUpload";
import { DeliveryProofImage } from "@/components/DeliveryProofImage";
import { DeferredPaymentModal } from "@/components/payments/DeferredPaymentModal";
import { ReturnRequestForm } from "@/components/returns/ReturnRequestForm";
import { FreightDetailsPanel } from "@/components/orders/FreightDetailsPanel";
import { CustomerOrderTracker } from "@/components/orders/CustomerOrderTracker";
import { DisputesList } from "@/components/disputes/DisputesList";
import { DisputeForm } from "@/components/disputes/DisputeForm";
import { formatDistanceToNow, format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
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
import { withOptionalOrderFields } from "@/lib/order-query";
import { useCertification } from "@/hooks/use-certification";
import { CertificationBadge } from "@/components/CertificationBadge";
import { Switch } from "@/components/ui/switch";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { CascadingAddressFields, type AddressData } from "@/components/address/CascadingAddressFields";
import { CustomerPricingTab } from "@/components/customer/CustomerPricingTab";

const TABS = [
  { key: "overview", labelKey: "dashboard.tab.overview", icon: Package },
  { key: "orders", labelKey: "dashboard.tab.orders", icon: Package },
  { key: "subscriptions", labelKey: "dashboard.tab.subscriptions", icon: CreditCard },
  { key: "tracking", labelKey: "dashboard.tab.tracking", icon: Truck },
  { key: "returns", labelKey: "dashboard.tab.returns", icon: RotateCcw },
  { key: "disputes", labelKey: "dashboard.tab.disputes", icon: AlertTriangle },
  { key: "referral", labelKey: "dashboard.tab.referral", icon: Gift },
  { key: "affiliate", labelKey: "dashboard.tab.affiliate", icon: Star },
  { key: "notifications", labelKey: "dashboard.tab.notifications", icon: Bell },
  { key: "messages", labelKey: "dashboard.tab.messages", icon: MessageCircle },
  { key: "profile", labelKey: "dashboard.tab.profile", icon: UserIcon },
  { key: "kyc", labelKey: "dashboard.tab.kyc", icon: ShieldCheck },
  { key: "addresses", labelKey: "dashboard.tab.addresses", icon: MapPin },
];

const ORDERS_PER_PAGE = 10;

const STATUS_FILTERS = [
  { key: "all", labelKey: "dashboard.filter.all" },
  { key: "active", labelKey: "dashboard.filter.active" },
  { key: "delivered", labelKey: "dashboard.filter.delivered" },
  { key: "cancelled", labelKey: "dashboard.filter.cancelled" },
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
  store_id: string | null;
  delivery_date_requested: string | null;
  delivery_time_requested: string | null;
}

interface OrderItemRow {
  id: string;
  product_name: string;
  product_image: string | null;
  product_id: string | null;
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
  commune: string | null;
  quartier: string | null;
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
  nationality: string;
  residence_address: string;
  residence_city: string;
  residence_country: string;
  residence_province: string;
  residence_province_id: string;
  residence_commune: string;
  residence_quartier: string;
  preferred_language: string;
  preferred_contact_channel: string;
  allowed_channels: string[];
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTabState] = useState(initialTab);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    if (tab === "overview") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  }, [setSearchParams]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { kycStatus, needsKyc, isOrderBlocked, kycVerification, canResubmit, refetchKyc } = useKycStatus();
  const [showKycForm, setShowKycForm] = useState(false);
  const [profileName, setProfileName] = useState<{ first_name: string; last_name: string; avatar_url: string }>({ first_name: "", last_name: "", avatar_url: "" });

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_ref, created_at, total, status, subtotal, shipping_cost, discount_amount, coupon_code, shipping_first_name, shipping_last_name, shipping_address, shipping_city, shipping_country, payment_method, tracking_number, assigned_rider_name, delivery_choice, last_mile_fee, confirmation_code, shipping_payment_status, last_mile_payment_method, last_mile_payment_status, rider_cash_collected, store_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }) as any;
    if (error) {
      console.error("[DashboardPage] Error loading orders:", error);
    }
    const ordersWithOptionalFields = await withOptionalOrderFields<OrderRow>((data || []) as OrderRow[], [
      "shipping_payment_proof_url",
      "last_mile_payment_proof_url",
      "hub_pickup_proof_url",
      "delivery_date_requested",
      "delivery_time_requested",
    ]);
    setOrders(ordersWithOptionalFields);
    setLoading(false);
  }, [user]);

  const loadProfileName = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    setProfileName({
      first_name: (data as any)?.first_name || "",
      last_name: (data as any)?.last_name || "",
      avatar_url: (data as any)?.avatar_url || "",
    });
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      navigate("/auth");
      return;
    }

    void loadOrders();
    void loadProfileName();
  }, [authLoading, user, navigate, loadOrders, loadProfileName]);

  useEffect(() => {
    if (!selectedOrder) { setOrderItems([]); setStatusHistory([]); return; }
    async function loadDetails() {
      const [itemsRes, historyRes] = await Promise.all([
        supabase
          .from("order_items")
          .select("id, product_name, product_image, product_id, quantity, price, size, color")
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!user) return null;

  const displayName = profileName.first_name || profileName.last_name
    ? `${profileName.first_name} ${profileName.last_name}`.trim()
    : t("dashboard.client");
  const welcomeName = profileName.first_name || displayName;

  // KPI data (always visible)
  const validOrders = orders.filter((o) => !NON_REVENUE_ORDER_STATUSES.includes(o.status as never));
  const activeOrders = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status as never)).length;
  const totalSpent = validOrders.reduce((sum, order) => {
    const subtotal = Number(order.subtotal || 0);
    const discount = Number(order.discount_amount || 0);
    return sum + Math.max(0, subtotal - discount);
  }, 0);
  const cancelledCount = orders.filter(o => o.status === "cancelled").length;
  const returnedCount = orders.filter(o => o.status === "returned").length;

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setSelectedOrder(null);
  };

  const renderTabContent = () => {
    if (loading) {
      return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;
    }
    return (
      <>
        {activeTab === "overview" && (
          <>
            {needsKyc && <KycBanner kycStatus={kycStatus} needsKyc={needsKyc} isOrderBlocked={isOrderBlocked} onStartKyc={() => setActiveTab("kyc")} />}
            <LoyaltyProgress />
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
        {activeTab === "subscriptions" && <CustomerPricingTab />}
        {activeTab === "tracking" && <TrackingTab orders={orders} />}
        {activeTab === "returns" && <ReturnsList />}
        {activeTab === "disputes" && <DisputesList />}
        {activeTab === "referral" && <ReferralDashboard />}
        {activeTab === "affiliate" && <AffiliateDashboard />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "messages" && <MessagesRedirectTab />}
        {activeTab === "profile" && <ProfileTab user={user} onProfileUpdated={loadProfileName} />}
        {activeTab === "kyc" && (
          <div className="space-y-6">
            <KycBanner kycStatus={kycStatus} needsKyc={needsKyc} isOrderBlocked={isOrderBlocked} onStartKyc={() => setShowKycForm(true)} />
            {kycStatus !== "not_started" && !showKycForm && (
              <div className="bg-card rounded-lg p-5 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">{t("kyc.statusTitle")}</h3>
                  <KycStatusBadge status={kycStatus} />
                </div>
                {kycVerification?.rejection_reason && (
                  <p className="text-sm text-destructive">{t("kyc.reason")} {kycVerification.rejection_reason}</p>
                )}
                {canResubmit && (
                  <Button size="sm" onClick={() => setShowKycForm(true)}>{t("kyc.resubmit")}</Button>
                )}
              </div>
            )}
            {(showKycForm || kycStatus === "not_started") && kycStatus !== "pending" && kycStatus !== "approved" && (
              <div className="bg-card rounded-lg p-6 border border-border">
                <h3 className="font-bold text-foreground mb-4">{t("kyc.formTitle")}</h3>
                <KycSubmissionForm existingKyc={canResubmit ? kycVerification : null} onSuccess={() => { setShowKycForm(false); refetchKyc(); }} />
              </div>
            )}
            {kycStatus === "approved" && (
              <div className="space-y-4">
                <div className="bg-card rounded-lg p-6 border border-border text-center space-y-2">
                  <ShieldCheck size={32} className="mx-auto text-primary" />
                  <h3 className="font-bold text-foreground">{t("kyc.verified.title")}</h3>
                  <p className="text-sm text-muted-foreground">{t("kyc.verified.desc")}</p>
                </div>
                <ClientCertificationSection />
              </div>
            )}
          </div>
        )}
        {activeTab === "addresses" && <AddressesTab userId={user.id} />}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PushPermissionPrompt />
      <main className="container py-6">
        {/* ═══ DESKTOP LAYOUT: Sidebar + Content ═══ */}
        <div className="hidden lg:flex gap-6">
          {/* Sidebar */}
          <nav className="w-56 shrink-0">
            <div className="sticky top-20 space-y-4">
              {/* Profile header */}
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-2 overflow-hidden border-2 border-border">
                  {profileName.avatar_url ? (
                    <img src={profileName.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserIcon size={22} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold text-foreground truncate">Bienvenue, {welcomeName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              </div>

              {/* Navigation items */}
              <div className="bg-card border border-border rounded-lg py-1">
                {TABS.map(tab => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleTabChange(tab.key)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <tab.icon size={16} />
                      {t(tab.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* KPI Cards — always visible */}
            {!loading && (
              <div className="grid grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">{t("dashboard.welcome")}</p>
                  <p className="text-sm font-bold text-foreground mt-1 truncate">{displayName}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">{t("dashboard.kpi.inProgress")}</p>
                  <p className="text-xl font-bold text-primary mt-1">{activeOrders}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">{t("dashboard.totalOrders")}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{validOrders.length}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">{t("dashboard.totalSpent")}</p>
                  <p className="text-xl font-bold text-foreground mt-1">${totalSpent.toFixed(2)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">{t("dashboard.kpi.cancelled")}</p>
                  <p className="text-xl font-bold text-destructive mt-1">{cancelledCount}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">{t("dashboard.kpi.returned")}</p>
                  <p className="text-xl font-bold text-orange-500 mt-1">{returnedCount}</p>
                </div>
              </div>
            )}

            {/* Tab content */}
            {renderTabContent()}
          </div>
        </div>

        {/* ═══ MOBILE LAYOUT: Classic pills ═══ */}
        <div className="lg:hidden space-y-4">
          {/* Mobile greeting */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted overflow-hidden border border-border shrink-0">
              {profileName.avatar_url ? (
                <img src={profileName.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><UserIcon size={16} className="text-muted-foreground" /></div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{t("dashboard.welcomeMobile", { name: welcomeName })}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          {/* Mobile KPIs */}
          {!loading && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-card border border-border rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">{t("dashboard.kpi.inProgress")}</p>
                <p className="text-lg font-bold text-primary">{activeOrders}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">{t("dashboard.kpi.ordersShort")}</p>
                <p className="text-lg font-bold text-foreground">{validOrders.length}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">{t("dashboard.kpi.spentShort")}</p>
                <p className="text-lg font-bold text-foreground">${totalSpent.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Mobile horizontal scrollable tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap border transition-all ${
                  activeTab === tab.key
                    ? "bg-foreground text-card border-foreground"
                    : "bg-card text-foreground border-border hover:border-foreground"
                }`}
              >
                <tab.icon size={14} />
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {renderTabContent()}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// OverviewTab removed — KPIs are now always visible above the tab content.
// The "overview" tab now only shows LoyaltyProgress (rendered inline in renderTabContent).


function OrdersTab({ orders, selectedOrder, setSelectedOrder, orderItems, statusHistory, onCancelSuccess }: {
  orders: OrderRow[];
  selectedOrder: string | null;
  setSelectedOrder: (id: string | null) => void;
  orderItems: OrderItemRow[];
  statusHistory: StatusHistoryRow[];
  onCancelSuccess: () => void;
}) {
  const { t, locale, formatPrice } = useI18n();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [retryOrder, setRetryOrder] = useState<OrderRow | null>(null);

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
    <>
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("dashboard.orders.searchPlaceholder")}
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
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{t(filtered.length > 1 ? "dashboard.orders.countPlural" : "dashboard.orders.count", { count: filtered.length })}</p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">{t("dashboard.orders.empty")}</p>
      ) : (
        <div className="space-y-2">
          {paginated.map(order => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const canCancel = order.status === "pending";
            const canRetryPayment = ["awaiting_payment", "payment_failed"].includes(order.status);
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
                    {new Date(order.created_at).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR")} · {formatPrice(Number(order.total))}
                    {order.coupon_code && ` · 🏷️ ${order.coupon_code}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canRetryPayment && (
                    <button onClick={() => setRetryOrder(order)} className="text-xs text-primary font-medium flex items-center gap-0.5">
                      <CreditCard size={12} /> {t("dashboard.orders.pay")}
                    </button>
                  )}
                  {canCancel && <CancelOrderButton orderId={order.id} orderRef={order.order_ref} onSuccess={onCancelSuccess} small />}
                  <button onClick={() => setSelectedOrder(order.id)} className="text-xs text-primary font-medium flex items-center gap-0.5">
                    {t("dashboard.orders.details")} <ChevronRight size={12} />
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

      {retryOrder && (
        <RetryPaymentModal
          orderId={retryOrder.id}
          orderRef={retryOrder.order_ref}
          amount={Number(retryOrder.total)}
          onClose={() => setRetryOrder(null)}
          onSuccess={() => { setRetryOrder(null); onCancelSuccess(); }}
        />
      )}
    </>
  );
}

function OrderDetailView({ order, orderItems, statusHistory, onBack, onCancelSuccess }: {
  order: OrderRow;
  orderItems: OrderItemRow[];
  statusHistory: StatusHistoryRow[];
  onBack: () => void;
  onCancelSuccess: () => void;
}) {
  const { t, locale, formatPrice } = useI18n();
  const dateLocale = locale === "en" ? enUS : fr;
  const dateStringLocale = locale === "en" ? "en-US" : "fr-FR";
  const { toast } = useToast();
  const { user } = useAuth();
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showRetryPayment, setShowRetryPayment] = useState(false);
  const [showShippingPayment, setShowShippingPayment] = useState<"shipping" | "last_mile" | null>(null);
  const [returnsEnabled, setReturnsEnabled] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [existingReviews, setExistingReviews] = useState<Set<string>>(new Set());

  // Check if store has returns_enabled
  useEffect(() => {
    if (!order.store_id) return;
    supabase
      .from("stores")
      .select("returns_enabled")
      .eq("id", order.store_id)
      .maybeSingle()
      .then(({ data }) => {
        setReturnsEnabled(!!(data as any)?.returns_enabled);
      });
  }, [order.store_id]);

  // Check existing reviews for this order's products
  useEffect(() => {
    if (!user || order.status !== "delivered" || !orderItems.length) return;
    const productIds = orderItems.map(i => i.product_id).filter(Boolean) as string[];
    if (!productIds.length) return;
    supabase
      .from("reviews")
      .select("product_id")
      .eq("user_id", user.id)
      .in("product_id", productIds)
      .then(({ data }) => {
        setExistingReviews(new Set((data || []).map((r: any) => r.product_id)));
      });
  }, [user, order.status, orderItems]);

  if (!order) return null;
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const canCancel = order.status === "pending";
  const canReturn = order.status === "delivered" && returnsEnabled;
  const canRetryPayment = ["awaiting_payment", "payment_failed"].includes(order.status);
  const canDispute = ["delivered", "returned"].includes(order.status);

  const handleSubmitReview = async (productId: string) => {
    if (!user || !reviewRating) return;
    setReviewSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      product_id: productId,
      user_id: user.id,
      rating: reviewRating,
      comment: reviewComment.trim(),
      images: reviewImages.length > 0 ? reviewImages : null,
      is_verified_purchase: true,
      is_approved: false,
    });
    if (error) {
      toast({ title: t("dashboard.review.errorTitle"), description: t("dashboard.review.errorDesc"), variant: "destructive" });
    } else {
      toast({ title: t("dashboard.review.thanks"), description: t("dashboard.review.thanksDesc") });
      setExistingReviews(prev => new Set([...prev, productId]));
      setReviewRating(0);
      setReviewComment("");
      setReviewImages([]);
      setReviewSubmitted(true);
    }
    setReviewSubmitting(false);
  };

  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user) return;
    const { compressImage } = await import("@/utils/image-compress");
    const urls: string[] = [];
    for (const file of Array.from(files).slice(0, 3)) {
      const compressed = await compressImage(file);
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const { error } = await supabase.storage.from("reviews").upload(fileName, compressed, { cacheControl: "31536000" });
      if (!error) {
        const { data: pub } = supabase.storage.from("reviews").getPublicUrl(fileName);
        urls.push(pub.publicUrl);
      }
    }
    setReviewImages(prev => [...prev, ...urls].slice(0, 5));
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <button onClick={onBack} className="text-sm text-primary flex items-center gap-1">
        <ChevronLeft size={14} /> {t("dashboard.detail.back")}
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">{order.order_ref}</h3>
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${status.badgeClass}`}>{status.label}</span>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div><span className="text-muted-foreground">{t("dashboard.detail.date")}</span><p className="font-medium">{new Date(order.created_at).toLocaleDateString(dateStringLocale)}</p></div>
        <div><span className="text-muted-foreground">{t("dashboard.detail.subtotal")}</span><p className="font-medium">{formatPrice(Number(order.subtotal))}</p></div>
        <div><span className="text-muted-foreground">{t("dashboard.detail.shipping")}</span><p className="font-medium">{Number(order.shipping_cost) === 0 ? t("dashboard.detail.free") : formatPrice(Number(order.shipping_cost))}</p></div>
        <div><span className="text-muted-foreground">{t("dashboard.detail.total")}</span><p className="font-bold text-primary">{formatPrice(Number(order.total))}</p></div>
      </div>

      {order.coupon_code && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Star size={14} />
          <span>{t("dashboard.detail.couponPromo")} <strong>{order.coupon_code}</strong> (-{formatPrice(Number(order.discount_amount || 0))})</span>
        </div>
      )}

      {/* Payment & delivery details */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {order.payment_method && (
          <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
            {t("dashboard.detail.payment")} {order.payment_method === "stripe" || order.payment_method === "card" ? t("dashboard.detail.pm.card") : order.payment_method === "paypal" ? t("dashboard.detail.pm.paypal") : order.payment_method === "mobile_money" ? t("dashboard.detail.pm.mobileMoney") : order.payment_method === "cod" ? t("dashboard.detail.pm.cod") : order.payment_method === "off_platform" ? t("dashboard.detail.pm.offPlatform") : order.payment_method}
          </span>
        )}
        {order.shipping_payment_status && (
          <span className={`px-2 py-0.5 rounded-full font-medium ${order.shipping_payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {t("dashboard.detail.shippingFee")} {order.shipping_payment_status === "paid" ? t("dashboard.detail.shippingStatus.paid") : order.shipping_payment_status === "deferred" ? t("dashboard.detail.shippingStatus.deferred") : order.shipping_payment_status}
          </span>
        )}
        {order.delivery_choice && (
          <span className={`px-2 py-0.5 rounded-full font-medium ${order.delivery_choice === "home_delivery" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
            {order.delivery_choice === "home_delivery" ? t("dashboard.detail.delivery.home") : t("dashboard.detail.delivery.hub")}
          </span>
        )}
        {order.last_mile_payment_method && (
          <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
            {t("dashboard.detail.lastMile")} {order.last_mile_payment_method === "cash" ? t("dashboard.detail.lastMile.cash") : t("dashboard.detail.lastMile.mobile")}
          </span>
        )}
      </div>

      {/* Shipping info - full address */}
      {(order.shipping_first_name || order.shipping_last_name) && (
        <div className="text-sm">
          <p className="text-muted-foreground text-xs mb-1">{t("dashboard.detail.recipient")}</p>
          <p className="font-medium text-foreground">{order.shipping_first_name} {order.shipping_last_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[order.shipping_address, order.shipping_city, order.shipping_country].filter(Boolean).join(", ")}
          </p>
        </div>
      )}

      {/* Tracking number only — supplier info hidden from clients */}
      {order.tracking_number && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("dashboard.detail.trackingInfo")}</p>
          {order.tracking_number && (
            <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2.5">
              <Truck size={14} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-muted-foreground block">{t("dashboard.detail.trackingNo")}</span>
                <span className="font-mono font-bold text-foreground">{order.tracking_number}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lot 4H — Détail du fret international (transitaire, sous-colis, mode) */}
      <FreightDetailsPanel orderId={order.id} />

      {/* Assigned rider */}
      {order.assigned_rider_name && (
        <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2.5">
          <Truck size={14} className="text-primary shrink-0" />
          <span className="text-muted-foreground">{t("dashboard.detail.rider")}</span>
          <a href="/tracking" className="font-bold text-primary hover:underline">{order.assigned_rider_name}</a>
        </div>
      )}

      {/* Confirmation code — visible to customer */}
      {order.confirmation_code && order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-2">
            {t("dashboard.detail.confirmCode.title")}
          </p>
          <p className="text-[11px] text-muted-foreground">{t("dashboard.detail.confirmCode.desc")}</p>
          <div className="bg-background border border-border rounded-lg px-4 py-3 text-center">
            <span className="font-mono font-bold text-xl tracking-[0.3em] text-primary">{order.confirmation_code}</span>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">{t("dashboard.detail.confirmCode.footer")}</p>
        </div>
      )}

      {/* Order payment proof for off-platform orders */}
      {order.payment_method === "off_platform" && order.status === "awaiting_payment" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-2.5">
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {t("dashboard.detail.offPlatform.pendingProduct")} <strong>{formatPrice(Number(order.subtotal))}</strong>
            </span>
          </div>
          <PaymentProofUpload
            orderId={order.id}
            field="shipping_payment_proof_url"
            label={t("dashboard.detail.proof.order")}
            existingUrl={order.shipping_payment_proof_url}
          />
          <p className="text-[10px] text-muted-foreground">{t("dashboard.detail.offPlatform.note")}</p>
        </div>
      )}

      {/* Delivery choice panel — shown when product arrives at hub */}
      {order.status === "shipped" && (
        <DeliveryChoicePanel order={order} />
      )}

      {/* Deferred shipping payment */}
      {order.shipping_payment_status === "deferred" && order.status !== "delivered" && order.status !== "cancelled" && order.status !== "awaiting_payment" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-2.5">
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {t("dashboard.detail.deferred.shipping")} <strong>{formatPrice(Number(order.shipping_cost || 0))}</strong>
            </span>
          </div>
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowShippingPayment("shipping")}
          >
            <CreditCard size={14} /> {t("dashboard.detail.payShipping")} ({formatPrice(Number(order.shipping_cost || 0))})
          </Button>
        </div>
      )}

      {/* Last-mile payment for home delivery */}
      {order.delivery_choice === "home_delivery" && order.last_mile_fee != null && Number(order.last_mile_fee) > 0 && order.last_mile_payment_status !== "paid" && order.last_mile_payment_status !== "paid_online" && order.last_mile_payment_status !== "paid_cash" && order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-2.5">
            <span className="text-blue-700 dark:text-blue-400 font-medium">
              {t("dashboard.detail.lastMileHome")} <strong>{formatPrice(Number(order.last_mile_fee))}</strong>
            </span>
          </div>
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowShippingPayment("last_mile")}
          >
            <CreditCard size={14} /> {t("dashboard.detail.payLastMile")} ({formatPrice(Number(order.last_mile_fee))})
          </Button>
        </div>
      )}

      {/* Delivery date/time picker — shown after last mile payment is done */}
      {order.delivery_choice === "home_delivery" && (order.last_mile_payment_status === "paid" || order.last_mile_payment_status === "paid_online") && !order.delivery_date_requested && order.status !== "delivered" && order.status !== "cancelled" && (
        <DeliveryDatePicker orderId={order.id} onSaved={() => onCancelSuccess()} />
      )}

      {/* Show scheduled delivery info */}
      {order.delivery_date_requested && (
        <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-md p-2.5">
          <span className="text-primary font-medium">
            {t("dashboard.detail.scheduled")} <strong>{new Date(order.delivery_date_requested).toLocaleDateString(dateStringLocale)}</strong>
            {order.delivery_time_requested && <> {t("dashboard.detail.scheduledAt")} <strong>{order.delivery_time_requested}</strong></>}
          </span>
        </div>
      )}

      {/* Hub photo uploaded by vendor — read-only for client */}
      {order.hub_pickup_proof_url && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            {t("dashboard.detail.hubPhoto")}
          </p>
          <DeliveryProofImage
            pathOrUrl={order.hub_pickup_proof_url}
            alt={t("dashboard.detail.hubPhotoAlt")}
            className="w-full max-w-xs rounded-lg border border-border object-cover"
          />
        </div>
      )}

      {/* Off-platform payment: client uploads proof */}
      {order.payment_method === "off_platform" && order.status === "awaiting_payment" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-2.5">
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {t("dashboard.detail.offPlatform.send")}
            </span>
          </div>
          <PaymentProofUpload
            orderId={order.id}
            field="shipping_payment_proof_url"
            label={t("dashboard.detail.proof.screenshot")}
            existingUrl={order.shipping_payment_proof_url}
          />
        </div>
      )}

      {/* Off-platform payment: waiting for vendor validation */}
      {order.payment_method === "off_platform" && order.status === "awaiting_payment" && order.shipping_payment_proof_url && (
        <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-2.5">
          <span className="text-blue-700 dark:text-blue-400 font-medium">
            {t("dashboard.detail.offPlatform.waiting")}
          </span>
        </div>
      )}

      {/* Hub pickup proof upload */}
      {order.delivery_choice === "hub_pickup" && order.status !== "delivered" && order.status !== "cancelled" && (
        <PaymentProofUpload
          orderId={order.id}
          field="hub_pickup_proof_url"
          label={t("dashboard.detail.proof.hubPickup")}
          existingUrl={order.hub_pickup_proof_url}
        />
      )}

      {/* Show chosen delivery method */}
      {order.delivery_choice && (
        <div className={`flex items-center gap-2 text-sm rounded-md p-2.5 ${
          order.delivery_choice === "home_delivery" ? "bg-blue-50 dark:bg-blue-900/20" : "bg-amber-50 dark:bg-amber-900/20"
        }`}>
          <span className="text-muted-foreground">{t("dashboard.detail.deliveryMode")}</span>
          <span className="font-bold text-foreground">
            {order.delivery_choice === "home_delivery" ? t("dashboard.detail.deliveryMode.home") : t("dashboard.detail.deliveryMode.hub")}
          </span>
          {order.last_mile_fee != null && Number(order.last_mile_fee) > 0 && order.delivery_choice === "home_delivery" && (
            <span className="text-xs text-muted-foreground">({formatPrice(Number(order.last_mile_fee))})</span>
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
          <h4 className="text-sm font-semibold text-foreground mb-2">{t("dashboard.detail.items", { count: orderItems.length })}</h4>
          <div className="space-y-2">
            {orderItems.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                {item.product_image && (
                  <img src={item.product_image} alt="" className="w-12 h-12 object-cover rounded border border-border" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.product_name}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span>{t("dashboard.detail.qty")} {item.quantity}</span>
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
                <span className="text-sm font-medium text-foreground">{formatPrice(Number(item.price) * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stepper with dates */}
      <TrackingStepper status={order.status} statusHistory={statusHistory} orderRef={order.order_ref} trackingNumber={order.tracking_number} />

      {/* Status History Timeline */}
      {statusHistory.length > 0 && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <History size={14} /> {t("dashboard.detail.history")}
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
                      {format(new Date(entry.created_at), locale === "en" ? "dd MMM yyyy 'at' HH:mm" : "dd MMM yyyy 'à' HH:mm", { locale: dateLocale })}
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
        {canRetryPayment && (
          <Button variant="default" size="sm" onClick={() => setShowRetryPayment(true)}>
            <CreditCard size={14} className="mr-1" /> {t("dashboard.detail.retryPayment")}
          </Button>
        )}
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
              if (!resp.ok) throw new Error(resp.status === 401 ? t("dashboard.invoice.sessionExpired") : t("dashboard.invoice.serverError", { status: resp.status }));
              const html = await resp.text();
              if (!html) return;
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const printWindow = window.open(url, "_blank", "width=800,height=600");
              if (printWindow) {
                printWindow.onload = () => {
                  setTimeout(() => { printWindow.print(); URL.revokeObjectURL(url); }, 500);
                };
              } else {
                URL.revokeObjectURL(url);
              }
            } catch (e) {
              toast({ title: t("dashboard.invoice.error"), description: e instanceof Error ? e.message : t("dashboard.invoice.errorDesc"), variant: "destructive" });
            }
          }}>
            <FileText size={14} className="mr-1" /> {t("dashboard.detail.downloadPdf")}
          </Button>
        )}
        {canReturn && !showReturnForm && (
          <Button variant="outline" size="sm" onClick={() => setShowReturnForm(true)}>
            <RotateCcw size={14} className="mr-1" /> {t("dashboard.detail.requestReturn")}
          </Button>
        )}
        {canDispute && !showDisputeForm && (
          <Button variant="outline" size="sm" onClick={() => setShowDisputeForm(true)}>
            <AlertTriangle size={14} className="mr-1" /> {t("dashboard.detail.openDispute")}
          </Button>
        )}
      </div>

      {/* Inline Review Section for delivered orders */}
      {order.status === "delivered" && orderItems.length > 0 && (
        <div className="border-t border-border pt-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Star size={14} className="text-primary" /> {t("dashboard.review.title")}
          </h4>
          <p className="text-xs text-muted-foreground">{t("dashboard.review.desc")}</p>
          {orderItems.filter(item => item.product_id && !existingReviews.has(item.product_id)).map(item => (
            <div key={item.id} className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-3">
                {item.product_image && (
                  <img src={item.product_image} alt="" className="w-10 h-10 object-cover rounded border border-border" />
                )}
                <p className="text-sm font-medium text-foreground">{item.product_name}</p>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className="transition-colors"
                  >
                    <Star size={20} className={star <= reviewRating ? "fill-primary text-primary" : "text-muted-foreground"} />
                  </button>
                ))}
              </div>
              <Textarea
                placeholder={t("dashboard.review.placeholder")}
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                className="text-sm min-h-[60px]"
                maxLength={1000}
              />
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                  <Camera size={14} />
                  <span>{t("dashboard.review.addPhotos")}</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleReviewImageUpload} />
                </label>
                {reviewImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {reviewImages.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-border" />
                        <button
                          onClick={() => setReviewImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                disabled={!reviewRating || reviewSubmitting}
                onClick={() => handleSubmitReview(item.product_id!)}
              >
                {reviewSubmitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Star size={14} className="mr-1" />}
                {t("dashboard.review.submit")}
              </Button>
            </div>
          ))}
          {orderItems.every(item => !item.product_id || existingReviews.has(item.product_id)) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 size={12} className="text-primary" /> {t("dashboard.review.allDone")}
            </p>
          )}
        </div>
      )}

      {/* Return Request Form */}
      {showReturnForm && (
        <ReturnRequestForm
          orderId={order.id}
          orderRef={order.order_ref}
          storeId={order.store_id}
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

      {/* Retry Payment Modal */}
      {showRetryPayment && (
        <RetryPaymentModal
          orderId={order.id}
          orderRef={order.order_ref}
          amount={Number(order.total)}
          onClose={() => setShowRetryPayment(false)}
          onSuccess={() => { setShowRetryPayment(false); onCancelSuccess(); }}
        />
      )}

      {/* Deferred Shipping / Last-Mile Payment Modal */}
      {showShippingPayment && (
        <DeferredPaymentModal
          orderId={order.id}
          orderRef={order.order_ref}
          amount={showShippingPayment === "shipping" ? Number(order.shipping_cost || 0) : Number(order.last_mile_fee || 0)}
          paymentType={showShippingPayment}
          onClose={() => setShowShippingPayment(null)}
          onSuccess={() => { setShowShippingPayment(null); onCancelSuccess(); }}
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
  const { t } = useI18n();
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
      toast({ title: t("dashboard.cancel.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("dashboard.cancel.success"), description: t("dashboard.cancel.successDesc", { ref: orderRef }) });
      onSuccess();
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {small ? (
          <button className="text-[10px] text-destructive font-medium hover:underline whitespace-nowrap">{t("dashboard.cancel.small")}</button>
        ) : (
          <Button variant="destructive" size="sm">
            <XCircle size={14} className="mr-1" /> {t("dashboard.cancel.full")}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-destructive" />
            {t("dashboard.cancel.title", { ref: orderRef })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("dashboard.cancel.desc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("dashboard.cancel.keep")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {cancelling ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            {t("dashboard.cancel.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TrackingStepper({ status, statusHistory, orderRef, trackingNumber }: { status: string; statusHistory?: StatusHistoryRow[]; orderRef?: string; trackingNumber?: string | null }) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? enUS : fr;
  const navigate = useNavigate();
  const currentIdx = getStepIndex(status);
  const isCancelled = status === "cancelled" || status === "returned";

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
  const ROW1 = CUSTOMER_TRACKING_STEPS.slice(0, 3);
  const ROW2 = CUSTOMER_TRACKING_STEPS.slice(3, 6);
  const ROW3 = CUSTOMER_TRACKING_STEPS.slice(6, 9);
  const historyMap = new Map((statusHistory || []).map((h) => [h.status, h.created_at]));

  const handleStepClick = (stepKey: string) => {
    if (!orderRef) return;
    if (stepKey === "out_for_delivery") {
      navigate(`/tracking?order=${orderRef}`);
    } else if (stepKey === "in_shipping") {
      const ref = trackingNumber || orderRef;
      navigate(`/tracking?ref=${ref}`);
    }
  };

  const isClickable = (stepKey: string, done: boolean) => {
    return done && orderRef && (stepKey === "out_for_delivery" || stepKey === "in_shipping");
  };

  const renderStep = (step: typeof CUSTOMER_TRACKING_STEPS[0], globalIdx: number, isCurrent: boolean, done: boolean) => {
    const Icon = step.icon;
    const ts = historyMap.get(step.key);
    const clickable = isClickable(step.key, done || isCurrent);
    return (
      <div
        key={step.key}
        className={`flex flex-col items-center gap-1 flex-1 min-w-0 ${clickable ? "cursor-pointer group" : ""}`}
        onClick={clickable ? () => handleStepClick(step.key) : undefined}
        title={clickable ? (step.key === "out_for_delivery" ? t("dashboard.stepper.viewRider") : t("dashboard.stepper.viewShipment")) : undefined}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
          isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/30 scale-110"
            : done ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        } ${clickable ? "group-hover:ring-2 group-hover:ring-primary/50 group-hover:scale-110" : ""}`}>
          <Icon size={18} />
        </div>
        <span className={`text-xs font-semibold text-center leading-tight px-0.5 ${
          isCurrent ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
        } ${clickable ? "group-hover:text-primary underline decoration-dotted underline-offset-2" : ""}`}>
          {step.label}
        </span>
        {ts && (
          <span className="text-[10px] text-muted-foreground leading-tight">
            {format(new Date(ts), "dd/MM HH:mm", { locale: dateLocale })}
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
  const { t, formatPrice } = useI18n();
  const { toast } = useToast();
  const [choosing, setChoosing] = useState(false);

  // Already chosen — don't show again
  if (order.delivery_choice) return null;

  const handleChoice = async (choice: "home_delivery" | "hub_pickup") => {
    setChoosing(true);
    const updates: any = { delivery_choice: choice };
    if (choice === "hub_pickup") {
      // Void delivery fees
      updates.last_mile_fee = 0;
      updates.last_mile_payment_status = null;
      updates.last_mile_payment_method = null;
    }
    const { error } = await supabase.from("orders").update(updates).eq("id", order.id);
    setChoosing(false);
    if (error) {
      toast({ title: t("dashboard.deliveryChoice.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: choice === "home_delivery" ? t("dashboard.deliveryChoice.toastHome") : t("dashboard.deliveryChoice.toastHub") });
      window.location.reload();
    }
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
      <p className="text-sm font-bold text-foreground">{t("dashboard.deliveryChoice.title")}</p>
      <p className="text-xs text-muted-foreground">{t("dashboard.deliveryChoice.desc")}</p>
      {order.last_mile_fee != null && Number(order.last_mile_fee) > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("dashboard.deliveryChoice.fee")} <strong className="text-foreground">{formatPrice(Number(order.last_mile_fee))}</strong>
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => handleChoice("home_delivery")}
          disabled={choosing}
          className="flex-1 px-3 py-2.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {choosing ? <Loader2 size={12} className="animate-spin mx-auto" /> : t("dashboard.deliveryChoice.home")}
        </button>
        <button
          onClick={() => handleChoice("hub_pickup")}
          disabled={choosing}
          className="flex-1 px-3 py-2.5 text-xs font-medium bg-card text-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          {t("dashboard.deliveryChoice.hub")}
        </button>
      </div>
    </div>
  );
}

/** Client picks delivery date & time after paying last-mile */
function DeliveryDatePicker({ orderId, onSaved }: { orderId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0]; // tomorrow

  const handleSave = async () => {
    if (!date) { toast({ title: t("dashboard.deliveryDate.required"), variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("orders").update({
      delivery_date_requested: date,
      delivery_time_requested: time || null,
    } as any).eq("id", orderId);
    setSaving(false);
    if (error) {
      toast({ title: t("dashboard.deliveryDate.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("dashboard.deliveryDate.saved") });
      onSaved();
    }
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
      <p className="text-sm font-bold text-foreground">{t("dashboard.deliveryDate.title")}</p>
      <p className="text-xs text-muted-foreground">{t("dashboard.deliveryDate.desc")}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t("dashboard.deliveryDate.date")}</label>
          <input type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg" style={{ fontSize: "16px" }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{t("dashboard.deliveryDate.time")}</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg" style={{ fontSize: "16px" }} />
        </div>
      </div>
      <Button size="sm" className="w-full gap-2" onClick={handleSave} disabled={saving || !date}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
        {t("dashboard.deliveryDate.confirm")}
      </Button>
    </div>
  );
}

/** Client enters confirmation code for hub pickup */
function ConfirmationCodeEntry({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-confirmation-code", {
        body: { order_id: orderId, code: code.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.retry_after) {
          toast({ title: t("dashboard.confirm.tooManyAttempts"), description: t("dashboard.confirm.retryIn", { seconds: data.retry_after }), variant: "destructive" });
        } else {
          toast({ title: t("dashboard.confirm.wrongCode"), description: data.error, variant: "destructive" });
        }
      } else if (data?.success) {
        toast({ title: t("dashboard.confirm.success"), description: t("dashboard.confirm.successDesc") });
        onSuccess();
      }
    } catch (e: any) {
      toast({ title: t("dashboard.confirm.errorTitle"), description: e.message || t("dashboard.confirm.errorDesc"), variant: "destructive" });
    }
    setVerifying(false);
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
      <p className="text-sm font-bold text-foreground">{t("dashboard.confirm.title")}</p>
      <p className="text-xs text-muted-foreground">{t("dashboard.confirm.desc")}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder={t("dashboard.confirm.placeholder")}
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
          {t("dashboard.confirm.verify")}
        </button>
      </div>
    </div>
  );
}

function TrackingTab({ orders }: { orders: OrderRow[] }) {
  const { t } = useI18n();
  const activeOrders = orders.filter(o => !["delivered", "cancelled", "returned"].includes(o.status));
  if (activeOrders.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t("dashboard.trackingTab.empty")}</p>;
  }
  return (
    <div className="space-y-4">
      {activeOrders.map(order => (
        <div key={order.id} className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-foreground">{order.order_ref}</span>
          </div>
          <TrackingStepper status={order.status} orderRef={order.order_ref} trackingNumber={order.tracking_number} />
          <CustomerOrderTracker orderId={order.id} />
        </div>
      ))}
    </div>
  );
}

function ProfileTab({ user, onProfileUpdated }: { user: any; onProfileUpdated?: () => Promise<void> | void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({ first_name: "", last_name: "", phone: "", avatar_url: "", gender: "", date_of_birth: "", nationality: "", residence_address: "", residence_city: "", residence_country: "", residence_province: "", residence_province_id: "", residence_commune: "", residence_quartier: "", preferred_language: "fr", preferred_contact_channel: "chat", allowed_channels: ["chat", "email"] });
  const [hasActiveOrders, setHasActiveOrders] = useState(false);
  const [addressChangeRequestPending, setAddressChangeRequestPending] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Check for active orders (locks residence address)
  useEffect(() => {
    supabase.from("orders").select("id").eq("user_id", user.id)
      .in("status", ["pending", "confirmed", "processing", "shipped", "ready_for_pickup"])
      .limit(1).then(({ data }) => setHasActiveOrders((data ?? []).length > 0));
    // Check pending address change request
    (supabase as any).from("address_change_requests").select("id").eq("user_id", user.id).eq("status", "pending")
      .limit(1).then(({ data }: any) => setAddressChangeRequestPending((data ?? []).length > 0));
  }, [user.id]);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        const d = data as any;
        setProfile({
          first_name: d.first_name || "",
          last_name: d.last_name || "",
          phone: d.phone || "",
          avatar_url: d.avatar_url || "",
          gender: d.gender || "",
          date_of_birth: d.date_of_birth || "",
          nationality: d.nationality || "",
          residence_address: d.residence_address || "",
          residence_city: d.residence_city || "",
          residence_country: d.residence_country || "",
          residence_province: d.residence_province || "",
          residence_province_id: d.residence_province_id || "",
          residence_commune: d.residence_commune || "",
          residence_quartier: d.residence_quartier || "",
          preferred_language: d.preferred_language || "fr",
          preferred_contact_channel: d.preferred_contact_channel || "chat",
          allowed_channels: d.allowed_channels || ["chat", "email"],
        });
      }
      setLoading(false);
    });
  }, [user.id]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      first_name: profile.first_name || null,
      last_name: profile.last_name || null,
      phone: profile.phone || null,
      avatar_url: profile.avatar_url || null,
      gender: profile.gender || null,
      date_of_birth: profile.date_of_birth || null,
      nationality: profile.nationality || null,
      residence_address: profile.residence_address || null,
      residence_city: profile.residence_city || null,
      residence_country: profile.residence_country || null,
      residence_province: profile.residence_province || null,
      residence_province_id: profile.residence_province_id || null,
      residence_commune: profile.residence_commune || null,
      residence_quartier: profile.residence_quartier || null,
      preferred_language: profile.preferred_language || 'fr',
      preferred_contact_channel: profile.preferred_contact_channel || 'chat',
      allowed_channels: profile.allowed_channels.length > 0 ? profile.allowed_channels : ["chat", "email"],
    };
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      const updated = data as any;
      setProfile({
        first_name: updated.first_name || "",
        last_name: updated.last_name || "",
        phone: updated.phone || "",
        avatar_url: updated.avatar_url || "",
        gender: updated.gender || "",
        date_of_birth: updated.date_of_birth || "",
        nationality: updated.nationality || "",
        residence_address: updated.residence_address || "",
        residence_city: updated.residence_city || "",
        residence_country: updated.residence_country || "",
        residence_province: updated.residence_province || "",
        residence_province_id: updated.residence_province_id || "",
        residence_commune: updated.residence_commune || "",
        residence_quartier: updated.residence_quartier || "",
          preferred_language: updated.preferred_language || "fr",
          preferred_contact_channel: updated.preferred_contact_channel || "chat",
          allowed_channels: updated.allowed_channels || ["chat", "email"],
        });
      await supabase.auth.updateUser({
        data: {
          first_name: updated.first_name || null,
          last_name: updated.last_name || null,
          full_name: [updated.first_name, updated.last_name].filter(Boolean).join(" ") || null,
        },
      });
      await onProfileUpdated?.();
      toast({ title: "Profil mis à jour !" });
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword) {
      toast({ title: "Erreur", description: "Veuillez saisir votre mot de passe actuel.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 8 caractères.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    // Verify current password by re-authenticating
    const email = user.email;
    if (!email) {
      toast({ title: "Erreur", description: "Adresse email introuvable.", variant: "destructive" });
      setChangingPassword(false);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      toast({ title: "Erreur", description: "Le mot de passe actuel est incorrect.", variant: "destructive" });
      setChangingPassword(false);
      return;
    }
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
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("product-media").upload(path, compressed, { upsert: true, cacheControl: "31536000" });
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
            <Input className="mt-1" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+243 XXX XXX XXX" />
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
          <div>
            <Label className="text-xs text-muted-foreground">Nationalité</Label>
            <Input className="mt-1" value={profile.nationality} onChange={e => setProfile(p => ({ ...p, nationality: e.target.value }))} placeholder="Ex: Congolaise" />
          </div>
          {/* Residence address - cascading geo fields */}
          {hasActiveOrders && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span>Votre adresse de résidence est verrouillée car vous avez des commandes en cours. Vous pouvez soumettre une demande de modification.</span>
            </div>
          )}
          {addressChangeRequestPending && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-primary flex items-center gap-2">
              <Clock size={14} className="shrink-0" />
              <span>Une demande de modification d'adresse est en attente de validation.</span>
            </div>
          )}
          <CascadingAddressFields
            data={{
              country: profile.residence_country,
              province: profile.residence_province,
              province_id: profile.residence_province_id,
              city: profile.residence_city,
              commune: profile.residence_commune,
              quartier: profile.residence_quartier,
              address: profile.residence_address,
              postal_code: "",
            }}
            onChange={(field, value) => {
              if (hasActiveOrders) return; // locked
              const fieldMap: Record<string, keyof ProfileData> = {
                country: "residence_country",
                province: "residence_province",
                province_id: "residence_province_id",
                city: "residence_city",
                commune: "residence_commune",
                quartier: "residence_quartier",
                address: "residence_address",
              };
              const profileField = fieldMap[field];
              if (profileField) setProfile(p => ({ ...p, [profileField]: value }));
            }}
            showPostalCode={false}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Langue préférée</Label>
              <select
                className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-md bg-card"
                value={profile.preferred_language}
                onChange={e => setProfile(p => ({ ...p, preferred_language: e.target.value }))}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="ln">Lingala</option>
                <option value="sw">Swahili</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Canaux de contact</Label>
            <div className="space-y-2">
              {[
                { value: "chat", label: "Chat interne", mandatory: true },
                { value: "email", label: "Email", mandatory: true },
                { value: "whatsapp", label: "WhatsApp", mandatory: false },
                { value: "sms", label: "SMS", mandatory: false },
              ].map(ch => {
                const checked = profile.allowed_channels.includes(ch.value);
                return (
                  <label key={ch.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={ch.mandatory}
                      className="accent-primary h-4 w-4 rounded border-border"
                      onChange={() => {
                        if (ch.mandatory) return;
                        setProfile(p => ({
                          ...p,
                          allowed_channels: checked
                            ? p.allowed_channels.filter(c => c !== ch.value)
                            : [...p.allowed_channels, ch.value],
                        }));
                      }}
                    />
                    <span className="text-foreground">{ch.label}</span>
                    {ch.mandatory && <span className="text-[10px] text-muted-foreground">(obligatoire)</span>}
                  </label>
                );
              })}
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
            <Label className="text-xs text-muted-foreground">Mot de passe actuel</Label>
            <Input type="password" className="mt-1" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Entrez votre mot de passe actuel" />
          </div>
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
          <Button onClick={handlePasswordChange} disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword} variant="outline" className="mt-2">
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
  const [form, setForm] = useState({ label: "", first_name: "", last_name: "", phone: "", address: "", quartier: "", commune: "", city: "", province: "", province_id: "", country: "CD", postal_code: "" });
   const [saving, setSaving] = useState(false);
  const [isKycVerified, setIsKycVerified] = useState(false);
  const [hasActiveOrders, setHasActiveOrders] = useState(false);

  const maxAddresses = isKycVerified ? 5 : 2;

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("saved_addresses").select("*").eq("user_id", userId).order("is_default", { ascending: false });
    setAddresses((data || []) as unknown as SavedAddress[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  // Check KYC status + active orders
  useEffect(() => {
    (supabase as any).from("kyc_verifications").select("id").eq("user_id", userId).eq("status", "approved").limit(1).then(({ data }: any) => {
      setIsKycVerified((data ?? []).length > 0);
    });
    supabase.from("orders").select("id").eq("user_id", userId)
      .in("status", ["pending", "confirmed", "processing", "shipped", "ready_for_pickup"])
      .limit(1).then(({ data }) => setHasActiveOrders((data ?? []).length > 0));
  }, [userId]);

  const resetForm = () => {
    setForm({ label: "", first_name: "", last_name: "", phone: "", address: "", quartier: "", commune: "", city: "", province: "", province_id: "", country: "CD", postal_code: "" });
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
      quartier: addr.quartier || "",
      commune: addr.commune || "",
      city: addr.city,
      province: (addr as any).province || "",
      province_id: "",
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
    // Exclude province_id from DB payload (used only for cascading UI)
    const { province_id, ...rest } = form;
    const payload = { ...rest, postal_code: rest.postal_code || null, commune: rest.commune || null, quartier: rest.quartier || null, province: rest.province || null };
    let error: any = null;
    if (editId) {
      const res = await supabase.from("saved_addresses").update(payload as any).eq("id", editId);
      error = res.error;
    } else {
      const res = await supabase.from("saved_addresses").insert({
        user_id: userId,
        ...payload,
        is_default: addresses.length === 0,
      } as any);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      console.error("[AddressesTab] save error:", error);
      toast({ title: "Erreur", description: "Impossible d'enregistrer l'adresse. Réessayez.", variant: "destructive" });
      return;
    }
    resetForm();
    await fetchAddresses();
    toast({ title: editId ? "Adresse modifiée !" : "Adresse ajoutée !" });
  };

  const handleDelete = async (id: string) => {
    const addr = addresses.find(a => a.id === id);
    if (addr && ((addr as any).is_first_address || addr.is_default)) {
      toast({ title: "Action impossible", description: "L'adresse par défaut ne peut pas être supprimée, uniquement modifiée.", variant: "destructive" });
      return;
    }
    if (hasActiveOrders) {
      toast({ title: "Action impossible", description: "Vous ne pouvez pas supprimer une adresse tant que vous avez des commandes en cours.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("saved_addresses").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message?.includes("default") ? "Impossible de supprimer l'adresse par défaut." : "Impossible de supprimer cette adresse.", variant: "destructive" });
      return;
    }
    await fetchAddresses();
    toast({ title: "Adresse supprimée" });
  };

  const handleSetDefault = async (id: string) => {
    // Trigger handles unsetting other defaults automatically
    await supabase.from("saved_addresses").update({ is_default: true } as any).eq("id", id);
    await fetchAddresses();
    toast({ title: "Adresse par défaut mise à jour" });
  };

  const labelIcons: Record<string, React.ReactNode> = {
    "Domicile": <Home size={14} />,
    "Bureau": <Briefcase size={14} />,
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4 max-w-xl">
      {hasActiveOrders && (
        <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span>Vous avez des commandes en cours. La modification et la suppression des adresses de livraison sont temporairement bloquées.</span>
        </div>
      )}
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
              <p className="text-xs text-muted-foreground">{addr.address}{addr.quartier ? `, Q. ${addr.quartier}` : ""}{addr.commune ? `, C. ${addr.commune}` : ""}, {addr.city}{(addr as any).province ? `, ${(addr as any).province}` : ""}, {addr.country}</p>
              <p className="text-xs text-muted-foreground">{addr.phone}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!addr.is_default && !hasActiveOrders && (
                <button onClick={() => handleSetDefault(addr.id)} className="text-[11px] text-primary font-medium hover:underline">
                  Par défaut
                </button>
              )}
              <button onClick={() => handleEdit(addr)} disabled={hasActiveOrders} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed">
                <Edit2 size={14} />
              </button>
              {!(addr as any).is_first_address && !addr.is_default && !hasActiveOrders && (
                <button onClick={() => handleDelete(addr.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 size={14} />
                </button>
              )}
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
              <Input className="mt-1" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Domicile 1, Bureau..." />
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
            <Input className="mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+243 XXX XXX XXX" />
          </div>
          <div>
            <Label className="text-xs">Adresse *</Label>
            <Input className="mt-1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="N° parcelle, N° appartement, Avenue/Rue" />
          </div>
          <CascadingAddressFields
            data={{
              country: form.country,
              province: form.province,
              province_id: form.province_id,
              city: form.city,
              commune: form.commune,
              quartier: form.quartier,
              address: form.address,
              postal_code: form.postal_code,
            }}
            onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
          />
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
            {editId ? "Modifier" : "Ajouter"}
          </Button>
        </div>
      )}

      {!showForm && addresses.length < maxAddresses && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="w-full py-3 text-sm font-medium border border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Ajouter une adresse ({addresses.length}/{maxAddresses})
        </button>
      )}
      {!showForm && addresses.length >= maxAddresses && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Limite atteinte ({maxAddresses} adresses). {!isKycVerified && "Vérifiez votre identité pour en ajouter jusqu'à 5."}
        </p>
      )}
    </div>
  );
}

function ClientCertificationSection() {
  const { isCertified, canCertify, isLoading, toggleCertification, isToggling } = useCertification();

  if (isLoading) return null;
  if (!canCertify) return null;

  return (
    <div className="bg-card rounded-lg p-5 border border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CertificationBadge type="client" variant="full" />
        </div>
        <Switch
          checked={isCertified}
          onCheckedChange={toggleCertification}
          disabled={isToggling}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Activez votre badge de certification pour afficher un symbole de confiance vérifié à côté de votre nom sur la plateforme.
      </p>
    </div>
  );
}
