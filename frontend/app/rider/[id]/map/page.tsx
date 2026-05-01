"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { ridersApi, type Rider, type Order } from "@/lib/api";
import { ugx } from "@/lib/format";

const OrderMap = dynamic(() => import("@/components/OrderMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100 rounded-card">
      <span className="text-sm text-ink-500">Loading map…</span>
    </div>
  ),
});

export default function RiderMapPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [rider, setRider] = useState<Rider | null>(null);
  const [jobs, setJobs] = useState<Order[]>([]);

  async function load() {
    try {
      const [r, j] = await Promise.all([ridersApi.get(id), ridersApi.jobs(id)]);
      setRider(r); setJobs(j);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const active = jobs[0];

  return (
    <div className="px-5 sm:px-8 py-6 max-w-4xl">
      <header className="mb-4">
        <div className="text-xs uppercase tracking-wider text-ink-500">Map</div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
          {active ? "Your route" : "Your position"}
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          {active
            ? `Heading to ${active.customer_name} in ${active.customer_area}`
            : "Move into a busy area to get jobs."}
        </p>
      </header>

      <section className="card overflow-hidden h-[400px] mb-4">
        <OrderMap
          pickupLat={active?.pickup_lat || null}
          pickupLng={active?.pickup_lng || null}
          customerLat={active?.customer_lat || null}
          customerLng={active?.customer_lng || null}
          riderLat={rider?.current_lat || null}
          riderLng={rider?.current_lng || null}
          riderName={rider?.full_name}
          defaultLayer="satellite"
        />
      </section>

      {active && (
        <Link
          href={`/rider/${id}/jobs/${active.id}`}
          className="card p-4 flex items-center justify-between hover:shadow-lift"
        >
          <div className="flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-teal-700" />
            <div>
              <div className="text-sm font-medium text-ink-900">{active.customer_name}</div>
              <div className="text-xs text-ink-500">{active.short_code} · {ugx(active.delivery_fee_ugx)}</div>
            </div>
          </div>
          <StatusPill status={active.status} />
        </Link>
      )}
    </div>
  );
}
