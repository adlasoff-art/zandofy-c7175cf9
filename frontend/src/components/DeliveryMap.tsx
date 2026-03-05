import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const riderIcon = L.divIcon({
  html: `<div style="background:#1a5c2e;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: "",
});

const customerIcon = L.divIcon({
  html: `<div style="background:#dc2626;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  className: "",
});

interface DeliveryMapProps {
  riderLat?: number | null;
  riderLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  className?: string;
}

export function DeliveryMap({ riderLat, riderLng, customerLat, customerLng, className = "" }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const riderMarker = useRef<L.Marker | null>(null);
  const customerMarker = useRef<L.Marker | null>(null);

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
    };
  }, []);

  // Update rider marker
  useEffect(() => {
    if (!mapInstance.current) return;
    if (riderLat && riderLng) {
      if (riderMarker.current) {
        riderMarker.current.setLatLng([riderLat, riderLng]);
      } else {
        riderMarker.current = L.marker([riderLat, riderLng], { icon: riderIcon })
          .addTo(mapInstance.current)
          .bindPopup("🚴 Livreur");
      }
    }
  }, [riderLat, riderLng]);

  // Update customer marker
  useEffect(() => {
    if (!mapInstance.current) return;
    if (customerLat && customerLng) {
      if (customerMarker.current) {
        customerMarker.current.setLatLng([customerLat, customerLng]);
      } else {
        customerMarker.current = L.marker([customerLat, customerLng], { icon: customerIcon })
          .addTo(mapInstance.current)
          .bindPopup("📍 Client");
      }
    }
  }, [customerLat, customerLng]);

  // Fit bounds when both markers exist
  useEffect(() => {
    if (!mapInstance.current) return;
    const points: [number, number][] = [];
    if (riderLat && riderLng) points.push([riderLat, riderLng]);
    if (customerLat && customerLng) points.push([customerLat, customerLng]);
    if (points.length === 2) {
      mapInstance.current.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    } else if (points.length === 1) {
      mapInstance.current.setView(points[0], 14);
    }
  }, [riderLat, riderLng, customerLat, customerLng]);

  return <div ref={mapRef} className={`w-full rounded-xl overflow-hidden ${className}`} style={{ minHeight: 300 }} />;
}
