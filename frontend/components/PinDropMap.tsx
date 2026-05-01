"use client";

import { useEffect, useState } from "react";
import {
  MapContainer, TileLayer, Marker, useMap, LayersControl,
} from "react-leaflet";
import L from "leaflet";

// Open Location Code (Plus Code) encoder — pure JS, no network needed.
// Adapted from Google's OpenLocationCode library.
const CODE_ALPHABET = "23456789CFGHJMPQRVWX";
const SEPARATOR = "+";
const PADDING = "0";

function encodeOLC(latitude: number, longitude: number, length = 10): string {
  // Clamp inputs
  if (latitude >= 90) latitude = 90 - 1e-10;
  if (latitude < -90) latitude = -90;
  longitude = ((longitude + 180) % 360 + 360) % 360 - 180;

  const lat = latitude + 90;
  const lng = longitude + 180;

  // Encode latitude and longitude into base 20 pairs.
  let code = "";

  // First 5 pairs (10 chars) — degree, then 1/20ths
  let latPlace = 20;
  let lngPlace = 20;
  let latVal = lat;
  let lngVal = lng;

  for (let i = 0; i < 5; i++) {
    const latDigit = Math.floor(latVal / latPlace);
    const lngDigit = Math.floor(lngVal / lngPlace);
    code += CODE_ALPHABET[latDigit];
    code += CODE_ALPHABET[lngDigit];
    latVal -= latDigit * latPlace;
    lngVal -= lngDigit * lngPlace;
    latPlace /= 20;
    lngPlace /= 20;
  }

  // Insert separator after 8 chars
  return code.slice(0, 8) + SEPARATOR + code.slice(8, length);
}

const pinIcon = L.divIcon({
  className: "tukole-pin",
  html: `<div style="position:relative;transform:translateY(-100%);">
    <div style="
      width:38px;height:38px;background:#EF6018;border:3px solid #FBF6F0;
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      box-shadow:0 6px 16px rgba(239,96,24,.5);
      display:flex;align-items:center;justify-content:center;
      transition:transform 0.1s ease-out;
    ">
      <div style="
        transform:rotate(45deg);
        width:14px;height:14px;background:#FBF6F0;border-radius:50%;
      "></div>
    </div>
  </div>`,
  iconSize: [38, 38], iconAnchor: [19, 38],
});

interface PinDropMapProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onChange: (lat: number, lng: number, plusCode: string) => void;
}

function CenterController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() < 16 ? 16 : map.getZoom());
  }, [map, lat, lng]);
  return null;
}

function CenterPin({
  position,
  setPosition,
  onChange,
}: {
  position: [number, number];
  setPosition: (p: [number, number]) => void;
  onChange: (lat: number, lng: number, plusCode: string) => void;
}) {
  const map = useMap();

  useEffect(() => {
    function update() {
      const c = map.getCenter();
      const next: [number, number] = [c.lat, c.lng];
      setPosition(next);
      onChange(c.lat, c.lng, encodeOLC(c.lat, c.lng));
    }
    map.on("move", update);
    map.on("zoomend", update);
    return () => {
      map.off("move", update);
      map.off("zoomend", update);
    };
  }, [map, onChange, setPosition]);

  return null;
}

export default function PinDropMap({
  initialLat,
  initialLng,
  onChange,
}: PinDropMapProps) {
  // Default to central Kampala if nothing provided
  const [position, setPosition] = useState<[number, number]>([
    initialLat ?? 0.3476,
    initialLng ?? 32.5825,
  ]);
  const [needsCenter, setNeedsCenter] = useState(false);

  // Try to use the user's GPS to position the initial pin
  useEffect(() => {
    if (initialLat || initialLng) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(next);
        setNeedsCenter(true);
        onChange(next[0], next[1], encodeOLC(next[0], next[1]));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={position}
        zoom={16}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Satellite" checked>
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Streets">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {needsCenter && <CenterController lat={position[0]} lng={position[1]} />}
        <CenterPin
          position={position}
          setPosition={setPosition}
          onChange={onChange}
        />
      </MapContainer>

      {/* Static center pin overlay (always at the visual center, looks fixed) */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[1000]"
        style={{ transform: "translate(-50%, -100%)" }}
      >
        <div
          className="w-[38px] h-[38px] bg-coral-500 border-[3px] border-sand-50 flex items-center justify-center shadow-lift"
          style={{
            borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)",
          }}
        >
          <div
            className="w-3.5 h-3.5 bg-sand-50 rounded-full"
            style={{ transform: "rotate(45deg)" }}
          />
        </div>
      </div>

      {/* Hint chip */}
      <div className="pointer-events-none absolute top-3 left-3 z-[1000]">
        <div className="bg-ink-900/80 text-sand-50 text-xs px-3 py-1.5 rounded-chip backdrop-blur-sm">
          Drag the map to move the pin
        </div>
      </div>
    </div>
  );
}
