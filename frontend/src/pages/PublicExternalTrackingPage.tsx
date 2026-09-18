/**
 * PublicExternalTrackingPage — /t/:token
 * Public (no auth) tracking for forwarder external_shipments.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Plane, Ship, Truck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const STATUS_LABELS: Record<string, string> = {
  created: "Créée",
  booked: "Réservée",
  in_transit: "En transit",
  customs: "Dédouanement",
  arrived: "Arrivée",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const MODE_LABELS: Record<string, string> = {
  air: "Aérien",
  sea: "Maritime",
  road: "Routier",
  rail: "Ferroviaire",
  multimodal: "Multimodal",
};

const MODE_ICONS: Record<string, React.ElementType> = {
  air: Plane,
  sea: Ship,
  road: Truck,
  rail: Truck,
  multimodal: Package,
};

type PublicShipment = {
  awb_bl: string | null;
  mode: string;
  status: string;
  origin: string | null;
  destination: string | null;
  origin_country_code?: string | null;
  origin_city?: string | null;
  destination_country_code?: string | null;
  destination_city?: string | null;
  weight_kg?: number | null;
  total_cbm?: number | null;
  quoted_amount?: number | null;
  quoted_currency?: string | null;
  photo_paths?: string[];
  photo_count?: number;
  eta: string | null;
  events: { at?: string; status?: string; label?: string }[];
  updated_at: string;
  forwarder_name: string | null;
  disabled?: boolean;
};

export default function PublicExternalTrackingPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-external-shipment", token],
    enabled: !!token && token.length >= 8,
    queryFn: async (): Promise<PublicShipment | null> => {
      const { data, error } = await (supabase as any).rpc("get_external_shipment_by_token", {
        p_token: token,
      });
      if (error) throw error;
      return data as PublicShipment | null;
    },
  });

  const trackingDisabled = !!(data && (data as any).disabled === true);
  const shipment = trackingDisabled ? null : data;
  const ModeIcon = shipment?.mode ? MODE_ICONS[shipment.mode] || Package : Package;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8 max-w-lg">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={12} /> Accueil Zandofy
        </Link>

        <h1 className="text-xl font-bold text-foreground mb-1">Suivi d&apos;expédition</h1>
        <p className="text-sm text-muted-foreground mb-6">Suivi public fourni par votre transitaire.</p>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        )}

        {!isLoading && trackingDisabled && (
          <div className="border border-border rounded-lg p-6 text-center space-y-2">
            <Package size={32} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Suivi public temporairement indisponible</p>
            <p className="text-xs text-muted-foreground">Contactez votre transitaire pour le statut de l&apos;expédition.</p>
          </div>
        )}

        {!isLoading && !trackingDisabled && (error || !shipment) && (
          <div className="border border-border rounded-lg p-6 text-center space-y-2">
            <Package size={32} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Expédition introuvable</p>
            <p className="text-xs text-muted-foreground">Vérifiez le lien reçu ou contactez votre transitaire.</p>
          </div>
        )}

        {!isLoading && shipment && (
          <div className="border border-border rounded-lg p-5 space-y-4 bg-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{shipment.forwarder_name || "Transitaire"}</p>
                <p className="text-lg font-bold text-foreground">{shipment.awb_bl || "Sans référence AWB"}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                <ModeIcon size={12} />
                {MODE_LABELS[shipment.mode] || shipment.mode}
              </div>
            </div>

            <div className="rounded-md bg-primary/10 text-primary px-3 py-2 text-sm font-semibold">
              {STATUS_LABELS[shipment.status] || shipment.status}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Origine</dt>
                <dd className="font-medium text-foreground">{shipment.origin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Destination</dt>
                <dd className="font-medium text-foreground">{shipment.destination || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Poids</dt>
                <dd className="font-medium text-foreground">
                  {shipment.weight_kg != null ? `${Number(shipment.weight_kg)} kg` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Volume</dt>
                <dd className="font-medium text-foreground">
                  {shipment.total_cbm != null ? `${Number(shipment.total_cbm)} CBM` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tarif</dt>
                <dd className="font-medium text-foreground">
                  {shipment.quoted_amount != null
                    ? `${Number(shipment.quoted_amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${shipment.quoted_currency || ""}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">ETA</dt>
                <dd className="font-medium text-foreground">{shipment.eta || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">MàJ</dt>
                <dd className="font-medium text-foreground">
                  {shipment.updated_at ? new Date(shipment.updated_at).toLocaleString("fr-FR") : "—"}
                </dd>
              </div>
            </dl>

            {Array.isArray(shipment.photo_paths) && shipment.photo_paths.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photos</h2>
                <div className="grid grid-cols-2 gap-2">
                  {shipment.photo_paths.map((path) => (
                    <SignedPhoto key={path} path={path} />
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(shipment.events) && shipment.events.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Historique</h2>
                <ul className="space-y-2">
                  {[...shipment.events].reverse().map((ev, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-[10px] text-muted-foreground w-28 shrink-0 pt-0.5">
                        {ev.at ? new Date(ev.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : ""}
                      </span>
                      <span className="text-foreground">{ev.label || STATUS_LABELS[ev.status || ""] || ev.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function SignedPhoto({ path }: { path: string }) {
  const { data: url, isError } = useQuery({
    queryKey: ["ext-ship-photo", path],
    queryFn: async () => {
      // Prefer signed URL (works with private bucket + token-folder SELECT RLS)
      const { data, error } = await supabase.storage
        .from("external-shipment-photos")
        .createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) return data.signedUrl as string;

      // Fallback: download blob via RLS SELECT (anon allowed if token folder matches)
      const { data: blob, error: dlErr } = await supabase.storage
        .from("external-shipment-photos")
        .download(path);
      if (dlErr || !blob) throw dlErr || new Error("photo unavailable");
      return URL.createObjectURL(blob);
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  if (isError) {
    return (
      <div className="aspect-square rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground px-2 text-center">
        Photo indisponible
      </div>
    );
  }
  if (!url) {
    return <div className="aspect-square rounded bg-muted animate-pulse" />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded overflow-hidden border border-border">
      <img src={url} alt="Colis" className="w-full h-full object-cover" />
    </a>
  );
}
