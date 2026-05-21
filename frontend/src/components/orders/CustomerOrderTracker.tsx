import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { DeliveryMap, type MapMarker } from "@/components/DeliveryMap";
import { Truck, MapPin, Package, ExternalLink, Phone, Star, RefreshCw, Plane, Ship, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

/**
 * Lot 12 — Customer-side real-time order tracker.
 * Calls RPC get_customer_tracking which enforces ownership + masks PII.
 * Polls every 10s while the order is active (no realtime on sensitive tables).
 */

interface RiderLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
  is_fresh: boolean;
}

interface DeliveryRow {
  id: string;
  status: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivered_at: string | null;
  proof_photo_url: string | null;
}

interface OperatorRow {
  id: string;
  company_name: string;
  logo_url: string | null;
  contact_phone: string | null;
  rating_avg: number | null;
  is_platform_owned: boolean;
}

interface HandoffRow {
  id: string;
  leg_index: number | null;
  status: string;
  tracking_number: string | null;
  tracking_carrier: string | null;
  tracking_url: string | null;
  intermediate_destination_city: string | null;
  updated_at: string;
}

interface ShipmentRow {
  id: string;
  awb_bl: string;
  origin: string;
  destination: string;
  mode: string;
  status: string;
  eta: string | null;
  updated_at: string;
}

interface TrackingPayload {
  order: {
    id: string;
    order_ref: string;
    status: string;
    tracking_number: string | null;
    delivery_choice: string | null;
    delivery_option: string | null;
    shipping_mode: string | null;
    shipping_city: string | null;
    shipping_country: string | null;
    origin_country: string | null;
    delivered_at: string | null;
    pickup_code: string | null;
    assigned_rider_name: string | null;
    updated_at: string;
  };
  delivery: DeliveryRow | null;
  rider_location: RiderLocation | null;
  operator: OperatorRow | null;
  handoffs: HandoffRow[];
  shipments: ShipmentRow[];
}

const POLL_INTERVAL_ACTIVE_MS = 15_000;
const POLL_INTERVAL_HIDDEN_MS = 0; // stop polling when tab hidden
const ACTIVE_STATUSES = new Set(["pending", "confirmed", "processing", "shipped", "ready_for_pickup", "out_for_delivery"]);
const SWITCHABLE_TO_PICKUP = new Set(["shipped", "arrived_at_hub", "at_hub", "assigning_rider", "rider_assigned"]);

function formatRelativeTime(iso: string, locale: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return locale === "fr" ? "à l'instant" : "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return locale === "fr" ? `il y a ${diffMin} min` : `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return locale === "fr" ? `il y a ${diffH} h` : `${diffH} h ago`;
  return new Date(iso).toLocaleDateString(locale);
}

