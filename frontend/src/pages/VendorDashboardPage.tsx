import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/utils/image-compress";
import { InternalChat } from "@/components/InternalChat";
import { VendorPlatformClaimBanner } from "@/components/vendor/VendorPlatformClaimBanner";
import { VendorProductManager } from "@/components/VendorProductManager";
import { VendorFeaturedRequestTab } from "@/components/vendor/VendorFeaturedRequestTab";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { VendorOrderManager } from "@/components/vendor/VendorOrderManager";
import { VendorStatsTab } from "@/components/vendor/VendorStatsTab";
import { VendorPromotionsTab } from "@/components/vendor/VendorPromotionsTab";
import { VendorCouponsTab } from "@/components/vendor/VendorCouponsTab";
import { VendorCouponAnalytics } from "@/components/vendor/VendorCouponAnalytics";
import { VendorWalletTab } from "@/components/vendor/VendorWalletTab";
import { VendorReturnsTab } from "@/components/vendor/VendorReturnsTab";
import { VendorDisputesTab } from "@/components/vendor/VendorDisputesTab";
import { VendorRiderTracking } from "@/components/vendor/VendorRiderTracking";
import { VendorTeamTab } from "@/components/vendor/VendorTeamTab";
import { VendorPaymentNumbers } from "@/components/vendor/VendorPaymentNumbers";
import { VendorSuppliersTab } from "@/components/vendor/VendorSuppliersTab";
import { toast } from "sonner";
import {
  Store, MessageCircle, Loader2, ChevronLeft, Package, Users, Inbox, ShoppingBag, BarChart3,
  Settings, Phone, Save, Clock, XCircle, Send, Crown, Flame, Ticket, Wallet, RotateCcw, AlertTriangle, Globe, Bike, Sparkles, Truck,
} from "lucide-react";
import { useVendorSubscription } from "@/hooks/use-vendor-subscription";
import { ACTIVE_ORDER_STATUSES, NON_REVENUE_ORDER_STATUSES } from "@/lib/order-status";
import { VENDOR_TIERS } from "@/lib/vendor-tiers";
import { useStorePresence } from "@/hooks/useStorePresence";
import { useStoreCertification } from "@/hooks/use-certification";
import { CertificationBadge } from "@/components/CertificationBadge";
import { Switch } from "@/components/ui/switch";

interface VendorConversation {
  id: string;
  user_id: string;
  product_id: string | null;
  updated_at: string;
  customer_email: string | null;
  product_name: string | null;
  last_message: string | null;
  unread_count: number;
}

interface VendorStore {
  id: string;
  name: string;
  logo_url: string | null;
  products_count: number | null;
  followers_count: number | null;
  whatsapp_number: string | null;
  pending_name: string | null;
  name_change_status: string | null;
  can_create_coupons: boolean;
  collaborators_enabled: boolean;
  is_suspended?: boolean;
  is_banned?: boolean;
  suspension_reason?: string | null;
  ban_reason?: string | null;
  suspended_activities?: string[];
}

interface OrderCounters {
  total: number;
  in_progress: number;
  delivered: number;
}

