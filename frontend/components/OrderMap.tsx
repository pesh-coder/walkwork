"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, Polyline,
  LayersControl, useMap,
} from "react-leaflet";
import L from "leaflet";

// Fix default Leaflet icon paths for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// --- Custom div-icon markers ---
const pickupIcon = L.divIcon({
  className: "tukole-marker",
  html: `<div style="
    width:32px;height:32px;background:#0E6B6B;border:3px solid #FBF6F0;
    border-radius:50%;box-shadow:0 4px 12px rgba(14,107,107,.4);
    display:flex;align-items:center;justify-content:center;font-size:14px;
  ">📦</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

const customerIcon = L.divIcon({
  className: "tukole-marker",
  html: `<div style="
    width:34px;height:34px;background:#EF6018;border:3px solid #FBF6F0;
    border-radius:50%;box-shadow:0 4px 12px rgba(239,96,24,.4);
    display:flex;align-items:center;justify-content:center;font-size:14px;
  ">📍</div>`,
  iconSize: [34, 34], iconAnchor: [17, 17],
});

const riderIcon = L.divIcon({
  className: "tukole-marker tukole-rider-marker",
  html: `<div style="position:relative;">
    <div style="
      position:absolute;inset:-6px;border:3px solid #EF6018;border-radius:50%;
      animation:pulse_dot 1.6s ease-in-out infinite;opacity:0.7;
    "></div>
    <div style="
      width:38px;height:38px;background:#0E6B6B;border:3px solid #FBF6F0;
      border-radius:50%;box-shadow:0 4px 16px rgba(14,107,107,.5);
      display:flex;align-items:center;justify-content:center;font-size:16px;
      position:relative;z-index:1;
    ">🏍️</div>
  </div>`,
  iconSize: [38, 38], iconAnchor: [19, 19],
});

interface FitBoundsProps {
  points: [number, number][];
}

function FitBounds({ points }: FitBoundsProps) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
    }
  }, [map, JSON.stringify(points)]);
  return null;
}

export interface OrderMapProps {
  pickupLat?: number | null;
  pickupLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  riderLat?: number | null;
  riderLng?: number | null;
  riderName?: string | null;
  /** Default tile layer: 'streets' (OSM) or 'satellite' (Esri World Imagery). */
  defaultLayer?: "streets" | "satellite";
}

export default function OrderMap({
  pickupLat, pickupLng,
  customerLat, customerLng,
  riderLat, riderLng,
  riderName,
  defaultLayer = "streets",
}: OrderMapProps) {
  const pickup =
    pickupLat != null && pickupLng != null
      ? ([pickupLat, pickupLng] as [number, number])
      : null;
  const customer =
    customerLat != null && customerLng != null
      ? ([customerLat, customerLng] as [number, number])
      : null;
  const rider =
    riderLat != null && riderLng != null
      ? ([riderLat, riderLng] as [number, number])
      : null;

  const points = useMemo(() => {
    const p: [number, number][] = [];
    if (pickup) p.push(pickup);
    if (customer) p.push(customer);
    if (rider) p.push(rider);
    return p;
  }, [pickup, customer, rider]);

  // Center: rider > customer > pickup > Kampala
  const center = rider || customer || pickup || ([0.3476, 32.5825] as [number, number]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer
          name="Streets"
          checked={defaultLayer === "streets"}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer
          name="Satellite"
          checked={defaultLayer === "satellite"}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <FitBounds points={points} />

      {pickup && (
        <Marker position={pickup} icon={pickupIcon}>
          <Popup>
            <div className="font-sans text-sm">
              <div className="font-semibold text-ink-900">Pickup</div>
              <div className="text-ink-500 text-xs">Seller's location</div>
            </div>
          </Popup>
        </Marker>
      )}

      {customer && (
        <Marker position={customer} icon={customerIcon}>
          <Popup>
            <div className="font-sans text-sm">
              <div className="font-semibold text-ink-900">Customer</div>
              <div className="text-ink-500 text-xs">Drop-off point</div>
            </div>
          </Popup>
        </Marker>
      )}

      {rider && (
        <Marker position={rider} icon={riderIcon}>
          <Popup>
            <div className="font-sans text-sm">
              <div className="font-semibold text-ink-900">{riderName || "Rider"}</div>
              <div className="text-ink-500 text-xs">In transit</div>
            </div>
          </Popup>
        </Marker>
      )}

      {pickup && customer && (
        <Polyline
          positions={[pickup, customer]}
          pathOptions={{ color: "#0E6B6B", weight: 2, dashArray: "4 6", opacity: 0.4 }}
        />
      )}
      {rider && customer && (
        <Polyline
          positions={[rider, customer]}
          pathOptions={{ color: "#EF6018", weight: 3, dashArray: "6 8", opacity: 0.7 }}
        />
      )}
    </MapContainer>
  );
}
