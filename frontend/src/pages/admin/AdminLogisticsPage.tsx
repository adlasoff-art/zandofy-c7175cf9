import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Truck, Bike, MapPin, CheckCircle, Package, Loader2, Store, Plus, X, Eye, UserPlus, ShoppingBag, Train, Search, Navigation } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DeliveryMap, type MapMarker } from "@/components/DeliveryMap";
import { DeliveryProofLink } from "@/components/DeliveryProofImage";
import { OrderTrackingDrawer } from "@/components/admin/logistics/OrderTrackingDrawer";

type TabKey = "overview" | "deliveries" | "assign" | "tracking";

export default function AdminLogisticsPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);
  const [trackingSearch, setTrackingSearch] = useState("");
  const queryClient = useQueryClient();

  // --- Shared queries ---
  const { data: stores = [], isLoading: loadingStores } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name, is_verified, products_count, is_online").limit(20);
      return data ?? [];
    },
  });

  const { data: orderStats } = useQuery({
    queryKey: ["admin-logistics-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("status");
      if (!data) return { inTransit: 0, delivered: 0, pending: 0 };
      return {
        inTransit: data.filter((o) => ["shipped", "in_transit", "in_shipping"].includes(o.status)).length,
        delivered: data.filter((o) => o.status === "delivered").length,
        pending: data.filter((o) => o.status === "pending").length,
      };
    },
  });

  const { data: shipperCount = 0 } = useQuery({
    queryKey: ["admin-shipper-count"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("id").eq("role", "shipper");
      return data?.length ?? 0;
    },
  });

  const { data: riderCount = 0 } = useQuery({
    queryKey: ["admin-rider-count"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("id").eq("role", "rider");
      return data?.length ?? 0;
    },
  });

  // --- Deliveries ---
  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ["admin-deliveries"],
    queryFn: async () => {
      const { data } = await supabase.from("deliveries").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const { data: riders = [] } = useQuery({
    queryKey: ["admin-riders-list"],
    queryFn: async () => {
      const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "rider");
      if (!roleData || roleData.length === 0) return [];
      const ids = roleData.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids);
      return profiles ?? [];
    },
  });

  // Orders awaiting rider assignment (status = shipped or arrived at hub)
  const { data: assignableOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["admin-assignable-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_ref, status, shipping_city, shipping_address, shipping_first_name, shipping_last_name, shipping_phone, total, store_id, subtotal")
        .in("status", ["shipped", "confirmed", "in_shipping"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  // Rider locations for map
  const { data: riderLocations = [] } = useQuery({
    queryKey: ["admin-rider-locations"],
    queryFn: async () => {
      const { data } = await supabase.from("rider_locations" as any).select("*");
      return (data ?? []) as any[];
    },
    refetchInterval: 10000,
  });

  // Customer locations for map
  const { data: customerLocations = [] } = useQuery({
    queryKey: ["admin-customer-locations"],
    queryFn: async () => {
      const { data } = await supabase.from("customer_locations" as any).select("*");
      return (data ?? []) as any[];
    },
    refetchInterval: 10000,
  });

  // Active deliveries with rider + order info for detailed tracking
  const { data: activeDeliveries = [] } = useQuery({
    queryKey: ["admin-active-deliveries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, rider_id, order_id, order_ref, customer_name, customer_phone, address, status, amount")
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // Send GPS activation notification
  const sendGpsRequest = useMutation({
    mutationFn: async ({ userId, type }: { userId: string; type: "rider" | "customer" }) => {
      const title = type === "rider" ? "Activez votre GPS" : "Activez votre GPS";
      const message = type === "rider"
        ? "L'administrateur demande l'activation de votre GPS pour le suivi de livraison en temps réel. Ouvrez l'application et activez la géolocalisation."
        : "Activez votre GPS pour permettre au livreur de vous localiser. Ouvrez votre page de suivi de commande.";
      const link = type === "rider" ? "/rider" : "/tracking";

      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "delivery",
        title,
        message,
        link,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Notification GPS envoyée !"),
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // Assign rider to order
  const [assignModal, setAssignModal] = useState<any>(null);
  const [assignForm, setAssignForm] = useState({ rider_id: "", amount: "0", notes: "" });

  const assignRider = useMutation({
    mutationFn: async () => {
      if (!assignModal) return;
      const order = assignModal;
      const { error } = await supabase.from("deliveries").insert({
        rider_id: assignForm.rider_id,
        order_id: order.id,
        customer_name: `${order.shipping_first_name || ""} ${order.shipping_last_name || ""}`.trim() || "Client",
        address: order.shipping_address || order.shipping_city || "Adresse non spécifiée",
        customer_phone: order.shipping_phone || null,
        items_count: 1,
        amount: parseFloat(assignForm.amount) || 0,
        notes: assignForm.notes || null,
        order_ref: order.order_ref,
      });
      if (error) throw error;

      // Update order status to in_delivery
      await supabase.from("orders").update({ status: "in_delivery" }).eq("id", order.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-assignable-orders"] });
      toast.success("Livreur assigné à la commande !");
      setAssignModal(null);
      setAssignForm({ rider_id: "", amount: "0", notes: "" });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // --- Create manual delivery ---
  const [form, setForm] = useState({
    rider_id: "", customer_name: "", address: "", customer_phone: "", items_count: "1", amount: "0", notes: "",
  });

  const createDelivery = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("deliveries").insert({
        rider_id: form.rider_id,
        customer_name: form.customer_name,
        address: form.address,
        customer_phone: form.customer_phone || null,
        items_count: parseInt(form.items_count) || 1,
        amount: parseFloat(form.amount) || 0,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deliveries"] });
      toast.success("Livraison créée et assignée !");
      setShowCreate(false);
      setForm({ rider_id: "", customer_name: "", address: "", customer_phone: "", items_count: "1", amount: "0", notes: "" });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const statusStyles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    in_progress: "bg-blue-100 text-blue-700",
    delivered: "bg-primary/10 text-primary",
  };
  const statusLabels: Record<string, string> = {
    pending: "En attente", in_progress: "En cours", delivered: "Livré",
  };

  return (
    <AdminLayout title="Hub Logistique">
      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {([
          { key: "overview" as TabKey, label: "Vue d'ensemble" },
          { key: "assign" as TabKey, label: `Assignation (${assignableOrders.length})` },
          { key: "deliveries" as TabKey, label: `Livraisons (${deliveries.length})` },
          { key: "tracking" as TabKey, label: `Suivi par commande (${activeDeliveries.length})` },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${tab === t.key ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border hover:border-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "En transit", value: orderStats?.inTransit ?? 0, icon: Package },
              { label: "Livrés", value: orderStats?.delivered ?? 0, icon: CheckCircle },
              { label: "Transporteurs", value: shipperCount, icon: Truck },
              { label: "Livreurs", value: riderCount, icon: Bike },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <s.icon size={20} className="text-primary mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Multi-rider fleet map with customer positions */}
          {(riderLocations.length > 0 || customerLocations.length > 0) && (
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <MapPin size={16} className="text-primary" /> Flotte en temps réel
              </h2>
              <DeliveryMap
                markers={[
                  ...riderLocations.map((rl: any, i: number) => ({
                    lat: rl.latitude,
                    lng: rl.longitude,
                    type: "rider" as const,
                    label: `🚴 Livreur ${i + 1}${rl.delivery_id ? " (en livraison)" : ""}`,
                    id: `rider-${rl.rider_id}`,
                  })),
                  ...customerLocations.map((cl: any, i: number) => ({
                    lat: cl.latitude,
                    lng: cl.longitude,
                    type: "customer" as const,
                    label: `📍 Client`,
                    id: `customer-${cl.user_id}`,
                  })),
                ]}
                showPolylines
                fleetMode
                className="h-[400px]"
              />
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: "#1a5c2e" }} />
                  <span className="text-[10px] text-muted-foreground">Livreur ({riderLocations.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: "#dc2626" }} />
                  <span className="text-[10px] text-muted-foreground">Client ({customerLocations.length})</span>
                </div>
              </div>
            </div>
          )}

          {/* Active delivery tracking cards */}
          {activeDeliveries.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Bike size={16} className="text-primary" /> Livraisons en cours ({activeDeliveries.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeDeliveries.map((d: any) => {
                  const riderLoc = riderLocations.find((rl: any) => rl.rider_id === d.rider_id);
                  const customerLoc = d.order_id ? customerLocations.find((cl: any) => cl.order_id === d.order_id) : null;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDelivery(d)}
                      className="text-left border border-border rounded-lg p-3 space-y-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-foreground">{d.order_ref || "Manuel"}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{d.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{d.customer_name} · {d.address}</p>
                      <div className="flex items-center gap-2 text-[10px]" onClick={(e) => e.stopPropagation()}>
                        {riderLoc ? (
                          <span className="flex items-center gap-1 text-primary"><span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> GPS Livreur OK</span>
                        ) : (
                          <button onClick={() => sendGpsRequest.mutate({ userId: d.rider_id, type: "rider" })}
                            className="flex items-center gap-1 text-destructive hover:underline">
                            <MapPin size={10} /> Demander GPS livreur
                          </button>
                        )}
                        {customerLoc ? (
                          <span className="flex items-center gap-1 text-primary"><span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> GPS Client OK</span>
                        ) : d.order_id ? (
                          <button onClick={async () => {
                            // Get customer user_id from the order
                            const { data: ord } = await supabase.from("orders").select("user_id").eq("id", d.order_id).single();
                            if (ord) sendGpsRequest.mutate({ userId: ord.user_id, type: "customer" });
                          }}
                            className="flex items-center gap-1 text-destructive hover:underline">
                            <MapPin size={10} /> Demander GPS client
                          </button>
                        ) : null}
                        <span className="ml-auto flex items-center gap-1 text-primary"><Navigation size={10} /> Ouvrir le suivi</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Store size={18} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Boutiques actives</h2>
              </div>
              {loadingStores ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
              ) : stores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune boutique</p>
              ) : (
                <div className="space-y-3">
                  {stores.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Store size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.is_verified ? "✓ Vérifié" : "Non vérifié"} · {s.is_online ? "En ligne" : "Hors ligne"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{s.products_count ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">produits</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Truck size={18} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Équipe logistique</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Truck size={18} className="text-primary" />
                  <span className="text-sm text-foreground flex-1">Transporteurs</span>
                  <span className="text-sm font-bold text-foreground">{shipperCount}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Bike size={18} className="text-primary" />
                  <span className="text-sm text-foreground flex-1">Livreurs</span>
                  <span className="text-sm font-bold text-foreground">{riderCount}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ASSIGN TAB: Orders ready for rider assignment */}
      {tab === "assign" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserPlus size={16} className="text-primary" /> Commandes à assigner
            </h2>
          </div>

          {loadingOrders ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
          ) : assignableOrders.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <CheckCircle size={32} className="text-primary mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Toutes les commandes sont assignées</p>
              <p className="text-xs text-muted-foreground mt-1">Les commandes avec statut "Expédié" ou "Confirmé" apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignableOrders.map((order: any) => (
                <div key={order.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingBag size={14} className="text-primary shrink-0" />
                        <span className="text-sm font-bold text-foreground font-mono">{order.order_ref}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{order.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.shipping_first_name} {order.shipping_last_name} · {order.shipping_city}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{order.shipping_address}</p>
                      <p className="text-sm font-semibold text-foreground mt-1">${Number(order.total).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => { setAssignModal(order); setAssignForm({ rider_id: "", amount: "0", notes: "" }); }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-95 shrink-0"
                    >
                      <Bike size={14} /> Assigner
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "deliveries" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Gestion des livraisons</h2>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-95">
              <Plus size={14} /> Nouvelle livraison
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loadingDeliveries ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : deliveries.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Aucune livraison créée</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                      <th className="text-left p-3 font-medium">Client</th>
                      <th className="text-left p-3 font-medium hidden sm:table-cell">Réf.</th>
                      <th className="text-left p-3 font-medium">Statut</th>
                      <th className="text-left p-3 font-medium hidden sm:table-cell">Montant</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                      <th className="text-left p-3 font-medium hidden lg:table-cell">Preuves</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d: any) => (
                      <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <p className="font-medium text-foreground">{d.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{d.customer_phone || "—"}</p>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell font-mono">{d.order_ref || "—"}</td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[d.status] || "bg-muted text-muted-foreground"}`}>
                            {statusLabels[d.status] || d.status}
                          </span>
                        </td>
                        <td className="p-3 text-foreground font-medium hidden sm:table-cell">${Number(d.amount).toFixed(2)}</td>
                        <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                          {format(new Date(d.created_at), "d MMM yyyy", { locale: fr })}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <div className="flex gap-1.5">
                            {d.signature_url && (
                              <DeliveryProofLink pathOrUrl={d.signature_url} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Signature</DeliveryProofLink>
                            )}
                            {d.proof_photo_url && (
                              <DeliveryProofLink pathOrUrl={d.proof_photo_url} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Photo</DeliveryProofLink>
                            )}
                            {!d.signature_url && !d.proof_photo_url && <span className="text-[10px] text-muted-foreground">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "tracking" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Navigation size={16} className="text-primary" /> Suivi par commande
            </h2>
            <div className="relative w-full max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={trackingSearch}
                onChange={(e) => setTrackingSearch(e.target.value)}
                placeholder="Réf, téléphone, nom client…"
                className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {activeDeliveries.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Bike size={28} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">Aucune livraison en cours</p>
              <p className="text-xs text-muted-foreground mt-1">Les livraisons en attente ou en cours apparaîtront ici.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeDeliveries
                .filter((d: any) => {
                  const q = trackingSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (d.order_ref || "").toLowerCase().includes(q) ||
                    (d.customer_name || "").toLowerCase().includes(q) ||
                    (d.customer_phone || "").toLowerCase().includes(q) ||
                    (d.address || "").toLowerCase().includes(q)
                  );
                })
                .map((d: any) => {
                  const riderLoc = riderLocations.find((rl: any) => rl.rider_id === d.rider_id);
                  const customerLoc = d.order_id ? customerLocations.find((cl: any) => cl.order_id === d.order_id) : null;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDelivery(d)}
                      className="text-left bg-card border border-border rounded-xl p-4 space-y-2 hover:border-primary/50 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-foreground">{d.order_ref || `Manuel ${d.id.slice(0, 6)}`}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{statusLabels[d.status] || d.status}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground">{d.customer_name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{d.address}</p>
                      <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                        <span className={riderLoc ? "text-primary" : ""}>● Livreur {riderLoc ? "GPS OK" : "hors ligne"}</span>
                        <span className={customerLoc ? "text-primary" : ""}>● Client {customerLoc ? "GPS OK" : "hors ligne"}</span>
                        <span className="ml-auto flex items-center gap-1 text-primary font-medium">
                          <Navigation size={10} /> Suivre
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      <OrderTrackingDrawer delivery={selectedDelivery} onClose={() => setSelectedDelivery(null)} />

      {/* Assign rider modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAssignModal(null)}>
          <div className="bg-card rounded-xl w-full max-w-md p-5 space-y-4 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Assigner un livreur</h3>
              <button onClick={() => setAssignModal(null)}><X size={18} className="text-muted-foreground" /></button>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Commande</p>
              <p className="text-sm font-bold text-foreground font-mono">{assignModal.order_ref}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {assignModal.shipping_first_name} {assignModal.shipping_last_name} · {assignModal.shipping_city}
              </p>
              <p className="text-xs text-muted-foreground">{assignModal.shipping_address}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Livreur *</label>
                <select value={assignForm.rider_id} onChange={(e) => setAssignForm({ ...assignForm, rider_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">— Sélectionner un livreur —</option>
                  {riders.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.first_name || ""} {r.last_name || ""} ({r.email})</option>
                  ))}
                </select>
                {riders.length === 0 && <p className="text-[10px] text-destructive mt-1">Aucun livreur. Assignez d'abord le rôle Livreur à un utilisateur.</p>}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Frais de livraison ($)</label>
                <input type="number" value={assignForm.amount} onChange={(e) => setAssignForm({ ...assignForm, amount: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" min="0" step="0.01" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <textarea value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} rows={2}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setAssignModal(null)} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
              <button
                onClick={() => assignRider.mutate()}
                disabled={!assignForm.rider_id || assignRider.isPending}
                className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {assignRider.isPending ? <Loader2 size={14} className="animate-spin" /> : <Bike size={14} />}
                Assigner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create delivery modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-card rounded-xl w-full max-w-md p-5 space-y-4 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Créer une livraison manuelle</h3>
              <button onClick={() => setShowCreate(false)}><X size={18} className="text-muted-foreground" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Assigner au livreur *</label>
                <select value={form.rider_id} onChange={(e) => setForm({ ...form, rider_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">— Sélectionner un livreur —</option>
                  {riders.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.first_name || ""} {r.last_name || ""} ({r.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nom du client *</label>
                <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Jean Dupont" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Adresse *</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="123 Rue Principale, Kinshasa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Téléphone</label>
                  <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="+243..." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Montant ($)</label>
                  <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" min="0" step="0.01" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
              <button
                onClick={() => createDelivery.mutate()}
                disabled={!form.rider_id || !form.customer_name || !form.address || createDelivery.isPending}
                className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createDelivery.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
