"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer, TileLayer, Marker, useMapEvents, useMap,
  LayersControl,
} from "react-leaflet";
import L from "leaflet";
import { Crosshair, AlertCircle, Loader2 } from "lucide-react";

// -------------------- Plus Code generator --------------------
const ALPHABET = "23456789CFGHJMPQRVWX";
function generatePlusCode(latitude: number, longitude: number): string {
  let lat = Math.max(-90, Math.min(90, latitude));
  let lng = ((longitude + 180) % 360 + 360) % 360 - 180;
  if (lat === 90) lat -= 1e-9;

  let latVal = Math.round((lat + 90) * 1_250_000);
  let lngVal = Math.round((lng + 180) * 8_192_000);

  const code: string[] = new Array(10);
  for (let i = 4; i >= 0; i--) {
    code[i * 2 + 1] = ALPHABET[lngVal % 20];
    code[i * 2] = ALPHABET[latVal % 20];
    latVal = Math.floor(latVal / 20);
    lngVal = Math.floor(lngVal / 20);
  }
  return code.slice(0, 8).join("") + "+" + code.slice(8).join("");
}

// -------------------- Marker icon --------------------
const customerPinIcon = L.divIcon({
  className: "tukole-marker",
  html: `<div style="position:relative;">
    <div style="
      position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      width:60px;height:60px;border-radius:50%;
      background:rgba(239,96,24,0.18);
      animation:pulse_dot 1.8s ease-in-out infinite;
    "></div>
    <div style="
      position:relative;width:40px;height:40px;background:#EF6018;
      border:4px solid #FBF6F0;border-radius:50%;
      box-shadow:0 6px 16px rgba(239,96,24,.5);
      display:flex;align-items:center;justify-content:center;font-size:18px;
    ">📍</div>
  </div>`,
  iconSize: [40, 40], iconAnchor: [20, 20],
});

// -------------------- Internal helpers --------------------
function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

interface MapControllerProps {
  flyTo: [number, number] | null;
  onReady: (map: L.Map) => void;
}

function MapController({ flyTo, onReady }: MapControllerProps) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (flyTo) {
      map.flyTo(flyTo, 18, { duration: 1.2 });
    }
  }, [map, flyTo]);
  return null;
}

// -------------------- Component --------------------
type LocationState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "located" }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "timeout" };

interface PinDropMapProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onPinChange: (lat: number, lng: number, plusCode: string) => void;
}

export default function PinDropMap({
  initialLat,
  initialLng,
  onPinChange,
}: PinDropMapProps) {
  const hasInitial = initialLat != null && initialLng != null;
  const startLat = initialLat ?? 0.3476; // Kampala centre
  const startLng = initialLng ?? 32.5825;
  const [pin, setPin] = useState<[number, number]>([startLat, startLng]);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(
    hasInitial ? [startLat, startLng] : null
  );
  const [locState, setLocState] = useState<LocationState>({ kind: "idle" });
  const mapRef = useRef<L.Map | null>(null);
  const initialFiredRef = useRef(false);

  function update(lat: number, lng: number, fly = false) {
    setPin([lat, lng]);
    onPinChange(lat, lng, generatePlusCode(lat, lng));
    if (fly) setFlyTo([lat, lng]);
  }

  // Trigger initial onPinChange immediately so parent has a code
  useEffect(() => {
    if (initialFiredRef.current) return;
    initialFiredRef.current = true;
    onPinChange(pin[0], pin[1], generatePlusCode(pin[0], pin[1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-locate on mount (only if no initial provided)
  useEffect(() => {
    if (hasInitial) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocState({ kind: "unavailable" });
      return;
    }
    setLocState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update(pos.coords.latitude, pos.coords.longitude, true);
        setLocState({ kind: "located" });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocState({ kind: "denied" });
        } else if (err.code === err.TIMEOUT) {
          setLocState({ kind: "timeout" });
        } else {
          setLocState({ kind: "unavailable" });
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tryLocateAgain() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocState({ kind: "unavailable" });
      return;
    }
    setLocState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update(pos.coords.latitude, pos.coords.longitude, true);
        setLocState({ kind: "located" });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setLocState({ kind: "denied" });
        else if (err.code === err.TIMEOUT) setLocState({ kind: "timeout" });
        else setLocState({ kind: "unavailable" });
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={pin}
        zoom={hasInitial ? 18 : 13}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="Satellite" checked>
            <TileLayer
              attribution="&copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Streets">
            <TileLayer
              attribution="&copy; OSM"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MapController
          flyTo={flyTo}
          onReady={(m) => { mapRef.current = m; }}
        />
        <ClickHandler onClick={(la, ln) => update(la, ln)} />

        <Marker
          position={pin}
          icon={customerPinIcon}
          draggable={true}
          eventHandlers={{
            dragend(e) {
              const m = e.target as L.Marker;
              const { lat, lng } = m.getLatLng();
              update(lat, lng);
            },
          }}
        />
      </MapContainer>

      {/* Locate me button */}
      <button
        onClick={tryLocateAgain}
        className="absolute bottom-4 left-4 z-[400] btn bg-sand-50 text-teal-700 hover:bg-sand-100 shadow-lift text-xs"
        type="button"
      >
        {locState.kind === "locating" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Crosshair className="w-3.5 h-3.5" />
        )}
        {locState.kind === "locating" ? "Locating…" : "Use my location"}
      </button>

      {/* Helpful banner */}
      {(locState.kind === "denied" ||
        locState.kind === "unavailable" ||
        locState.kind === "timeout") && (
        <div className="absolute top-4 left-4 right-16 z-[400] card p-3 bg-coral-50 border-coral-200 text-xs text-coral-700 shadow-lift">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>
                {locState.kind === "denied"
                  ? "Location blocked"
                  : locState.kind === "timeout"
                  ? "Location took too long"
                  : "Location unavailable"}
              </strong>
              <div className="opacity-90 mt-0.5">
                Drag the orange pin to your gate, or tap anywhere on the map.
              </div>
            </div>
          </div>
        </div>
      )}

      {locState.kind === "locating" && !hasInitial && (
        <div className="absolute top-4 left-4 z-[400] card p-2.5 bg-teal-50 border-teal-200 text-xs text-teal-700 shadow-lift">
          <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />
          Finding you on the map…
        </div>
      )}
    </div>
  );
}