export default function VendorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<VendorStore | null>(null);
  const [conversations, setConversations] = useState<VendorConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [noStore, setNoStore] = useState(false);
  const [selectedConv, setSelectedConv] = useState<VendorConversation | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"messages" | "catalogue" | "orders" | "deliveries" | "promos" | "coupons" | "wallet" | "returns" | "disputes" | "featured" | "stats" | "team" | "suppliers" | "settings">("catalogue");
  const [orderCounters, setOrderCounters] = useState<OrderCounters>({ total: 0, in_progress: 0, delivered: 0 });
  const [suppliersEnabled, setSuppliersEnabled] = useState(false);

  // Presence heartbeat — marks store as online while vendor is on dashboard
  useStorePresence(store?.id);

  // Realtime channel ref for cleanup
  const hasLoadedRef = useRef(false);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      navigate("/auth");
      return;
    }

    if (hasLoadedRef.current && store) {
      return;
    }

    let storeIdForRealtime: string | null = null;

    async function fetchOrderCounters(storeId: string) {
      const [totalRes, activeRes, deliveredRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId).not("status", "in", `(${NON_REVENUE_ORDER_STATUSES.map((status) => `"${status}"`).join(",")})`),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId).in("status", [...ACTIVE_ORDER_STATUSES]),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "delivered"),
      ]);
      setOrderCounters({
        total: totalRes.count || 0,
        in_progress: activeRes.count || 0,
        delivered: deliveredRes.count || 0,
      });
    }

    async function loadVendorData() {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }

      // Find store owned by user
      const { data: storeData } = await (supabase as any)
        .from("stores")
        .select("id, name, logo_url, products_count, followers_count, whatsapp_number, pending_name, name_change_status, can_create_coupons, collaborators_enabled, is_suspended, is_banned, suspension_reason, ban_reason, suspended_activities")
        .eq("owner_id", user!.id)
        .maybeSingle();

      if (!storeData) {
        setNoStore(true);
        setLoading(false);
        return;
      }

      setStore(storeData);
      storeIdForRealtime = storeData.id;

      // Load suppliers_enabled from vendor_pricing_overrides
      const { data: overrideData } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("suppliers_enabled")
        .eq("store_id", storeData.id)
        .maybeSingle();
      setSuppliersEnabled(overrideData?.suppliers_enabled ?? false);

      // Load order counters
      await fetchOrderCounters(storeData.id);

      // Load conversations for this store
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, user_id, product_id, updated_at")
        .eq("store_id", storeData.id)
        .order("updated_at", { ascending: false });

      if (!convs || convs.length === 0) {
        setConversations([]);
        setLoading(false);
        hasLoadedRef.current = true;
        setupRealtime(storeData.id);
        return;
      }

      // Fetch customer profiles and product names
      const userIds = [...new Set(convs.map((c) => c.user_id))];
      const productIds = convs.map((c) => c.product_id).filter(Boolean) as string[];

      const [profilesRes, productsRes] = await Promise.all([
        supabase.from("profiles").select("id, email").in("id", userIds),
        productIds.length > 0
          ? supabase.from("products").select("id, name_fr").in("id", productIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));
      const productMap = new Map((productsRes.data || []).map((p) => [p.id, p]));

      const items: VendorConversation[] = [];

      for (const conv of convs) {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_id", user!.id);

        const profile = profileMap.get(conv.user_id);
        const product = conv.product_id ? productMap.get(conv.product_id) : null;

        items.push({
          id: conv.id,
          user_id: conv.user_id,
          product_id: conv.product_id,
          updated_at: conv.updated_at,
          customer_email: profile?.email || "Client",
          product_name: product?.name_fr || null,
          last_message: lastMsg?.content || null,
          unread_count: count || 0,
        });
      }

      setConversations(items);
      setLoading(false);
      hasLoadedRef.current = true;
      setupRealtime(storeData.id);
    }

    function setupRealtime(storeId: string) {
      // Clean previous channel
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }

      const channel = supabase
        .channel(`vendor-dashboard-${storeId}`)
        // Products changes → update count
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products', filter: `store_id=eq.${storeId}` },
          async () => {
            const { count } = await supabase
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("store_id", storeId);
            setStore(prev => prev ? { ...prev, products_count: count || 0 } : prev);
          }
        )
        // Orders changes → toast + refresh counters
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
          async (payload) => {
            if (payload.eventType === 'INSERT') {
              toast.success(`Nouvelle commande : ${(payload.new as any).order_ref}`);
            }
            await fetchOrderCounters(storeId);
          }
        )
        // Messages changes → update unread counts
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload) => {
            const msg = payload.new as any;
            if (msg.sender_id === user!.id) return;
            // Check if conversation belongs to this store
            const { data: conv } = await supabase
              .from("conversations")
              .select("id")
              .eq("id", msg.conversation_id)
              .eq("store_id", storeId)
              .maybeSingle();
            if (conv) {
              setConversations(prev =>
                prev.map(c =>
                  c.id === msg.conversation_id
                    ? { ...c, unread_count: c.unread_count + 1, last_message: msg.content }
                    : c
                )
              );
            }
          }
        )
        // Store name changes → sync
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` },
          (payload) => {
            const updated = payload.new as any;
            setStore(prev => prev ? {
              ...prev,
              name: updated.name,
              pending_name: updated.pending_name,
              name_change_status: updated.name_change_status,
            } : prev);
          }
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    }

    loadVendorData();

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, navigate]);

  const openChat = (conv: VendorConversation) => {
    setSelectedConv(conv);
    setChatOpen(true);
    if (conv.unread_count > 0) {
      supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conv.id)
        .neq("sender_id", user!.id)
        .eq("is_read", false)
        .then(() => {
          setConversations((prev) =>
            prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
          );
        });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!user) return null;

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  const VENDOR_TABS = [
    { key: "catalogue" as const, label: "Catalogue", icon: Package },
    { key: "orders" as const, label: "Commandes", icon: ShoppingBag },
    { key: "deliveries" as const, label: "Livraisons", icon: Bike },
    { key: "promos" as const, label: "Promos", icon: Flame },
    { key: "coupons" as const, label: "Coupons", icon: Crown },
    { key: "wallet" as const, label: "Wallet", icon: Wallet },
    { key: "returns" as const, label: "Retours", icon: RotateCcw },
    { key: "disputes" as const, label: "Litiges", icon: AlertTriangle },
    { key: "featured" as const, label: "Mise en avant", icon: Sparkles },
    ...(suppliersEnabled ? [{ key: "suppliers" as const, label: "Fournisseurs", icon: Truck }] : []),
    { key: "stats" as const, label: "Statistiques", icon: BarChart3 },
    ...(store?.collaborators_enabled ? [{ key: "team" as const, label: "Équipe", icon: Users }] : []),
    { key: "messages" as const, label: "Messages", icon: MessageCircle },
    { key: "settings" as const, label: "Paramètres", icon: Settings },
  ];

  const renderTabContent = () => (
    <>
      {activeTab === "catalogue" && <VendorProductManager storeId={store!.id} suppliersEnabled={suppliersEnabled} />}
      {activeTab === "orders" && <VendorOrderManager storeId={store!.id} shopType={(store as any)?.shop_type} suppliersEnabled={suppliersEnabled} />}
      {activeTab === "deliveries" && <VendorRiderTracking storeId={store!.id} />}
      {activeTab === "promos" && <VendorPromotionsTab storeId={store!.id} />}
      {activeTab === "coupons" && (
        <div className="space-y-6">
          {store?.can_create_coupons ? (
            <>
              <VendorCouponsTab storeId={store!.id} />
              <div className="border-t border-border pt-4">
                <h3 className="text-base font-bold text-foreground mb-3">📊 Analytics Coupons</h3>
                <VendorCouponAnalytics storeId={store!.id} />
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-2">
              <Ticket size={40} className="mx-auto text-muted-foreground/20" />
              <p className="text-sm font-medium text-foreground">Coupons non activés</p>
              <p className="text-xs text-muted-foreground">Contactez l'administration pour activer la création de coupons pour votre boutique.</p>
            </div>
          )}
        </div>
      )}
      {activeTab === "wallet" && <VendorWalletTab storeId={store!.id} />}
      {activeTab === "returns" && <VendorReturnsTab storeId={store!.id} />}
      {activeTab === "disputes" && <VendorDisputesTab storeId={store!.id} />}
      {activeTab === "featured" && <VendorFeaturedRequestTab storeId={store!.id} />}
      {activeTab === "suppliers" && <VendorSuppliersTab storeId={store!.id} />}
      {activeTab === "stats" && <VendorStatsTab storeId={store!.id} />}
      {activeTab === "team" && <VendorTeamTab storeId={store!.id} />}
      {activeTab === "messages" && (
        <>
          {conversations.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <MessageCircle size={40} className="mx-auto text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Aucun message reçu pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => openChat(conv)}
                  className="w-full bg-card border border-border rounded-lg p-4 flex items-center gap-3 text-left hover:border-primary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Users size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {conv.customer_email}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    {conv.product_name && (
                      <p className="text-[11px] text-primary truncate">{conv.product_name}</p>
                    )}
                    {conv.last_message && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(conv.updated_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {activeTab === "settings" && store && (
        <VendorSettings store={store} onUpdate={(updated) => setStore(updated)} />
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : noStore ? (
          <div className="text-center py-16 space-y-3">
            <Store size={48} className="mx-auto text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Vous n'avez pas encore de boutique.</p>
            <p className="text-xs text-muted-foreground">
              Contactez l'administration pour créer votre espace vendeur.
            </p>
            <button
              onClick={() => navigate("/become-vendor")}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Demander une boutique
            </button>
          </div>
        ) : (
          <>
            {/* ═══ DESKTOP LAYOUT: Sidebar + Content ═══ */}
            <div className="hidden lg:flex gap-6">
              {/* Sidebar */}
              <nav className="w-56 shrink-0">
                <div className="sticky top-20 space-y-4">
                  {/* Store identity */}
                  <div className="bg-card border border-border rounded-lg p-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-2 overflow-hidden border-2 border-border">
                      {store?.logo_url ? (
                        <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary flex items-center justify-center">
                          <Store size={22} className="text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">{store?.name}</p>
                    <VendorTierBadge storeId={store!.id} />
                  </div>

                  {/* Navigation items */}
                  <div className="bg-card border border-border rounded-lg py-1">
                    <button
                      onClick={() => navigate("/dashboard")}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <ChevronLeft size={16} />
                      Mon espace
                    </button>
                    <div className="h-px bg-border mx-3" />
                    {VENDOR_TABS.map(tab => {
                      const isActive = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <tab.icon size={16} />
                          {tab.label}
                          {tab.key === "messages" && totalUnread > 0 && (
                            <span className="ml-auto w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                              {totalUnread}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </nav>

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Platform claim banner */}
                <VendorPlatformClaimBanner storeId={store!.id} userId={user!.id} storeName={store!.name} />

                {/* Store suspension/ban banner */}
                {store?.is_banned && (
                  <div className="p-4 rounded-lg border border-destructive bg-destructive/5">
                    <div className="flex items-center gap-2 text-destructive font-semibold text-sm mb-1">
                      <Ban size={16} /> Boutique bannie
                    </div>
                    <p className="text-xs text-muted-foreground">{store.ban_reason || "Votre boutique a été bannie pour violation des conditions d'utilisation."}</p>
                    <p className="text-xs text-muted-foreground mt-1">Contactez le support pour plus d'informations.</p>
                  </div>
                )}
                {store?.is_suspended && !store?.is_banned && (
                  <div className="p-4 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/10">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm mb-1">
                      <AlertTriangle size={16} /> Boutique suspendue
                    </div>
                    <p className="text-xs text-muted-foreground">{store.suspension_reason || "Certaines activités de votre boutique sont temporairement suspendues."}</p>
                    {store.suspended_activities && store.suspended_activities.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Activités bloquées : {store.suspended_activities.join(", ")}</p>
                    )}
                  </div>
                )}

                {/* KPI Widgets — always visible */}
                <VendorSummaryWidgets store={store!} orderCounters={orderCounters} totalUnread={totalUnread} storeId={store!.id} />

                {/* Tab content */}
                {renderTabContent()}
              </div>
            </div>

            {/* ═══ MOBILE LAYOUT: Classic pills ═══ */}
            <div className="lg:hidden space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
                  <ChevronLeft size={20} />
                </button>
                <h1 className="text-xl font-bold text-foreground">Tableau de bord vendeur</h1>
              </div>

              {/* Summary widgets */}
              <VendorSummaryWidgets store={store!} orderCounters={orderCounters} totalUnread={totalUnread} storeId={store!.id} />

              {/* Platform claim banner */}
              <VendorPlatformClaimBanner storeId={store!.id} userId={user!.id} storeName={store!.name} />

              {/* Horizontal scrollable tabs */}
              <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                {VENDOR_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap border transition-all ${
                      activeTab === tab.key
                        ? "bg-foreground text-card border-foreground"
                        : "bg-card text-foreground border-border hover:border-foreground"
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                    {tab.key === "messages" && totalUnread > 0 && (
                      <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                        {totalUnread}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {renderTabContent()}
            </div>
          </>
        )}
      </main>

      {/* Chat Sheet */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="p-0 w-full sm:max-w-md flex flex-col">
          {selectedConv && store && (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <MessageCircle size={18} className="text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedConv.customer_email}
                  </p>
                  {selectedConv.product_name && (
                    <p className="text-[11px] text-muted-foreground truncate">{selectedConv.product_name}</p>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <InternalChat
                  storeId={store.id}
                  storeName={store.name}
                  productId={selectedConv.product_id || undefined}
                  productName={selectedConv.product_name || undefined}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Footer />
    </div>
  );
}

/** Small badge component showing vendor tier */
function VendorTierBadge({ storeId }: { storeId: string }) {
  const { tierConfig } = useVendorSubscription(storeId);
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 mt-1 ${tierConfig.badgeClass}`}>
      <Crown size={8} />
      {tierConfig.label}
    </span>
  );
}

