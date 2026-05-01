"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Phone, MapPin } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import {
  ordersApi, ridersApi,
  type Order, type Rider,
} from "@/lib/api";
import { ugx } from "@/lib/format";

const OrderMap = dynamic(() => import("@/components/OrderMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100">
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
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [o, r] = await Promise.all([
        ordersApi.get(orderId),
        ridersApi.get(id),
      ]);
      setOrder(o);
      setRider(r);
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
  }, [orderId, id]);

  if (error && !order) {
    return (
      <div className="px-5 py-6">
        <div className="card p-8 max-w-md text-center mx-auto">
          <AlertCircle className="w-8 h-8 mx-auto text-coral-500" />
          <h1 className="font-display text-xl mt-3">Job not found</h1>
          <p className="text-ink-500 text-sm mt-1">{error}</p>
          <Link href={`/rider/${id}`} className="btn-secondary mt-4 inline-flex">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return <div className="px-5 py-6 text-sm text-ink-500">Loading job…</div>;
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl">
      <Link
        href={`/rider/${id}`}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        All jobs
      </Link>

      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs text-ink-500">{order.short_code}</div>
          <h1 className="font-display text-2xl text-ink-900 truncate">
            {order.customer_name}
          </h1>
          <div className="text-xs text-ink-500">
            {order.customer_area}
          </div>
        </div>
        <StatusPill status={order.status} />
      </header>

      <section className="card overflow-hidden h-[280px] mb-4">
        <OrderMap
          pickupLat={order.pickup_lat}
          pickupLng={order.pickup_lng}
          customerLat={order.customer_lat}
          customerLng={order.customer_lng}
          riderLat={rider?.current_lat || null}
          riderLng={rider?.current_lng || null}
          riderName={rider?.full_name}
          defaultLayer="satellite"
        />
      </section>

      <div className="card-coral p-3 flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider opacity-80">
            Your earnings on this trip
          </div>
          <div className="font-display text-xl tabular leading-tight">
            {ugx(order.delivery_fee_ugx)}
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <Detail label="Item" value={order.item_description} />
        <Detail label="Item value" value={ugx(order.item_value_ugx)} />
        {order.customer_address_notes && (
          <Detail label="Notes" value={order.customer_address_notes} />
        )}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-sand-200">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-500">
              Customer phone
            </div>
            <div className="text-sm text-ink-900">{order.customer_phone}</div>
          </div>
          <a href={`tel:${order.customer_phone}`} className="btn-secondary">
            <Phone className="w-4 h-4" />
            Call
          </a>
        </div>
      </div>

      <Link href={`/rider/${id}`} className="btn-primary w-full justify-center mt-4">
        Continue this delivery
      </Link>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-sm text-ink-900">{value}</div>
    </div>
  );
}
