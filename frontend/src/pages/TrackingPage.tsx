import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Search, Package, Plane, Ship, Truck, MapPin, Clock, CheckCircle2,
  CircleDot, Circle, Loader2, AlertCircle, Globe, ShoppingBag,
  Box, UserCheck, Users, Gift, XCircle, RotateCcw, Bike, Home, Store, Hash, Train,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mapInternalShipment, detectCarrier, type TrackingResult } from "@/lib/tracking-providers";
import { STATUS_CONFIG, STATUS_FLOW, CUSTOMER_TRACKING_STEPS, getStepIndex } from "@/lib/order-status";
import { useI18n } from "@/contexts/I18nContext";
import { DeliveryMap } from "@/components/DeliveryMap";
import { useRiderLocationSubscription } from "@/hooks/use-rider-location";
import { useCustomerLocationBroadcast } from "@/hooks/use-customer-location";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";
import { DeliveryChat } from "@/components/delivery/DeliveryChat";
import { RiderRatingModal } from "@/components/delivery/RiderRatingModal";
import { fromTable } from "@/lib/supabase-helpers";
import { calculateLastMileFee, type LastMileFeeResult } from "@/lib/last-mile-fee";

// ── Types ──
interface ShipmentResult {
  id: string; awb_bl: string; origin: string; destination: string;
  mode: string; status: string; eta: string | null; items_count: number;
  created_at: string; updated_at: string;
}

interface DeliveryResult {
  id: string; status: string; customer_name: string; address: string;
  delivery_date: string; delivered_at: string | null;
  created_at: string; updated_at: string;
}

interface OrderTrackingResult {
  id: string; order_ref: string; status: string; total: number;
  shipping_address: string | null; shipping_city: string | null; shipping_country: string | null;
  tracking_number: string | null;
  assigned_rider_name: string | null; assigned_rider_id: string | null;
  delivery_choice: string | null;
  last_mile_fee: number | null;
  last_mile_payment_method: string | null;
  confirmation_code: string | null;
  created_at: string; updated_at: string;
  store_name: string | null;
  history: { status: string; created_at: string; notes: string | null }[];
  delivery_id?: string | null;
}

// ── Shipment / Delivery constants ──
const SHIPMENT_STEPS = [
  { key: "loading", label: "Chargement", icon: Package },
  { key: "in_transit", label: "En transit", icon: Plane },
  { key: "customs", label: "Douanes", icon: MapPin },
  { key: "arrived", label: "Arrivé", icon: CheckCircle2 },
  { key: "delivered", label: "Livré", icon: CheckCircle2 },
];

const DELIVERY_STEPS = [
  { key: "pending", label: "En attente", icon: Clock },
  { key: "in_progress", label: "En cours", icon: Truck },
  { key: "delivered", label: "Livré", icon: CheckCircle2 },
];

const modeIcons: Record<string, typeof Plane> = { air: Plane, sea: Ship, road: Truck, rail: Train };

