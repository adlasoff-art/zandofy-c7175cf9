import { useState, useCallback, useEffect, useRef } from "react";
import { Bike, MapPin, CheckCircle, Clock, Phone, Navigation, User, Home, Camera, Loader2, Star, Calendar, Map as MapIcon, Hash, Package, ShoppingBag, Banknote, Crosshair, Send, MessageCircle, BarChart3, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { Navigate, NavLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/rider/SignatureCanvas";
import { PhotoCapture } from "@/components/rider/PhotoCapture";
import { DeliveryMap, type MapMarker } from "@/components/DeliveryMap";
import { useRiderLocationBroadcast } from "@/hooks/use-rider-location";
import { useCustomerLocationSubscription } from "@/hooks/use-customer-location";
import { generateConfirmationCode } from "@/components/vendor/OrderTransitionModals";
import { STATUS_CONFIG } from "@/lib/order-status";
import { DeliveryChat } from "@/components/delivery/DeliveryChat";
import { fromTable } from "@/lib/supabase-helpers";

type DeliveryStatus = "pending" | "in_progress" | "delivered";
const statusLabels: Record<DeliveryStatus, string> = { pending: "À livrer", in_progress: "En cours", delivered: "Livré" };
const statusStyles: Record<DeliveryStatus, string> = {
  pending: "bg-amber-100 text-amber-700", in_progress: "bg-blue-100 text-blue-700", delivered: "bg-primary/10 text-primary",
};

type TabKey = "route" | "orders" | "map" | "history" | "profile";

function RiderMapTabContent({ activeDelivery, userId }: { activeDelivery: any; userId?: string }) {
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [riderLat, setRiderLat] = useState<number | null>(null);
  const [riderLng, setRiderLng] = useState<number | null>(null);
  const [requestingSent, setRequestingSent] = useState(false);
  const riderWatchId = useRef<number | null>(null);

  useCustomerLocationSubscription(
    activeDelivery?.order_id,
    useCallback((lat: number, lng: number) => {
      setCustomerLat(lat);
      setCustomerLng(lng);
    }, [])
  );

  // Track rider's own position for display on the map
  useEffect(() => {
    if (!activeDelivery || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setRiderLat(pos.coords.latitude); setRiderLng(pos.coords.longitude); },
      () => {}, { enableHighAccuracy: true }
    );
    riderWatchId.current = navigator.geolocation.watchPosition(
      (pos) => { setRiderLat(pos.coords.latitude); setRiderLng(pos.coords.longitude); },
      () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      if (riderWatchId.current !== null) navigator.geolocation.clearWatch(riderWatchId.current);
    };
  }, [activeDelivery]);

  // Request customer to activate their GPS via in-app notification
  const requestCustomerLocation = async () => {
    if (!activeDelivery?.order_id || requestingSent) return;
    try {
      // Get order's user_id
      const { data: order } = await supabase
        .from("orders")
        .select("user_id, order_ref")
        .eq("id", activeDelivery.order_id)
        .single();
      if (!order) { toast.error("Commande introuvable"); return; }

      await supabase.from("notifications").insert({
        user_id: order.user_id,
        type: "delivery",
        title: "📍 Partagez votre position",
        message: `Votre livreur pour la commande ${order.order_ref} vous demande d'activer votre localisation GPS pour faciliter la livraison.`,
        link: "/tracking",
      });
      setRequestingSent(true);
      toast.success("Demande de localisation envoyée au client !");
      setTimeout(() => setRequestingSent(false), 30000); // re-enable after 30s
    } catch {
      toast.error("Erreur lors de l'envoi");
    }
  };

  if (!activeDelivery) {
    return (
      <div className="px-4 mt-4 text-center py-12">
        <MapIcon size={48} className="text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Démarrez une livraison pour voir la carte</p>
      </div>
    );
  }

  const markers: MapMarker[] = [];
  if (riderLat && riderLng) {
    markers.push({ lat: riderLat, lng: riderLng, type: "rider", label: "🚴 Ma position", id: "rider-self" });
  }
  if (activeDelivery.delivery_lat && activeDelivery.delivery_lng) {
    markers.push({ lat: activeDelivery.delivery_lat, lng: activeDelivery.delivery_lng, type: "destination", label: "📍 Destination", id: "dest" });
  }
  if (customerLat && customerLng) {
    markers.push({ lat: customerLat, lng: customerLng, type: "customer", label: "📱 Client (GPS)", id: "customer-gps" });
  }

  return (
    <div className="px-4 mt-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Carte de livraison</h2>

      {/* GPS status indicators */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <Crosshair size={12} className="text-primary" />
          <span className="text-foreground font-medium">Mon GPS actif</span>
        </div>
        {customerLat && customerLng ? (
          <div className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-foreground font-medium">Client GPS actif</span>
          </div>
        ) : (
          <button
            onClick={requestCustomerLocation}
            disabled={requestingSent}
            className="flex items-center gap-1.5 text-xs bg-accent text-accent-foreground rounded-lg px-3 py-1.5 active:scale-95 touch-manipulation disabled:opacity-50"
          >
            <Send size={12} />
            {requestingSent ? "Demande envoyée ✓" : "Demander position client"}
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
        <MapPin size={16} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{activeDelivery.customer_name}</p>
          <p className="text-xs text-muted-foreground truncate">{activeDelivery.address}</p>
        </div>
      </div>

      <DeliveryMap markers={markers} showPolylines={markers.length >= 2} showEta={!!customerLat || !!(activeDelivery.delivery_lat)} className="h-[400px]" />
      <p className="text-[10px] text-muted-foreground text-center">
        Votre position GPS est partagée en temps réel avec le client
        {activeDelivery.address && (
          <>
            {" · "}
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeDelivery.address)}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Naviguer (Google Maps)
            </a>
          </>
        )}
      </p>
    </div>
  );
}

export default function RiderDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { isRider, isAdmin, loading: rolesLoading } = useRoles();
  const [tab, setTab] = useState<TabKey>("route");
  const [signatureModal, setSignatureModal] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  // Traditional deliveries
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deliveries").select("*").order("delivery_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Orders assigned to this rider
  const { data: assignedOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["rider-assigned-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_ref, status, total, shipping_address, shipping_city, shipping_country, shipping_phone, shipping_first_name, shipping_last_name, delivery_choice, last_mile_fee, last_mile_payment_method, last_mile_payment_status, rider_cash_collected, confirmation_code, created_at, updated_at, shipping_cost, shipping_payment_status")
        .eq("assigned_rider_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const activeDelivery = deliveries.find((d: any) => d.status === "in_progress");

  useRiderLocationBroadcast(user?.id, activeDelivery?.id, !!activeDelivery);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "delivered") updates.delivered_at = new Date().toISOString();
      const { error } = await supabase.from("deliveries").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveries"] }),
  });

  if (authLoading || rolesLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isRider && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <Bike size={48} className="text-muted-foreground" />
        <h1 className="text-lg font-bold text-foreground text-center">Accès Livreur requis</h1>
        <p className="text-sm text-muted-foreground text-center">Contactez l'administrateur pour obtenir le rôle Livreur.</p>
        <a href="/" className="text-sm text-primary underline">Retour à l'accueil</a>
      </div>
    );
  }

  const pending = deliveries.filter((d: any) => d.status !== "delivered");
  const completed = deliveries.filter((d: any) => d.status === "delivered");
  const totalEarnings = completed.reduce((s: number, d: any) => s + Number(d.amount), 0);

  const markDelivered = async (id: string) => {
    setConfirming(true);
    try {
      const updates: any = { status: "delivered", delivered_at: new Date().toISOString() };

      if (signatureDataUrl) {
        const blob = await (await fetch(signatureDataUrl)).blob();
        const path = `signatures/${id}-${Date.now()}.png`;
        const { error: sigErr } = await supabase.storage.from("delivery-proofs").upload(path, blob);
        if (!sigErr) {
          const { data: urlData } = supabase.storage.from("delivery-proofs").getPublicUrl(path);
          updates.signature_url = urlData.publicUrl;
        }
      }

      if (proofPhoto) {
        const ext = proofPhoto.name.split(".").pop();
        const path = `photos/${id}-${Date.now()}.${ext}`;
        const { error: photoErr } = await supabase.storage.from("delivery-proofs").upload(path, proofPhoto);
        if (!photoErr) {
          const { data: urlData } = supabase.storage.from("delivery-proofs").getPublicUrl(path);
          updates.proof_photo_url = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from("deliveries").update(updates).eq("id", id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success("Livraison confirmée avec preuves !");
      setSignatureModal(null);
      setSignatureDataUrl(null);
      setProofPhoto(null);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la confirmation");
    } finally {
      setConfirming(false);
    }
  };

  const startDelivery = (id: string) => {
    updateStatus.mutate({ id, status: "in_progress" });
    toast.info("Livraison démarrée — GPS activé");
  };

  // Generate confirmation code for an order (home delivery)
  const generateCodeForOrder = async (orderId: string) => {
    const code = generateConfirmationCode();
    const { error } = await supabase
      .from("orders")
      .update({ confirmation_code: code })
      .eq("id", orderId);
    if (error) {
      toast.error("Erreur lors de la génération du code");
    } else {
      toast.success(`Code de confirmation généré : ${code}`);
      queryClient.invalidateQueries({ queryKey: ["rider-assigned-orders"] });
    }
  };

  // Rider confirms cash collected from customer
  const confirmCashCollected = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ rider_cash_collected: true, last_mile_payment_status: "paid_cash" } as any)
      .eq("id", orderId);
    if (error) {
      toast.error("Erreur lors de la confirmation du paiement");
    } else {
      toast.success("Paiement cash confirmé !");
      queryClient.invalidateQueries({ queryKey: ["rider-assigned-orders"] });
    }
  };

  // Mark order as delivered (for home delivery with code) — requires cash confirmation if cash payment
  const markOrderDelivered = async (orderId: string, order: any) => {
    // Block if cash payment and not yet confirmed
    if (order.last_mile_payment_method === "cash" && !order.rider_cash_collected) {
      toast.error("Confirmez d'abord la réception du paiement cash avant de marquer comme livré.");
      return;
    }
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", orderId);
    if (error) {
      toast.error("Erreur");
    } else {
      toast.success("Commande marquée comme livrée !");
      queryClient.invalidateQueries({ queryKey: ["rider-assigned-orders"] });
    }
  };

  const dateGroups = completed.reduce((acc: Record<string, any[]>, d: any) => {
    const date = new Date(d.delivery_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    if (!acc[date]) acc[date] = [];
    acc[date].push(d);
    return acc;
  }, {});

  // Filter assigned orders
  const activeOrders = assignedOrders.filter((o: any) => o.status !== "delivered" && o.status !== "cancelled");
  const deliveredOrders = assignedOrders.filter((o: any) => o.status === "delivered");

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              <Bike size={20} className="text-primary" /> Livraisons
            </h1>
            <p className="text-xs text-muted-foreground">
              {activeDelivery ? "🟢 GPS actif" : "GPS inactif"} · {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-bold">{completed.length}/{deliveries.length}</span>
        </div>
      </header>

      <div className="px-4 pt-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: deliveries.length ? `${(completed.length / deliveries.length) * 100}%` : "0%" }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{completed.length} livraison(s) effectuée(s) sur {deliveries.length}</p>
      </div>

      {/* Route tab - traditional deliveries */}
      {tab === "route" && (
        <div className="px-4 mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle size={48} className="text-primary mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">{deliveries.length === 0 ? "Aucune livraison assignée" : "Toutes les livraisons sont terminées !"}</p>
              <p className="text-xs text-muted-foreground mt-1">{deliveries.length > 0 ? "Bravo pour cette journée 🎉" : "En attente d'assignation"}</p>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-foreground">{pending.length} livraison(s) restante(s)</h2>
              {pending.map((d: any, idx: number) => (
                <div key={d.id} className="bg-card border border-border rounded-xl p-4 active:scale-[0.98] transition-transform touch-manipulation">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">{d.customer_name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[d.status as DeliveryStatus] || ""}`}>
                          {statusLabels[d.status as DeliveryStatus] || d.status}
                        </span>
                      </div>
                      <div className="flex items-start gap-1 text-xs text-muted-foreground mb-1">
                        <MapPin size={12} className="shrink-0 mt-0.5" /> <span>{d.address}</span>
                      </div>
                      {d.order_ref && (
                        <p className="text-[10px] text-muted-foreground mb-1">Réf: {d.order_ref}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{d.items_count} article(s)</span>
                        <span className="font-semibold text-foreground">${Number(d.amount).toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {d.customer_phone && (
                          <a href={`tel:${d.customer_phone}`} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg text-xs text-foreground active:scale-95 touch-manipulation">
                            <Phone size={14} /> Appeler
                          </a>
                        )}
                        {d.status === "pending" && (
                          <button onClick={() => startDelivery(d.id)} className="flex items-center gap-1 px-3 py-2 bg-accent text-accent-foreground rounded-lg text-xs active:scale-95 touch-manipulation">
                            <Navigation size={14} /> Démarrer
                          </button>
                        )}
                        {d.status === "in_progress" && (
                          <>
                            <button onClick={() => setTab("map")} className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs active:scale-95 touch-manipulation">
                              <MapIcon size={14} /> Carte
                            </button>
                            <button onClick={() => setSignatureModal(d.id)} className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs active:scale-95 touch-manipulation">
                              <CheckCircle size={14} /> Livré
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Orders tab - orders assigned via order system */}
      {tab === "orders" && (
        <div className="px-4 mt-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShoppingBag size={16} className="text-primary" /> Commandes assignées
          </h2>
          {ordersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
          ) : activeOrders.length === 0 && deliveredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune commande assignée</p>
            </div>
          ) : (
            <>
              {activeOrders.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">{activeOrders.length} en cours</p>
                  {activeOrders.map((o: any) => {
                    const cfg = STATUS_CONFIG[o.status];
                    const fullAddress = [o.shipping_address, o.shipping_city, o.shipping_country].filter(Boolean).join(", ");
                    const customerName = [o.shipping_first_name, o.shipping_last_name].filter(Boolean).join(" ") || "Client";
                    return (
                      <div key={o.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-foreground font-mono">{o.order_ref}</p>
                            <p className="text-xs text-muted-foreground">{customerName}</p>
                          </div>
                          {cfg && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}`}>
                              {cfg.label}
                            </span>
                          )}
                        </div>

                        <div className="flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin size={12} className="shrink-0 mt-0.5" />
                          <span>{fullAddress || "—"}</span>
                        </div>

                        {o.shipping_phone && (
                          <a href={`tel:${o.shipping_phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <Phone size={12} /> {o.shipping_phone}
                          </a>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="font-semibold text-foreground">${Number(o.total).toFixed(2)}</span>
                          {o.delivery_choice === "home" && o.last_mile_fee > 0 && (
                            <span>Frais livraison: ${Number(o.last_mile_fee).toFixed(2)} ({o.last_mile_payment_method === "mobile_money" ? "Mobile Money" : "Cash"})</span>
                          )}
                          {o.shipping_payment_status === "deferred" && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                              Expédition à payer: ${Number(o.shipping_cost || 0).toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Cash confirmation for rider */}
                        {o.delivery_choice === "home" && o.last_mile_payment_method === "cash" && (
                          <div className="border-t border-border pt-3 space-y-2">
                            {o.rider_cash_collected ? (
                              <div className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-2">
                                <CheckCircle size={14} className="text-primary" />
                                <span className="text-xs font-medium text-primary">Paiement cash confirmé</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => confirmCashCollected(o.id)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-500 text-white rounded-lg text-xs font-medium active:scale-95 touch-manipulation"
                              >
                                <Banknote size={14} /> Confirmer paiement cash reçu
                              </button>
                            )}
                          </div>
                        )}

                        {/* Confirmation code section */}
                        {o.delivery_choice === "home" && (
                          <div className="border-t border-border pt-3 space-y-2">
                            {o.confirmation_code ? (
                              <div className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-2">
                                <Hash size={14} className="text-primary" />
                                <span className="text-xs text-muted-foreground">Code :</span>
                                <span className="font-mono font-bold text-foreground tracking-widest">{o.confirmation_code}</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => generateCodeForOrder(o.id)}
                                className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs active:scale-95 touch-manipulation"
                              >
                                <Hash size={14} /> Générer code de confirmation
                              </button>
                            )}

                            {/* Mark as delivered - blocked if cash not confirmed */}
                            {o.confirmation_code && (
                              <button
                                onClick={() => markOrderDelivered(o.id, o)}
                                disabled={o.last_mile_payment_method === "cash" && !o.rider_cash_collected}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium active:scale-95 touch-manipulation disabled:opacity-50"
                              >
                                <CheckCircle size={14} /> Marquer comme livré
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {deliveredOrders.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-medium text-muted-foreground">{deliveredOrders.length} livrée(s)</p>
                  {deliveredOrders.slice(0, 10).map((o: any) => (
                    <div key={o.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <CheckCircle size={16} className="text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground font-mono">{o.order_ref}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[o.shipping_address, o.shipping_city].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">${Number(o.total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "map" && (
        <>
          <RiderMapTabContent activeDelivery={activeDelivery} userId={user?.id} />
          {/* Ephemeral chat during active delivery */}
          {activeDelivery?.order_id && (
            <DeliveryChat
              orderId={activeDelivery.order_id}
              deliveryId={activeDelivery.id}
              otherPartyName={activeDelivery.customer_name || "Client"}
            />
          )}
        </>
      )}

      {tab === "history" && (
        <div className="px-4 mt-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Historique des livraisons</h2>
          {Object.keys(dateGroups).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune livraison terminée</p>
          ) : Object.entries(dateGroups).map(([date, items]) => {
            const dayTotal = (items as any[]).reduce((s, d) => s + Number(d.amount), 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">{date}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{(items as any[]).length} livr. · ${dayTotal.toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                  {(items as any[]).map((d) => (
                    <div key={d.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <CheckCircle size={16} className="text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{d.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{d.address}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">${Number(d.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "profile" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={28} className="text-primary" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Profil Livreur</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-foreground">{completed.length}</p>
                <p className="text-[10px] text-muted-foreground">Livrées</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-foreground">${totalEarnings.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Gains</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-foreground">{deliveries.length ? Math.round((completed.length / deliveries.length) * 100) : 0}%</p>
                <p className="text-[10px] text-muted-foreground">Taux</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {signatureModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => { setSignatureModal(null); setSignatureDataUrl(null); setProofPhoto(null); }}>
          <div className="bg-card rounded-t-2xl sm:rounded-xl w-full max-w-md p-5 space-y-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Confirmer la livraison</h3>
            <SignatureCanvas onSignatureReady={setSignatureDataUrl} />
            <PhotoCapture onPhotoReady={setProofPhoto} />
            <div className="flex gap-2">
              <button onClick={() => { setSignatureModal(null); setSignatureDataUrl(null); setProofPhoto(null); }} className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
              <button 
                onClick={() => markDelivered(signatureModal)} 
                disabled={confirming}
                className="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {confirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {confirming ? "Envoi..." : "Confirmer livré"}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-2 pb-[env(safe-area-inset-bottom)] flex items-center justify-around h-16">
        {([
          { key: "route" as TabKey, label: "Ma route", icon: Navigation },
          { key: "orders" as TabKey, label: "Commandes", icon: ShoppingBag },
          { key: "map" as TabKey, label: "Carte", icon: MapIcon },
          { key: "history" as TabKey, label: "Historique", icon: Clock },
          { key: "profile" as TabKey, label: "Profil", icon: User },
        ]).map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[56px] rounded-lg transition-colors active:scale-95 touch-manipulation ${tab === item.key ? "text-primary" : "text-muted-foreground"}`}>
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