/** Compact summary widgets for vendor dashboard */
function VendorSummaryWidgets({
  store,
  orderCounters,
  totalUnread,
  storeId,
}: {
  store: VendorStore;
  orderCounters: OrderCounters;
  totalUnread: number;
  storeId: string;
}) {
  const { subscription, tierConfig } = useVendorSubscription(storeId);

  // Today's sales and pending orders
  const { data: todayStats } = useQuery({
    queryKey: ["vendor-today-stats", storeId],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [salesRes, pendingRes] = await Promise.all([
        supabase
          .from("orders")
          .select("total")
          .eq("store_id", storeId)
          .gte("created_at", todayISO)
          .not("status", "in", '("cancelled","payment_failed","refunded")'),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .in("status", ["pending", "confirmed"]),
      ]);

      const todaySales = (salesRes.data || []).reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
      return { todaySales, pendingCount: pendingRes.count || 0 };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-3 mb-6">
      {/* Today's highlight row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-emerald-600" />
            <span className="text-[11px] text-muted-foreground font-medium">Ventes du jour</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">${(todayStats?.todaySales || 0).toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-amber-600" />
            <span className="text-[11px] text-muted-foreground font-medium">En attente</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{todayStats?.pendingCount || 0}</p>
          <p className="text-[10px] text-muted-foreground">commandes à traiter</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Store card with tier badge */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Store size={16} className="text-primary shrink-0" />
            <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
          </div>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${tierConfig.badgeClass}`}>
            <Crown size={8} />
            {tierConfig.label}
          </span>
        </div>

        {/* Products */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-primary shrink-0" />
            <p className="text-xl font-bold text-foreground leading-none">{store.products_count || 0}</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Produits
            {subscription && subscription.max_products < Infinity && (
              <span className="text-muted-foreground/60"> / {subscription.max_products}</span>
            )}
          </p>
        </div>

        {/* Orders */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-primary shrink-0" />
            <p className="text-xl font-bold text-foreground leading-none">{orderCounters.total}</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Commandes
            {orderCounters.in_progress > 0 && (
              <span className="text-primary"> · {orderCounters.in_progress} en cours</span>
            )}
          </p>
        </div>

        {/* Messages */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-primary shrink-0" />
            <p className={`text-xl font-bold leading-none ${totalUnread > 0 ? "text-primary" : "text-foreground"}`}>
              {totalUnread > 0 ? totalUnread : 0}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {totalUnread > 0 ? "Non lu(s)" : "Messages"}
          </p>
        </div>
      </div>
    </div>
  );
}



function VendorSettings({ store, onUpdate }: { store: VendorStore; onUpdate: (s: VendorStore) => void }) {
  const [whatsapp, setWhatsapp] = useState(store.whatsapp_number || "");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [submittingName, setSubmittingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(store.logo_url || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // SEO fields
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [seoLoading, setSeoLoading] = useState(true);

  useEffect(() => {
    // Load banner_url + SEO
    (supabase as any)
      .from("stores")
      .select("meta_title, meta_description, seo_keywords, banner_url")
      .eq("id", store.id)
      .single()
      .then(({ data }: any) => {
        if (data) {
          setSeoTitle(data.meta_title || "");
          setSeoDesc(data.meta_description || "");
          setSeoKeywords((data.seo_keywords || []).join(", "));
          setBannerPreview(data.banner_url || null);
        }
        setSeoLoading(false);
      });
  }, [store.id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format accepté : JPG, PNG ou WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La photo de profil ne doit pas dépasser 2 Mo");
      return;
    }
    setUploadingLogo(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop();
      const path = `${store.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-media").upload(path, compressed, { upsert: true });
      if (upErr) { toast.error("Erreur upload logo"); return; }
      const { data: urlData } = supabase.storage.from("product-media").getPublicUrl(path);
      const url = urlData.publicUrl;
      await supabase.from("stores").update({ logo_url: url } as any).eq("id", store.id);
      setLogoPreview(url);
      onUpdate({ ...store, logo_url: url });
      toast.success("Photo de profil mise à jour");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format accepté : JPG, PNG ou WebP");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("La bannière ne doit pas dépasser 3 Mo");
      return;
    }
    setUploadingBanner(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop();
      const path = `${store.id}/banner-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-media").upload(path, compressed, { upsert: true });
      if (upErr) { toast.error("Erreur upload bannière"); return; }
      const { data: urlData } = supabase.storage.from("product-media").getPublicUrl(path);
      const url = urlData.publicUrl;
      await (supabase as any).from("stores").update({ banner_url: url }).eq("id", store.id);
      setBannerPreview(url);
      toast.success("Bannière mise à jour");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const keywords = seoKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    const { error } = await supabase
      .from("stores")
      .update({
        whatsapp_number: whatsapp.trim() || null,
        meta_title: seoTitle.trim() || null,
        meta_description: seoDesc.trim() || null,
        seo_keywords: keywords.length > 0 ? keywords : null,
      })
      .eq("id", store.id);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Paramètres mis à jour");
      onUpdate({ ...store, whatsapp_number: whatsapp.trim() || null });
    }
    setSaving(false);
  };

  const handleNameChangeRequest = async () => {
    if (!newName.trim() || newName.trim() === store.name) return;
    setSubmittingName(true);
    const { error } = await supabase
      .from("stores")
      .update({ pending_name: newName.trim(), name_change_status: "pending_review" })
      .eq("id", store.id);

    if (error) {
      toast.error("Erreur lors de la soumission");
    } else {
      toast.success("Demande de changement de nom soumise !");
      onUpdate({ ...store, pending_name: newName.trim(), name_change_status: "pending_review" });
      setNewName("");
    }
    setSubmittingName(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <Settings size={16} /> Paramètres de la boutique
      </h3>

      {/* ═══ PHOTO DE PROFIL & BANNIÈRE ═══ */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Store size={14} className="text-primary" />
          Identité visuelle
        </label>

        {/* Banner preview + upload */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">
            Bannière <span className="text-muted-foreground/60">(Résolution idéale : 1200×400 px · Max 3 Mo)</span>
          </p>
          <div className="relative h-32 rounded-lg overflow-hidden border border-border bg-muted group">
            {bannerPreview ? (
              <>
                <img src={bannerPreview} alt="Bannière" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card/60 via-transparent to-transparent" />
              </>
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Aucune bannière</p>
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors cursor-pointer">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm text-xs font-medium text-foreground px-3 py-1.5 rounded-full shadow">
                {uploadingBanner ? "Upload..." : "Changer la bannière"}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
            </label>
          </div>
        </div>

        {/* Logo/profile photo */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">
            Photo de profil <span className="text-muted-foreground/60">(Résolution idéale : 400×400 px · Max 2 Mo)</span>
          </p>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border bg-muted group shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center">
                  <Store size={24} className="text-primary-foreground" />
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors cursor-pointer rounded-full">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-white">
                  {uploadingLogo ? "..." : "Modifier"}
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Cliquez sur la photo pour la modifier. Formats : JPG, PNG, WebP.</p>
          </div>
        </div>
      </div>

      {/* Store Name Section */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
            <Store size={14} className="text-primary" />
            Nom de la boutique
          </label>
          <p className="text-sm font-bold text-foreground">{store.name}</p>

          {store.name_change_status === "pending_review" && store.pending_name && (
            <div className="mt-2 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              <Clock size={14} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Changement en attente d'approbation</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Nouveau nom demandé : <strong>{store.pending_name}</strong></p>
              </div>
            </div>
          )}

          {store.name_change_status === "rejected" && (
            <div className="mt-2 flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              <XCircle size={14} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">Votre dernière demande a été refusée.</p>
            </div>
          )}

          {store.name_change_status !== "pending_review" && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Vous pouvez demander un changement de nom. Il sera validé par l'administration.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nouveau nom souhaité"
                  className="flex-1 px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleNameChangeRequest}
                  disabled={submittingName || !newName.trim()}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingName ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Soumettre
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Section */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
            <Phone size={14} className="text-primary" />
            Numéro WhatsApp Business
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Renseignez votre numéro WhatsApp Business (avec indicatif pays, ex: +243812345678). 
            Les clients seront redirigés vers votre WhatsApp Business lorsqu'ils cliquent sur le bouton WhatsApp.
          </p>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+243812345678"
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Mobile Money Payment Numbers */}
      <VendorPaymentNumbers storeId={store.id} />

      {/* Store Certification Badge */}
      <StoreCertificationSection storeId={store.id} />

      {/* SEO Section */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Globe size={14} className="text-primary" />
          Référencement (SEO) de la boutique
        </label>
        <p className="text-xs text-muted-foreground">
          Ces informations aident les moteurs de recherche à mieux référencer votre boutique lorsque le SEO est activé par l'administration.
        </p>

        {seoLoading ? (
          <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Titre SEO</label>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={60}
                placeholder={store.name}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{seoTitle.length}/60</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Meta description</label>
              <textarea
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                maxLength={160}
                rows={2}
                placeholder="Décrivez votre boutique en une ou deux phrases..."
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{seoDesc.length}/160</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Mots-clés (séparés par des virgules)</label>
              <input
                value={seoKeywords}
                onChange={(e) => setSeoKeywords(e.target.value)}
                placeholder="mode, robes, accessoires, femme"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {seoKeywords.split(",").map((k) => k.trim()).filter(Boolean).map((k, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{k}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Enregistrer
      </button>
    </div>
  );
}

function StoreCertificationSection({ storeId }: { storeId: string }) {
  const { isCertified, isLoading, toggleCertification, isToggling } = useStoreCertification(storeId);

  if (isLoading) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CertificationBadge type="vendor" variant="full" />
        </div>
        <Switch
          checked={isCertified}
          onCheckedChange={toggleCertification}
          disabled={isToggling}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Activez le badge de certification pour afficher un symbole de confiance vérifié sur votre boutique.
        La vérification KYB du propriétaire est requise.
      </p>
    </div>
  );
}
