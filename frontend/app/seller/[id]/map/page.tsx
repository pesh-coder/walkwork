"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Activity, Package, MapPin } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import {
  sellersApi, ridersApi,
  type Order, type Rider,
} from "@/lib/api";
import { ugx, isInFlight } from "@/lib/format";

const FleetMap = dynamic(() => import("@/components/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100 rounded-card">
      <span className="text-sm text-ink-500">Loading fleet map…</span>
    </div>
  ),
});

export default function SellerLiveMapPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [o, r] = await Promise.all([
        sellersApi.orders(id),
        ridersApi.listAll(),
      ]);
      setOrders(o);
      setRiders(r);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const inFlight = useMemo(
    () => orders.filter((o) => isInFlight(o.status) && o.rider_id),
    [orders]
  );
  const ridersById = useMemo(() => {
    const m = new Map<string, Rider>();
    for (const r of riders) m.set(r.id, r);
    return m;
  }, [riders]);

  // Riders working YOUR orders only
  const myRiders = useMemo(
    () =>
      inFlight
        .map((o) => (o.rider_id ? ridersById.get(o.rider_id) : null))
        .filter((r): r is Rider => !!r && !!r.current_lat && !!r.current_lng),
    [inFlight, ridersById]
  );

  return (
    <div className="px-5 sm:px-8 py-6 max-w-6xl">
      <header className="mb-4">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          Live operations
        </div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
            Your bodas right now
          </h1>
          {inFlight.length > 0 && (
            <span className="pill-delivering">
              <span className="live-dot" />
              {inFlight.length} active
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Every boda working a Tukole order from {`{`}your shop{`}`} on one map. Tap a
          rider for details.
        </p>
      </header>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 card overflow-hidden h-[500px]">
          <FleetMap orders={inFlight} riders={myRiders} sellerId={id} />
        </section>

        <aside className="space-y-3">
          <div className="card p-4">
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
              <Activity className="w-3 h-3 inline mr-1" /> Active deliveries
            </div>
            {inFlight.length === 0 ? (
              <div className="text-sm text-ink-500">
                No deliveries in motion right now.
              </div>
            ) : (
              <div className="space-y-2">
                {inFlight.map((o) => {
                  const rider = o.rider_id ? ridersById.get(o.rider_id) : null;
                  return (
                    <Link
                      key={o.id}
                      href={`/seller/${id}/orders/${o.id}`}
                      className="block p-3 rounded-card border border-sand-200 hover:bg-sand-100"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-ink-500">
                            {o.short_code}
                          </div>
                          <div className="text-sm text-ink-900 truncate">
                            {o.customer_name}
                          </div>
                          <div className="text-xs text-ink-500 truncate">
                            {rider?.full_name || "—"} → {o.customer_area}
                          </div>
                        </div>
                        <StatusPill status={o.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