function getStepIdx(steps: { key: string }[], status: string) {
  const idx = steps.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

// ── Reusable simple Timeline (shipment/delivery) ──
function Timeline({ steps, currentStatus }: { steps: typeof SHIPMENT_STEPS; currentStatus: string }) {
  const activeIdx = getStepIdx(steps, currentStatus);
  return (
    <div className="flex items-start gap-0 w-full overflow-x-auto py-4">
      {steps.map((step, i) => {
        const done = i <= activeIdx;
        const isCurrent = i === activeIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-col items-center flex-1 min-w-[80px] relative">
            {i > 0 && (
              <div className={cn("absolute top-5 right-1/2 w-full h-0.5 -z-10", done ? "bg-primary" : "bg-border")} />
            )}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
              isCurrent ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                : done ? "bg-primary/20 text-primary border-primary"
                : "bg-muted text-muted-foreground border-border"
            )}>
              {isCurrent ? <CircleDot size={18} /> : done ? <Icon size={18} /> : <Circle size={18} />}
            </div>
            <span className={cn("text-xs mt-2 text-center font-medium", isCurrent ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 9-Step Order Timeline (3 rows × 3, snake flow) ──
function OrderTimeline({ currentStatus, history }: { currentStatus: string; history: OrderTrackingResult["history"] }) {
  const isCancelled = currentStatus === "cancelled";
  const isReturned = currentStatus === "returned";
  const activeIdx = getStepIndex(currentStatus);
  const historyMap = new Map(history.map((h) => [h.status, h.created_at]));

  // 3 rows of 3 steps
  const ROW1 = CUSTOMER_TRACKING_STEPS.slice(0, 3);
  const ROW2 = CUSTOMER_TRACKING_STEPS.slice(3, 6);
  const ROW3 = CUSTOMER_TRACKING_STEPS.slice(6, 9);

  const renderStep = (step: typeof CUSTOMER_TRACKING_STEPS[0], globalIdx: number) => {
    const done = globalIdx <= activeIdx && !isCancelled && !isReturned;
    const isCurrent = globalIdx === activeIdx && !isCancelled && !isReturned;
    const Icon = step.icon;
    const ts = historyMap.get(step.key);
    return (
      <div key={step.key} className="flex flex-col items-center gap-1 flex-1 min-w-0">
        <div className={cn(
          "w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all",
          isCurrent ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-110"
            : done ? "bg-primary/20 text-primary border-primary"
            : "bg-muted text-muted-foreground border-border"
        )}>
          {isCurrent ? <CircleDot size={20} /> : done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
        </div>
        <span className={cn("text-xs mt-0.5 text-center font-semibold leading-tight px-0.5",
          isCurrent ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")}>
          {step.label}
        </span>
        {ts && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            {" "}
            {new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    );
  };

  const renderRow = (steps: typeof CUSTOMER_TRACKING_STEPS, startIndex: number) => (
    <div className="flex items-start w-full">
      {steps.map((step, i) => {
        const globalIdx = startIndex + i;
        const done = globalIdx <= activeIdx && !isCancelled && !isReturned;
        return (
          <div key={step.key} className="flex items-start flex-1 min-w-0">
            {renderStep(step, globalIdx)}
            {i < steps.length - 1 && (
              <div className={cn("h-0.5 mt-[22px] flex-shrink-0 w-4 sm:w-6",
                globalIdx < activeIdx && !isCancelled && !isReturned ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderRowReversed = (steps: typeof CUSTOMER_TRACKING_STEPS, startIndex: number) => {
    const reversed = [...steps].reverse();
    return (
      <div className="flex items-start w-full">
        {reversed.map((step, i) => {
          const globalIdx = startIndex + (steps.length - 1 - i);
          const done = globalIdx <= activeIdx && !isCancelled && !isReturned;
          return (
            <div key={step.key} className="flex items-start flex-1 min-w-0">
              {renderStep(step, globalIdx)}
              {i < reversed.length - 1 && (
                <div className={cn("h-0.5 mt-[22px] flex-shrink-0 w-4 sm:w-6",
                  Math.min(startIndex + (steps.length - 1 - i), startIndex + (steps.length - 2 - i)) < activeIdx && !isCancelled && !isReturned
                    ? "bg-primary" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative">
      {(isCancelled || isReturned) && (
        <div className="mb-4">
          <Badge variant="destructive" className="text-sm">
            {isCancelled ? <XCircle size={14} className="mr-1" /> : <RotateCcw size={14} className="mr-1" />}
            {STATUS_CONFIG[currentStatus]?.label || currentStatus}
          </Badge>
        </div>
      )}

      <div className="py-4 space-y-0">
        {/* Row 1: L → R */}
        {renderRow(ROW1, 0)}
        {/* Snake connector: right side going down */}
        <div className="flex justify-end pr-[16%]">
          <div className={cn("w-0.5 h-5", activeIdx >= 2 && !isCancelled && !isReturned ? "bg-primary" : "bg-border")} />
        </div>
        {/* Row 2: R → L (snake) */}
        {renderRowReversed(ROW2, 3)}
        {/* Snake connector: left side going down */}
        <div className="flex justify-start pl-[16%]">
          <div className={cn("w-0.5 h-5", activeIdx >= 5 && !isCancelled && !isReturned ? "bg-primary" : "bg-border")} />
        </div>
        {/* Row 3: L → R */}
        {renderRow(ROW3, 6)}
      </div>
    </div>
  );
}

// ── Delivery Choice Panel ──
function DeliveryChoicePanel({ order, onChoiceMade }: { order: OrderTrackingResult; onChoiceMade: () => void }) {
  const [choosing, setChoosing] = useState(false);
  const [lastMileResult, setLastMileResult] = useState<LastMileFeeResult | null>(null);
  const [lmLoading, setLmLoading] = useState(true);

  // Calculate last-mile fee from order address
  useEffect(() => {
    const fetchFee = async () => {
      setLmLoading(true);
      const { data: orderData } = await (supabase as any)
        .from("orders")
        .select("shipping_commune, shipping_quartier, shipping_city, shipping_country")
        .eq("id", order.id)
        .single();

      if (orderData?.shipping_commune && orderData?.shipping_city) {
        const result = await calculateLastMileFee(
          orderData.shipping_commune,
          orderData.shipping_quartier || "",
          orderData.shipping_city,
          orderData.shipping_country || "CD"
        );
        setLastMileResult(result);
      }
      setLmLoading(false);
    };
    fetchFee();
  }, [order.id]);

  const lastMileFee = lastMileResult?.fee || 0;

  const handleChoice = async (choice: "home" | "pickup") => {
    setChoosing(true);
    try {
      const updates: any = {
        delivery_choice: choice,
        last_mile_fee: choice === "home" ? lastMileFee : 0,
        last_mile_payment_status: choice === "home" && lastMileFee > 0 ? "deferred" : null,
      };
      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", order.id);
      if (error) throw error;
      toast.success(choice === "home" ? "Livraison à domicile choisie !" : "Récupération au Hub choisie !");
      onChoiceMade();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setChoosing(false);
    }
  };

  const homeDisabled = lastMileResult ? !lastMileResult.deliverable : false;

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <MapPin size={16} className="text-primary" /> Choisissez votre mode de réception
      </h3>
      <p className="text-xs text-muted-foreground">
        Votre commande est arrivée au Hub ! Comment souhaitez-vous la récupérer ?
      </p>

      {/* Zone not deliverable warning */}
      {lastMileResult && !lastMileResult.deliverable && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">
          ⚠️ Livraison à domicile non disponible dans votre zone{lastMileResult.restrictionReason ? ` : ${lastMileResult.restrictionReason}` : ""}. Veuillez récupérer au Hub.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => handleChoice("home")}
          disabled={choosing || homeDisabled || lmLoading}
          className={`flex items-center gap-3 p-3 border rounded-xl transition-colors bg-card text-left active:scale-[0.98] ${
            homeDisabled ? "border-border opacity-50 cursor-not-allowed" : "border-border hover:border-primary"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Home size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Livraison à domicile</p>
            {lmLoading ? (
              <p className="text-xs text-muted-foreground">Calcul des frais...</p>
            ) : lastMileFee > 0 ? (
              <p className="text-xs text-muted-foreground">Frais : ${lastMileFee.toFixed(2)} — à payer à la réception</p>
            ) : (
              <p className="text-xs text-muted-foreground">Un livreur sera assigné</p>
            )}
          </div>
        </button>

        <button
          onClick={() => handleChoice("pickup")}
          disabled={choosing}
          className="flex items-center gap-3 p-3 border border-border rounded-xl hover:border-primary transition-colors bg-card text-left active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-full bg-accent/50 flex items-center justify-center shrink-0">
            <Store size={18} className="text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Récupérer au Hub</p>
            <p className="text-xs text-muted-foreground">Gratuit — code de confirmation</p>
          </div>
        </button>
      </div>
      {choosing && (
        <div className="flex justify-center"><Loader2 size={16} className="animate-spin text-primary" /></div>
      )}
    </div>
  );
}

// ── Confirmation Code Entry (Hub Pickup) ──
function ConfirmationCodeEntry({ order, onConfirmed }: { order: OrderTrackingResult; onConfirmed: () => void }) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-confirmation-code", {
        body: { order_id: order.id, code: code.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else if (data?.success) {
        toast.success("Commande récupérée avec succès !");
        onConfirmed();
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Hash size={16} className="text-primary" /> Code de confirmation
      </h3>
      <p className="text-xs text-muted-foreground">
        Entrez le code de confirmation fourni par le vendeur pour valider la récupération de votre colis.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Ex: A3B7K2"
          maxLength={6}
          className="flex-1 px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono text-center tracking-widest uppercase"
          style={{ fontSize: "16px" }}
        />
        <Button onClick={handleVerify} disabled={verifying || code.trim().length < 6}>
          {verifying ? <Loader2 size={14} className="animate-spin" /> : "Valider"}
        </Button>
      </div>
    </div>
  );
}

// ── Live Rider Tracking Map (bidirectional) ──
function LiveRiderMap({ deliveryId, orderId, userId }: { deliveryId: string; orderId?: string; userId?: string }) {
  const [riderLat, setRiderLat] = useState<number | null>(null);
  const [riderLng, setRiderLng] = useState<number | null>(null);

  // Broadcast customer position
  useCustomerLocationBroadcast(userId, orderId, !!userId && !!orderId);

  useRiderLocationSubscription(deliveryId, useCallback((lat: number, lng: number) => {
    setRiderLat(lat);
    setRiderLng(lng);
  }, []));

  if (!riderLat || !riderLng) {
    return (
      <div className="bg-muted/30 rounded-xl p-6 text-center">
        <Bike size={24} className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">En attente de la position du livreur...</p>
        <p className="text-xs text-muted-foreground mt-1">Votre position GPS est partagée avec le livreur</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-medium text-foreground">Livreur en route — GPS bidirectionnel actif</span>
      </div>
      <DeliveryMap riderLat={riderLat} riderLng={riderLng} showPolylines showEta className="h-[300px]" />
    </div>
  );
}

// ── Rider Profile Banner (visible to customer) ──
function RiderProfileBanner({ riderId, riderName }: { riderId: string; riderName: string }) {
  const { data: profile } = useQuery({
    queryKey: ["rider-profile", riderId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("first_name, last_name, avatar_url").eq("id", riderId).single();
      return data;
    },
    enabled: !!riderId,
  });

  const { data: avgRating } = useQuery({
    queryKey: ["rider-avg-rating", riderId],
    queryFn: async () => {
      const { data } = await fromTable("rider_ratings").select("rating").eq("rider_id", riderId);
      if (!data || data.length === 0) return null;
      const avg = data.reduce((s: number, r: any) => s + r.rating, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!riderId,
  });

  const displayName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || riderName : riderName;

  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 border border-border">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <UserCheck size={18} className="text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Votre livreur : {displayName}</p>
        {avgRating && (
          <p className="text-xs text-muted-foreground">⭐ {avgRating.avg}/5 ({avgRating.count} avis)</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──
export default function TrackingPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { ref: urlRef } = useParams<{ ref?: string }>();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("order");
  const [loading, setLoading] = useState(false);
  const [shipment, setShipment] = useState<ShipmentResult | null>(null);
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null);
  const [globalResult, setGlobalResult] = useState<TrackingResult | null>(null);
  const [orderResult, setOrderResult] = useState<OrderTrackingResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tippingEnabled, setTippingEnabled] = useState(false);
  const [maxTip, setMaxTip] = useState(20);
  const [autoSearched, setAutoSearched] = useState(false);

  // Check tipping settings
  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "tipping_settings").maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as any;
          setTippingEnabled(!!v.enabled);
          setMaxTip(Number(v.max_amount) || 20);
        }
      });
  }, []);

  // Auto-show rating modal when order is delivered
  useEffect(() => {
    if (orderResult?.status === "delivered" && orderResult?.assigned_rider_id && user) {
      fromTable("rider_ratings").select("id").eq("order_id", orderResult.id).eq("user_id", user.id).maybeSingle()
        .then(({ data }: any) => {
          if (!data) setShowRatingModal(true);
        });
    }
  }, [orderResult?.status, orderResult?.id, orderResult?.assigned_rider_id, user]);

  // Fetch order + history
  const fetchOrder = useCallback(async (orderRef: string) => {
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_ref, status, total, shipping_address, shipping_city, shipping_country, tracking_number, assigned_rider_name, assigned_rider_id, delivery_choice, last_mile_fee, last_mile_payment_method, confirmation_code, created_at, updated_at, store_id")
      .eq("order_ref", orderRef)
      .maybeSingle();

    if (!order) return null;

    let storeName: string | null = null;
    if (order.store_id) {
      const { data: store } = await supabase.from("stores").select("name").eq("id", order.store_id).single();
      storeName = store?.name || null;
    }

    const { data: history } = await supabase
      .from("order_status_history")
      .select("status, created_at, notes")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    const { data: deliveryData } = await supabase
      .from("deliveries")
      .select("id")
      .eq("order_id", order.id)
      .neq("status", "delivered")
      .maybeSingle();

    return {
      id: order.id,
      order_ref: order.order_ref,
      status: order.status,
      total: order.total,
      shipping_address: order.shipping_address,
      shipping_city: order.shipping_city,
      shipping_country: order.shipping_country,
      tracking_number: order.tracking_number,
      assigned_rider_name: order.assigned_rider_name,
      assigned_rider_id: order.assigned_rider_id,
      delivery_choice: order.delivery_choice,
      last_mile_fee: order.last_mile_fee,
      last_mile_payment_method: order.last_mile_payment_method,
      confirmation_code: order.confirmation_code,
      created_at: order.created_at,
      updated_at: order.updated_at,
      store_name: storeName,
      history: (history || []) as OrderTrackingResult["history"],
      delivery_id: deliveryData?.id || null,
    };
  }, []);

  // Polling for order tracking updates (replaces Realtime for security)
  useEffect(() => {
    if (!orderResult) return;
    const interval = setInterval(async () => {
      const updated = await fetchOrder(orderResult.order_ref);
      if (updated) setOrderResult(updated);
    }, 15000);
    return () => clearInterval(interval);
  }, [orderResult?.id, orderResult?.order_ref, fetchOrder]);

  const resetResults = () => {
    setShipment(null); setDelivery(null); setGlobalResult(null); setOrderResult(null); setNotFound(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    resetResults();

    try {
      if (tab === "order") {
        const result = await fetchOrder(trimmed);
        if (result) setOrderResult(result);
        else setNotFound(true);
      } else if (tab === "shipment") {
        const { data, error } = await supabase.rpc("track_shipment", { p_awb_bl: trimmed });
        if (error) throw error;
        if (data && data.length > 0) setShipment(data[0] as unknown as ShipmentResult);
        else setNotFound(true);
      } else if (tab === "delivery") {
        const { data, error } = await supabase.rpc("track_delivery", { p_order_ref: trimmed });
        if (error) throw error;
        if (data && data.length > 0) setDelivery(data[0] as unknown as DeliveryResult);
        else setNotFound(true);
      } else if (tab === "global") {
        const { data } = await supabase.rpc("track_shipment", { p_awb_bl: trimmed });
        if (data && data.length > 0) {
          setGlobalResult(mapInternalShipment(data[0] as unknown as ShipmentResult));
        } else {
          detectCarrier(trimmed);
          setNotFound(true);
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const ModeIcon = shipment ? (modeIcons[shipment.mode] || Package) : Package;
  const statusCfg = orderResult ? STATUS_CONFIG[orderResult.status] : null;

  // Determine if we need to show the delivery choice panel
  const showDeliveryChoice = orderResult && orderResult.status === "shipped" && !orderResult.delivery_choice && user;
  // Show confirmation code entry for pickup
  const showPickupCodeEntry = orderResult && orderResult.delivery_choice === "hub_pickup" && orderResult.confirmation_code && orderResult.status !== "delivered" && user;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t("tracking.title")} description={t("tracking.subtitle")} />
      <Header />

      <main className="container py-8 md:py-12 max-w-2xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Search size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("tracking.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("tracking.subtitle")}</p>
        </div>

        {/* Search */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <Tabs value={tab} onValueChange={(v) => { setTab(v); resetResults(); }}>
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="order" className="flex items-center gap-1 text-xs sm:text-sm">
                  <ShoppingBag size={14} /> {t("tracking.myOrder")}
                </TabsTrigger>
                <TabsTrigger value="shipment" className="text-xs sm:text-sm">{t("tracking.shipment")}</TabsTrigger>
                <TabsTrigger value="delivery" className="text-xs sm:text-sm">{t("tracking.delivery")}</TabsTrigger>
                <TabsTrigger value="global" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Globe size={14} /> {t("tracking.global")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="order">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input placeholder="Ex: ORD-ABC123" value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" maxLength={100} />
                  <Button type="submit" disabled={loading || !query.trim()}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    <span className="ml-2 hidden sm:inline">{t("tracking.track")}</span>
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2">{t("tracking.orderSteps")}</p>
              </TabsContent>

              <TabsContent value="shipment">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input placeholder="Ex: AWB-2026-001" value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" maxLength={100} />
                  <Button type="submit" disabled={loading || !query.trim()}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    <span className="ml-2 hidden sm:inline">{t("tracking.search")}</span>
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="delivery">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input placeholder="Ex: ORD-ABC123" value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" maxLength={100} />
                  <Button type="submit" disabled={loading || !query.trim()}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    <span className="ml-2 hidden sm:inline">{t("tracking.search")}</span>
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="global">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input placeholder="DHL, FedEx, UPS, EMS..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" maxLength={100} />
                  <Button type="submit" disabled={loading || !query.trim()}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                    <span className="ml-2 hidden sm:inline">{t("tracking.tracker")}</span>
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2">{t("tracking.globalDesc")}</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Not found */}
        {notFound && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-8 text-center">
              <AlertCircle size={32} className="mx-auto text-destructive mb-3" />
              <p className="font-medium text-foreground">{t("tracking.notFound")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("tracking.notFoundDesc")}</p>
            </CardContent>
          </Card>
        )}

        {/* ── Order Result ── */}
        {orderResult && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CardContent className="pt-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingBag size={18} className="text-primary" />
                    <h2 className="font-bold text-lg text-foreground font-mono">{orderResult.order_ref}</h2>
                  </div>
                  {orderResult.store_name && (
                    <p className="text-sm text-muted-foreground">{orderResult.store_name}</p>
                  )}
                </div>
                {statusCfg && (
                  <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusCfg.badgeClass)}>
                    {statusCfg.label}
                  </span>
                )}
              </div>

              {/* Tracking number */}
              {orderResult.tracking_number && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
                  <Package size={14} className="text-primary shrink-0" />
                  <span className="text-muted-foreground">N° de suivi :</span>
                  <span className="font-mono font-semibold text-foreground">{orderResult.tracking_number}</span>
                </div>
              )}

              {/* Assigned rider */}
              {orderResult.assigned_rider_name && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
                  <Bike size={14} className="text-primary shrink-0" />
                  <span className="text-muted-foreground">Livreur :</span>
                  <Link
                    to={`/tracking?tab=delivery&ref=${orderResult.order_ref}`}
                    className="font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {orderResult.assigned_rider_name}
                  </Link>
                </div>
              )}

              {/* Confirmation code — visible to customer */}
              {orderResult.confirmation_code && orderResult.status !== "delivered" && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground">🔐 Votre code de confirmation</p>
                  <p className="text-[11px] text-muted-foreground">Présentez ce code lors de la réception de votre colis.</p>
                  <div className="bg-background border border-border rounded-lg px-4 py-3 text-center">
                    <span className="font-mono font-bold text-xl tracking-[0.3em] text-primary">{orderResult.confirmation_code}</span>
                  </div>
                </div>
              )}

              {/* 10-step timeline */}
              <OrderTimeline currentStatus={orderResult.status} history={orderResult.history} />

              {/* Delivery choice panel */}
              {showDeliveryChoice && (
                <DeliveryChoicePanel
                  order={orderResult}
                  onChoiceMade={async () => {
                    const updated = await fetchOrder(orderResult.order_ref);
                    if (updated) setOrderResult(updated);
                  }}
                />
              )}

              {/* Hub pickup: confirmation code entry */}
              {showPickupCodeEntry && (
                <ConfirmationCodeEntry
                  order={orderResult}
                  onConfirmed={async () => {
                    const updated = await fetchOrder(orderResult.order_ref);
                    if (updated) setOrderResult(updated);
                  }}
                />
              )}

              {/* Delivery choice info */}
              {orderResult.delivery_choice && orderResult.status !== "delivered" && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
                  {orderResult.delivery_choice === "home_delivery" ? (
                    <>
                      <Home size={14} className="text-primary shrink-0" />
                      <span className="text-foreground">Livraison à domicile</span>
                      {orderResult.last_mile_fee && orderResult.last_mile_fee > 0 && (
                        <span className="text-muted-foreground ml-1">— ${orderResult.last_mile_fee.toFixed(2)}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Store size={14} className="text-primary shrink-0" />
                      <span className="text-foreground">Récupération au Hub</span>
                    </>
                  )}
                </div>
              )}

              {/* Live rider tracking map */}
              {orderResult.delivery_id && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Bike size={16} className="text-primary" /> Suivi en direct — GPS bidirectionnel
                  </h3>
                  <LiveRiderMap deliveryId={orderResult.delivery_id} orderId={orderResult.id} userId={user?.id} />
                </div>
              )}

              {/* Rider profile visible to customer */}
              {orderResult.assigned_rider_id && orderResult.status === "out_for_delivery" && (
                <RiderProfileBanner riderId={orderResult.assigned_rider_id} riderName={orderResult.assigned_rider_name || "Livreur"} />
              )}

              {/* Ephemeral chat during delivery */}
              {user && orderResult.assigned_rider_id && ["out_for_delivery", "shipped"].includes(orderResult.status) && (
                <DeliveryChat
                  orderId={orderResult.id}
                  deliveryId={orderResult.delivery_id}
                  otherPartyName={orderResult.assigned_rider_name || "Votre livreur"}
                />
              )}

              {/* Rating modal after delivery */}
              {user && orderResult.status === "delivered" && orderResult.assigned_rider_id && showRatingModal && (
                <RiderRatingModal
                  orderId={orderResult.id}
                  riderId={orderResult.assigned_rider_id}
                  riderName={orderResult.assigned_rider_name || "Livreur"}
                  userId={user.id}
                  deliveryId={orderResult.delivery_id}
                  tippingEnabled={tippingEnabled}
                  maxTip={maxTip}
                  onClose={() => setShowRatingModal(false)}
                />
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
                <div>
                  <span className="text-muted-foreground">{t("cart.total")}</span>
                  <p className="font-semibold text-foreground">${orderResult.total.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p className="font-medium text-foreground">
                    {new Date(orderResult.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {/* Full address */}
                <div className="col-span-2">
                  <span className="text-muted-foreground">Adresse de livraison</span>
                  <p className="font-medium text-foreground">
                    {[orderResult.shipping_address, orderResult.shipping_city, orderResult.shipping_country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>

              {/* History log */}
              {orderResult.history.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Historique</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[...orderResult.history].reverse().map((h, i) => {
                      const cfg = STATUS_CONFIG[h.status];
                      return (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", cfg?.color?.replace("text-", "bg-") || "bg-muted-foreground")} />
                          <div className="flex-1">
                            <span className="font-medium text-foreground">{cfg?.label || h.status}</span>
                            {h.notes && <span className="text-muted-foreground ml-1">— {h.notes}</span>}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(h.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Real-time indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Mis à jour en temps réel
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipment Result */}
        {shipment && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ModeIcon size={18} className="text-primary" />
                    <h2 className="font-bold text-lg text-foreground">{shipment.awb_bl}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{shipment.origin} → {shipment.destination}</p>
                </div>
                <span className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full capitalize",
                  shipment.status === "delivered" ? "bg-primary/10 text-primary"
                    : shipment.status === "in_transit" ? "bg-blue-500/10 text-blue-600"
                    : "bg-amber-500/10 text-amber-600"
                )}>
                  {shipment.status.replace("_", " ")}
                </span>
              </div>
              <Timeline steps={SHIPMENT_STEPS} currentStatus={shipment.status} />
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
                <div><span className="text-muted-foreground">Mode</span><p className="font-medium text-foreground capitalize">{shipment.mode}</p></div>
                <div><span className="text-muted-foreground">Articles</span><p className="font-medium text-foreground">{shipment.items_count}</p></div>
                <div><span className="text-muted-foreground">ETA</span><p className="font-medium text-foreground">{shipment.eta || "—"}</p></div>
                <div>
                  <span className="text-muted-foreground">Mise à jour</span>
                  <p className="font-medium text-foreground">
                    {new Date(shipment.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Result */}
        {delivery && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Truck size={18} className="text-primary" />
                    <h2 className="font-bold text-lg text-foreground">{t("tracking.delivery")}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{delivery.address}</p>
                </div>
                <span className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full capitalize",
                  delivery.status === "delivered" ? "bg-primary/10 text-primary"
                    : delivery.status === "in_progress" ? "bg-blue-500/10 text-blue-600"
                    : "bg-amber-500/10 text-amber-600"
                )}>
                  {delivery.status.replace("_", " ")}
                </span>
              </div>
              <Timeline steps={DELIVERY_STEPS} currentStatus={delivery.status} />
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
                <div><span className="text-muted-foreground">Client</span><p className="font-medium text-foreground">{delivery.customer_name}</p></div>
                <div><span className="text-muted-foreground">Date</span><p className="font-medium text-foreground">{new Date(delivery.delivery_date).toLocaleDateString("fr-FR")}</p></div>
                {delivery.delivered_at && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t("tracking.delivered")}</span>
                    <p className="font-medium text-foreground">
                      {new Date(delivery.delivered_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global Tracking Result */}
        {globalResult && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Globe size={18} className="text-primary" />
                    <h2 className="font-bold text-lg text-foreground">{globalResult.tracking_number}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {globalResult.carrier} — {globalResult.origin} → {globalResult.destination}
                  </p>
                </div>
                <span className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full capitalize",
                  globalResult.current_status === "delivered" ? "bg-primary/10 text-primary"
                    : globalResult.current_status === "in_transit" ? "bg-blue-500/10 text-blue-600"
                    : globalResult.current_status === "exception" ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-600"
                )}>
                  {globalResult.current_status.replace("_", " ")}
                </span>
              </div>
              <div className="space-y-3 border-l-2 border-border pl-4">
                {globalResult.events.map((event, i) => (
                  <div key={i} className="relative">
                    <div className={cn("absolute -left-[21px] w-3 h-3 rounded-full border-2", i === 0 ? "bg-primary border-primary" : "bg-muted border-border")} />
                    <p className="text-sm font-medium text-foreground">{event.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.location && `${event.location} — `}
                      {event.timestamp && new Date(event.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
                <div><span className="text-muted-foreground">Transporteur</span><p className="font-medium text-foreground">{globalResult.carrier}</p></div>
                <div><span className="text-muted-foreground">ETA</span><p className="font-medium text-foreground">{globalResult.estimated_delivery || "—"}</p></div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Mise à jour</span>
                  <p className="font-medium text-foreground">
                    {new Date(globalResult.last_update).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
