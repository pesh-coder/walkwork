"use client";

import { useEffect, useState } from "react";
import {
  Briefcase, Map as MapIcon, Wallet, Settings, Battery, BatteryLow,
  BatteryMedium, BatteryFull, MapPin, ExternalLink, X,
} from "lucide-react";
import { Sidebar, type SidebarItem } from "@/components/Sidebar";
import { ridersApi, type Rider } from "@/lib/api";
import { ugx } from "@/lib/format";

type BatteryLevel = "full" | "most" | "half" | "low";

const BATTERY_OPTIONS: Array<{
  level: BatteryLevel;
  label: string;
  bars: number;
  color: string;
  hint: string;
}> = [
  { level: "full", label: "Full", bars: 4, color: "bg-teal-600",  hint: "Just swapped, all-day deliveries" },
  { level: "most", label: "Most", bars: 3, color: "bg-teal-500",  hint: "Plenty for any order" },
  { level: "half", label: "Half", bars: 2, color: "bg-coral-400", hint: "Stay on shorter trips" },
  { level: "low",  label: "Low",  bars: 1, color: "bg-coral-600", hint: "Swap before next long trip" },
];

// Static list of known Kampala swap stations. Real availability comes from
// the supplier's app — we just point the rider there with one tap.
const SWAP_STATIONS: Array<{ name: string; lat: number; lng: number }> = [
  { name: "Bukoto Mall",         lat: 0.3500, lng: 32.5950 },
  { name: "Ntinda Hub",          lat: 0.3580, lng: 32.6100 },
  { name: "Kololo Avenue",       lat: 0.3346, lng: 32.5916 },
  { name: "Kabalagala Junction", lat: 0.2958, lng: 32.6046 },
  { name: "Wandegeya Stage",     lat: 0.3375, lng: 32.5712 },
  { name: "Nakawa Market",       lat: 0.3322, lng: 32.6266 },
];

function nearestStation(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return SWAP_STATIONS[0];
  let best = SWAP_STATIONS[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const s of SWAP_STATIONS) {
    const d = Math.hypot(s.lat - lat, s.lng - lng);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export default function RiderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { id } = params;
  const [rider, setRider] = useState<Rider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await ridersApi.get(id);
        if (!cancelled) {
          setRider(r);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    }
    load();

    let watchId: number | null = null;
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          ridersApi
            .updateLocation(id, pos.coords.latitude, pos.coords.longitude)
            .catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10_000 }
      );
    }

    const interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (watchId !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [id]);

  async function setBattery(level: BatteryLevel) {
    if (!rider) return;
    setUpdating(true);
    try {
      const updated = await ridersApi.updateBattery(id, level);
      setRider(updated);
      setShowSelector(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdating(false);
    }
  }

  const items: SidebarItem[] = [
    {
      label: "Jobs",
      href: `/rider/${id}`,
      icon: Briefcase,
      match: (p) => p === `/rider/${id}` || p.startsWith(`/rider/${id}/jobs`),
    },
    { label: "Map", href: `/rider/${id}/map`, icon: MapIcon },
    { label: "Earnings", href: `/rider/${id}/earnings`, icon: Wallet },
  ];

  const battery = (rider?.battery_level || "full") as BatteryLevel;
  const batteryOpt = BATTERY_OPTIONS.find((o) => o.level === battery)!;
  const station = nearestStation(rider?.current_lat, rider?.current_lng);
  const isLow = battery === "low";

  const sidebarFooter = rider ? (
    <div className="px-2">
      <div className="text-xs text-ink-500 mb-1">Earnings</div>
      <div className="font-display text-xl tabular text-coral-600">
        {ugx(rider.wallet_balance_ugx)}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-coral-500 text-sand-50 flex items-center justify-center font-medium text-sm overflow-hidden">
          {rider.photo_url ? (
            <img src={rider.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            rider.full_name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-900 truncate">
            {rider.full_name}
          </div>
          <div className="text-xs font-mono text-ink-500 truncate">
            {rider.plate_number || "—"}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <h1 className="font-display text-xl">Couldn't load rider</h1>
          <p className="text-ink-500 text-sm mt-1">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="shell">
      <Sidebar items={items} subtitle={rider?.full_name} footer={sidebarFooter} />
      <div className="main-content pb-24 lg:pb-0">
        {/* Battery bar — always visible */}
        {rider && (
          <div className="bg-sand-50 border-b border-sand-200 sticky top-0 z-20">
            <div className="px-5 sm:px-8 py-3">
              <button
                onClick={() => setShowSelector((v) => !v)}
                className="flex items-center gap-3 w-full text-left"
              >
                <div className={`w-10 h-10 rounded-card ${batteryOpt.color} flex items-center justify-center text-sand-50 shrink-0`}>
                  {battery === "low" ? <BatteryLow className="w-5 h-5" /> :
                   battery === "half" ? <BatteryMedium className="w-5 h-5" /> :
                   <BatteryFull className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">
                    Battery
                  </div>
                  <div className="text-sm font-medium text-ink-900">
                    {batteryOpt.label} · tap to change
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-5 rounded-sm ${
                        i <= batteryOpt.bars ? batteryOpt.color : "bg-sand-200"
                      }`}
                    />
                  ))}
                </div>
              </button>

              {/* Low-battery banner with swap CTA */}
              {isLow && (
                <div className="mt-3 card p-3 bg-coral-50 border-coral-300 flex items-start gap-3">
                  <BatteryLow className="w-5 h-5 text-coral-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-coral-700">
                      Swap your battery before the next long trip
                    </div>
                    <div className="text-xs text-ink-700 mt-0.5">
                      Nearest swap station: <strong>{station.name}</strong>
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}&travelmode=driving`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-coral text-xs shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Directions
                  </a>
                </div>
              )}

              {/* Selector — large tappable buttons */}
              {showSelector && (
                <div className="mt-3 card p-4 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm font-medium text-ink-900">
                      How much battery left?
                    </div>
                    <button
                      onClick={() => setShowSelector(false)}
                      className="btn-ghost p-1 text-ink-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {BATTERY_OPTIONS.map((opt) => {
                      const active = battery === opt.level;
                      return (
                        <button
                          key={opt.level}
                          onClick={() => setBattery(opt.level)}
                          disabled={updating}
                          className={`p-3 rounded-card border-2 transition-colors text-left ${
                            active
                              ? "border-coral-500 bg-coral-50"
                              : "border-sand-200 hover:bg-sand-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-7 h-7 rounded-card ${opt.color} flex items-center justify-center text-sand-50`}>
                              <Battery className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-ink-900">{opt.label}</span>
                          </div>
                          <div className="text-[11px] text-ink-500 leading-tight">
                            {opt.hint}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
