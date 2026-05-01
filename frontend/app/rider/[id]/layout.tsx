"use client";

import { useEffect, useState } from "react";
import { Briefcase, Map as MapIcon, Wallet, Settings } from "lucide-react";
import { Sidebar, type SidebarItem } from "@/components/Sidebar";
import { ridersApi, type Rider } from "@/lib/api";
import { ugx } from "@/lib/format";

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

    // Push GPS location every 10s if browser supports it
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
      <Sidebar
        items={items}
        subtitle={rider?.full_name}
        footer={sidebarFooter}
      />
      <div className="main-content pb-24 lg:pb-0">{children}</div>
    </div>
  );
}
