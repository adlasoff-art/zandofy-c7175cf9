import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const ICONS: Record<string, L.DivIcon> = {
  rider: L.divIcon({
    html: `<div style="background:#1a5c2e;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "",
  }),
  customer: L.divIcon({
    html: `<div style="background:#dc2626;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    className: "",
  }),
  destination: L.divIcon({
    html: `<div style="background:#f59e0b;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    className: "",
  }),
};

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface MapMarker {
  lat: number;
  lng: number;
  type: "rider" | "customer" | "destination";
  label?: string;
  id?: string;
}

interface DeliveryMapProps {
  /** Legacy single-marker props */
  riderLat?: number | null;
  riderLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  /** New multi-marker mode */
  markers?: MapMarker[];
  /** Draw polylines between rider→customer pairs */
  showPolylines?: boolean;
  /** Show ETA info */
  showEta?: boolean;
  /** Fleet mode: auto-fit all markers */
  fleetMode?: boolean;
  className?: string;
}

export function DeliveryMap({
  riderLat,
  riderLng,
  customerLat,
  customerLng,
  markers: markersProp,
  showPolylines = false,
  showEta = false,
  fleetMode = false,
  className = "",
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const polylineRefs = useRef<L.Polyline[]>([]);
  const etaControlRef = useRef<L.Control | null>(null);

  // Merge legacy props into markers array
  const markers = useMemo(() => {
    if (markersProp && markersProp.length > 0) return markersProp;
    const m: MapMarker[] = [];
    if (riderLat && riderLng) m.push({ lat: riderLat, lng: riderLng, type: "rider", label: "🚴 Livreur", id: "legacy-rider" });
    if (customerLat && customerLng) m.push({ lat: customerLat, lng: customerLng, type: "customer", label: "📍 Client", id: "legacy-customer" });
    return m;
  }, [markersProp, riderLat, riderLng, customerLat, customerLng]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const defaultCenter: [number, number] = [-4.3217, 15.3125]; // Kinshasa
    mapInstance.current = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(mapInstance.current);

    L.control.zoom({ position: "bottomright" }).addTo(mapInstance.current);
    L.control.attribution({ position: "bottomleft", prefix: "© OSM" }).addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerRefs.current.clear();
      polylineRefs.current = [];
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    const existingIds = new Set(markerRefs.current.keys());
    const currentIds = new Set<string>();

    markers.forEach((m, i) => {
      const id = m.id || `${m.type}-${i}`;
      currentIds.add(id);
      const icon = ICONS[m.type] || ICONS.customer;

      if (markerRefs.current.has(id)) {
        markerRefs.current.get(id)!.setLatLng([m.lat, m.lng]);
      } else {
        const marker = L.marker([m.lat, m.lng], { icon })
          .addTo(map)
          .bindPopup(m.label || m.type);
        markerRefs.current.set(id, marker);
      }
    });

    // Remove stale markers
    existingIds.forEach((id) => {
      if (!currentIds.has(id)) {
        markerRefs.current.get(id)?.remove();
        markerRefs.current.delete(id);
      }
    });

    // Fit bounds
    const points: [number, number][] = markers.map((m) => [m.lat, m.lng]);
    if (fleetMode && points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    } else if (points.length === 2 && !fleetMode) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [markers, fleetMode]);

  // Draw polylines
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear old polylines
    polylineRefs.current.forEach((p) => p.remove());
    polylineRefs.current = [];

    if (!showPolylines) return;

    const riders = markers.filter((m) => m.type === "rider");
    const customers = markers.filter((m) => m.type === "customer" || m.type === "destination");

    // Draw line from each rider to the nearest customer
    riders.forEach((rider) => {
      if (customers.length === 0) return;
      // If there's a customer with matching id pattern, use that
      const target = customers[0]; // Simple: connect to first customer
      const polyline = L.polyline(
        [[rider.lat, rider.lng], [target.lat, target.lng]],
        { color: "#1a5c2e", weight: 3, dashArray: "8, 8", opacity: 0.7 }
      ).addTo(mapInstance.current!);
      polylineRefs.current.push(polyline);
    });
  }, [markers, showPolylines]);

  // Show ETA
  useEffect(() => {
    if (!mapInstance.current) return;

    if (etaControlRef.current) {
      mapInstance.current.removeControl(etaControlRef.current);
      etaControlRef.current = null;
    }

    if (!showEta) return;

    const riders = markers.filter((m) => m.type === "rider");
    const customers = markers.filter((m) => m.type === "customer" || m.type === "destination");

    if (riders.length > 0 && customers.length > 0) {
      const dist = haversineKm(riders[0].lat, riders[0].lng, customers[0].lat, customers[0].lng);
      const etaMinutes = Math.max(1, Math.round((dist / 20) * 60)); // ~20 km/h avg speed

      const EtaControl = L.Control.extend({
        onAdd() {
          const div = L.DomUtil.create("div", "");
          div.style.cssText =
            "background:white;padding:6px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-size:12px;font-weight:600;color:#333;";
          div.innerHTML = `📍 ${dist.toFixed(1)} km · ~${etaMinutes} min`;
          return div;
        },
      });

      etaControlRef.current = new EtaControl({ position: "topright" });
      etaControlRef.current.addTo(mapInstance.current);
    }
  }, [markers, showEta]);

  return <div ref={mapRef} className={`w-full rounded-xl overflow-hidden ${className}`} style={{ minHeight: 300 }} />;
}
