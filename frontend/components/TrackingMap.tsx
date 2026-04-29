"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default icon issue with Next.js bundler
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom pin icons using divIcon (HTML-based, no images needed)
const riderIcon = L.divIcon({
  className: "tukole-rider-marker",
  html: `<div style="
    width: 36px; height: 36px;
    background: #C8623E;
    border: 3px solid #FBF8F3;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(168, 78, 46, 0.4);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  ">🏍️</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const customerIcon = L.divIcon({
  className: "tukole-customer-marker",
  html: `<div style="
    width: 32px; height: 32px;
    background: #3F5D3D;
    border: 3px solid #FBF8F3;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(63, 93, 61, 0.4);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
  ">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

interface MapBoundsProps {
  rider: [number, number] | null;
  customer: [number, number] | null;
}

function FitBounds({ rider, customer }: MapBoundsProps) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    if (rider) points.push(rider);
    if (customer) points.push(customer);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
    }
  }, [map, rider, customer]);
  return null;
}

export interface TrackingMapProps {
  riderLat?: number | null;
  riderLng?: number | null;
  riderName?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
}

export default function TrackingMap({
  riderLat,
  riderLng,
  riderName,
  customerLat,
  customerLng,
}: TrackingMapProps) {
  // Default center: Kampala
  const defaultCenter: [number, number] = [0.3476, 32.5825];

  const rider: [number, number] | null =
    riderLat != null && riderLng != null ? [riderLat, riderLng] : null;
  const customer: [number, number] | null =
    customerLat != null && customerLng != null ? [customerLat, customerLng] : null;

  const center = useMemo<[number, number]>(
    () => rider || customer || defaultCenter,
    [rider, customer]
  );

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds rider={rider} customer={customer} />

      {rider && (
        <Marker position={rider} icon={riderIcon}>
          <Popup>
            <div className="font-sans text-sm">
              <div className="font-semibold text-ink-900">{riderName || "Rider"}</div>
              <div className="text-ink-500">On the way</div>
            </div>
          </Popup>
        </Marker>
      )}

      {customer && (
        <Marker position={customer} icon={customerIcon}>
          <Popup>
            <div className="font-sans text-sm font-medium text-forest-700">Delivery address</div>
          </Popup>
        </Marker>
      )}

      {rider && customer && (
        <Polyline
          positions={[rider, customer]}
          pathOptions={{ color: "#C8623E", weight: 3, dashArray: "6 8", opacity: 0.7 }}
        />
      )}
    </MapContainer>
  );
}
