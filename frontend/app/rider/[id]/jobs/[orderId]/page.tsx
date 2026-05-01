"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Phone, MapPin, Package, AlertCircle, Camera } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import {
  ordersApi, ridersApi,
  type Order, type Rider, type Photo,
} from "@/lib/api";
import { ugx, timeOnly } from "@/lib/format";

const OrderMap = dynamic(() => import("@/components/OrderMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100 rounded-card">
      <span className="text-sm text-ink-500">Loading map…</span>
    </div>
  ),
});

export default function RiderJobDetailPage({
  params,
}: {
  params: { id: string; orderId: string };
}) {
  const { id, orderId } = params;
  const [order, setOrder] = useState<Order | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [o, r] = await Promise.all([
        ordersApi.get(orderId),
        ridersApi.get(id),
      ]);
      setOrder(o);
      setRider(r);
      try { setPhotos(await ordersApi.listPhotos(orderId)); } catch {}
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
  }, [orderId]);

  if (error && !order) {
    return (
      <div className="px-5 py-6">
        <div className="card p-8 max-w-md text-center mx-auto">
          <AlertCircle className="w-8 h-8 mx-auto text-coral-500" />
          <h1 className="font-display text-xl mt-3">Order not found</h1>
          <p className="text-ink-500 text-sm mt-1">{error}</p>
          <Link href={`/rider/${id}`} className="btn-secondary mt-4 inline-flex">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }
  if (!order) return <div className="px-5 py-6 text-sm text-ink-500">Loading…</div>;

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl">
      <Link href={`/rider/${id}`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 mb-3">
        <ArrowLeft className="w-4 h-4" /> All jobs
      </Link>

      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-xs text-ink-500">{order.short_code}</div>
          <h1 className="font-display text-2xl sm:text-3xl text-ink-900 leading-tight mt-1">{order.customer_name}</h1>
          <div className="text-sm text-ink-500 mt-1">{order.customer_area}</div>
        </div>
        <StatusPill status={order.status} className="text-sm px-3 py-1.5" />
      </header>

      <section className="card overflow-hidden h-[280px] mb-4">
        <OrderMap
          pickupLat={order.pickup_lat} pickupLng={order.pickup_lng}
          customerLat={order.customer_lat} customerLng={order.customer_lng}
          riderLat={rider?.current_lat || null} riderLng={rider?.current_lng || null}
          riderName={rider?.full_name}
        />
      </section>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
            <Package className="w-3 h-3 inline mr-1" /> Item
          </div>
          <div className="text-sm text-ink-900">{order.item_description}</div>
        </div>
        <div className="card-coral p-4">
          <div className="text-[11px] uppercase tracking-wider opacity-80">Your earnings</div>
          <div className="font-display text-2xl tabular leading-tight mt-1">{ugx(order.delivery_fee_ugx)}</div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
          <MapPin className="w-3 h-3 inline mr-1" /> Customer
        </div>
        <div className="text-sm font-medium text-ink-900">{order.customer_name}</div>
        <a href={`tel:${order.customer_phone}`} className="text-sm text-teal-700 hover:underline inline-flex items-center gap-1 mt-0.5">
          <Phone className="w-3 h-3" /> {order.customer_phone}
        </a>
        {order.customer_address_notes && (
          <div className="text-sm text-ink-700 mt-2 p-3 rounded-card bg-sand-100">
            {order.customer_address_notes}
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
            <Camera className="w-3 h-3 inline mr-1" /> Photos
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <img src={p.image_data} alt={p.phase} className="w-full aspect-square object-cover" />
                <div className="p-2 text-[10px] uppercase tracking-wider text-ink-500">
                  {p.phase.replace("_", " ")} · {timeOnly(p.created_at)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