export function CustomerOrderTracker({ orderId }: { orderId: string }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<TrackingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    const load = async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const { data: payload, error: rpcError } = await (supabase.rpc as any)("get_customer_tracking", { p_order_id: orderId });
      if (!mounted) return;
      if (rpcError) {
        setError(rpcError.message);
      } else {
        setData(payload as TrackingPayload);
        setError(null);
      }
      setLoading(false);
      setRefreshing(false);
    };

    load();

    const schedule = () => {
      if (timer) { window.clearInterval(timer); timer = undefined; }
      const ms = document.hidden ? POLL_INTERVAL_HIDDEN_MS : POLL_INTERVAL_ACTIVE_MS;
      if (ms > 0) {
        timer = window.setInterval(() => load(true), ms);
      }
    };
    const onVisibility = () => {
      schedule();
      if (!document.hidden) load(true);
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [orderId]);

  const isActive = data ? ACTIVE_STATUSES.has(data.order.status) : false;

  const canSwitchToHub =
    data?.order?.delivery_choice === "home" &&
    SWITCHABLE_TO_PICKUP.has(data.order.status);

  const switchToHubPickup = async () => {
    if (!data || switching) return;
    const ok = window.confirm(
      locale === "fr"
        ? "Basculer cette commande en retrait à l'agence ? Le coursier ne passera plus."
        : "Switch this order to hub pickup? The rider will be cancelled."
    );
    if (!ok) return;
    setSwitching(true);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("switch-to-hub-pickup", {
        body: { order_id: orderId },
      });
      if (err) throw err;
      const code = (res as any)?.pickup_code;
      toast.success(
        locale === "fr" ? "Retrait au hub activé" : "Hub pickup activated",
        { description: code ? `Code: ${code}` : undefined }
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setSwitching(false);
    }
  };

  const markers = useMemo<MapMarker[]>(() => {
    if (!data) return [];
    const list: MapMarker[] = [];
    if (data.rider_location && data.rider_location.is_fresh) {
      list.push({
        lat: data.rider_location.latitude,
        lng: data.rider_location.longitude,
        type: "rider",
        label: data.order.assigned_rider_name ? `🚴 ${data.order.assigned_rider_name}` : "🚴 " + t("tracking.rider"),
        id: "rider",
      });
    }
    if (data.delivery?.delivery_lat && data.delivery?.delivery_lng) {
      list.push({
        lat: data.delivery.delivery_lat,
        lng: data.delivery.delivery_lng,
        type: "destination",
        label: t("tracking.destination"),
        id: "destination",
      });
    }
    return list;
  }, [data, t]);

  if (loading) {
    return <Skeleton className="h-32 w-full rounded-lg" />;
  }

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
        {t("tracking.error")}: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Live status banner */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isActive && (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              {t("tracking.live")}
            </span>
          )}
          <span>{t("tracking.lastUpdate")}: {formatRelativeTime(data.order.updated_at, locale)}</span>
        </div>
        {refreshing && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {/* Live rider map */}
      {markers.length > 0 && (
        <div className="relative">
          <DeliveryMap markers={markers} showPolylines showEta className="h-64" />
          {data.rider_location && !data.rider_location.is_fresh && (
            <div className="absolute top-2 left-2 bg-background/90 border border-border rounded-md px-2 py-1 text-[10px] text-muted-foreground">
              {t("tracking.gpsStale")}
            </div>
          )}
        </div>
      )}

      {/* Operator card (Lot 11B) */}
      {data.operator && (
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
          {data.operator.logo_url ? (
            <img src={data.operator.logo_url} alt={data.operator.company_name} className="h-10 w-10 rounded-full object-cover border border-border" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate">{data.operator.company_name}</span>
              {data.operator.is_platform_owned && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Zandofy</span>
              )}
              {data.operator.rating_avg != null && data.operator.rating_avg > 0 && (
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {Number(data.operator.rating_avg).toFixed(1)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{t("tracking.operatorLabel")}</span>
          </div>
          {data.operator.contact_phone && (
            <a href={`tel:${data.operator.contact_phone}`} className="text-primary p-2 hover:bg-primary/10 rounded-full" aria-label={t("tracking.callOperator")}>
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
      )}

      {/* International handoffs (Lot 11A/C) */}
      {data.handoffs.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plane className="h-4 w-4 text-primary" />
            {t("tracking.internationalLegs")}
          </div>
          <ol className="space-y-2">
            {data.handoffs.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-xs">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  {h.leg_index ?? "•"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-foreground">
                      {h.tracking_carrier || t("tracking.carrier")}
                      {h.intermediate_destination_city && <span className="text-muted-foreground"> → {h.intermediate_destination_city}</span>}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wide">{h.status}</span>
                  </div>
                  {h.tracking_number && (
                    <div className="mt-0.5 flex items-center gap-2 text-muted-foreground">
                      <span className="font-mono">{h.tracking_number}</span>
                      {h.tracking_url && (
                        <a href={h.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-0.5 hover:underline">
                          {t("tracking.openCarrier")} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Legacy shipments (AWB/BL) */}
      {data.shipments.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Ship className="h-4 w-4 text-primary" />
            {t("tracking.shipments")}
          </div>
          {data.shipments.map((s) => (
            <div key={s.id} className="text-xs space-y-0.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono font-semibold text-foreground">{s.awb_bl}</span>
                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wide">{s.status}</span>
              </div>
              <div className="text-muted-foreground">
                {s.origin} → {s.destination} · <span className="uppercase">{s.mode}</span>
                {s.eta && <span> · {t("tracking.eta")}: {s.eta}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hub pickup code */}
      {data.order.delivery_choice === "hub_pickup" && data.order.pickup_code && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="text-[11px] text-muted-foreground">{t("tracking.pickupCode")}</div>
            <div className="font-mono font-bold text-lg tracking-[0.3em] text-primary">{data.order.pickup_code}</div>
          </div>
        </div>
      )}

      {/* H4 — switch home → hub_pickup last minute */}
      {canSwitchToHub && (
        <button
          onClick={switchToHubPickup}
          disabled={switching}
          className="w-full bg-card border border-primary/40 hover:bg-primary/5 transition-colors rounded-lg p-3 flex items-center gap-3 text-left disabled:opacity-60"
        >
          {switching ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          ) : (
            <MapPin className="h-5 w-5 text-primary shrink-0" />
          )}
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              {locale === "fr" ? "Récupérer plutôt à l'agence" : "Pick up at the hub instead"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {locale === "fr"
                ? "Annule la livraison à domicile et génère un code de retrait."
                : "Cancels home delivery and generates a pickup code."}
            </div>
          </div>
        </button>
      )}

      {/* Empty state */}
      {markers.length === 0 && !data.operator && data.handoffs.length === 0 && data.shipments.length === 0 && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          {t("tracking.noLiveData")}
        </div>
      )}
    </div>
  );
}