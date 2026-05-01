"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, Polyline,
  LayersControl, useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Order, Rider } from "@/lib/api";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const riderIcon = L.divIcon({
  className: "tukole-marker",
  html: `<div style="position:relative;">
    <div style="
      position:absolute;inset:-4px;border:2px solid #EF6018;border-radius:50%;
      animation:pulse_dot 1.6s ease-in-out infinite;opacity:0.6;
    "></div>
    <div style="
      width:32px;height:32px;background:#0E6B6B;border:3px solid #FBF6F0;
      border-radius:50%;box-shadow:0 4px 12px rgba(14,107,107,.4);
      display:flex;align-items:center;justify-content:center;font-size:14px;
      position:relative;z-index:1;
    ">🏍️</div>
  </div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

const customerDotIcon = L.divIcon({
  className: "tukole-marker",
  html: `<div style="
    width:14px;height:14px;background:#EF6018;border:2px solid #FBF6F0;
    border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.2);
  "></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
});

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      map.setView([0.3476, 32.5825], 12);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    }
  }, [map, JSON.stringify(points)]);
  return null;
}

interface FleetMapProps {
  orders: Order[];
  riders: Rider[];
  sellerId: string;
}

export default function FleetMap({ orders, riders }: FleetMapProps) {
  const points = useMemo(() => {
    const p: [number, number][] = [];
    for (const r of riders) {
      if (r.current_lat && r.current_lng) p.push([r.current_lat, r.current_lng]);
    }
    for (const o of orders) {
      if (o.customer_lat && o.customer_lng) p.push([o.customer_lat, o.customer_lng]);
    }
    return p;
  }, [riders, orders]);

  return (
    <MapContainer
      center={[0.3476, 32.5825]}
      zoom={12}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer name="Streets" checked>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <FitAll points={points} />

      {/* Customer markers + connecting lines */}
      {orders.map((o) => {
        if (!o.customer_lat || !o.customer_lng) return null;
        const customer: [number, number] = [o.customer_lat, o.customer_lng];
        const rider = riders.find((r) => r.id === o.rider_id);
        const ridePos: [number, number] | null =
          rider && rider.current_lat && rider.current_lng
            ? [rider.current_lat, rider.current_lng]
            : null;
        return (
          <div key={o.id}>
            <Marker position={customer} icon={customerDotIcon}>
              <Popup>
                <div className="font-sans text-sm">
                  <div className="font-semibold text-ink-900">{o.customer_name}</div>
                  <div className="text-ink-500 text-xs">{o.short_code}</div>
                  <div className="text-ink-500 text-xs">{o.customer_area}</div>
                </div>
              </Popup>
            </Marker>
            {ridePos && (
              <Polyline
                positions={[ridePos, customer]}
                pathOptions={{
                  color: "#EF6018",
                  weight: 2,
                  dashArray: "6 6",
                  opacity: 0.6,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Rider markers */}
      {riders.map((r) => {
        if (!r.current_lat || !r.current_lng) return null;
        return (
          <Marker
            key={r.id}
            position={[r.current_lat, r.current_lng]}
            icon={riderIcon}
          >
            <Popup>
              <div className="font-sans text-sm">
                <div className="font-semibold text-ink-900">{r.full_name}</div>
                <div className="text-ink-500 text-xs">{r.plate_number}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
