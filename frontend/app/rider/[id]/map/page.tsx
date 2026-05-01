"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  ridersApi,
  type Rider, type Order,
} from "@/lib/api";

const FleetMap = dynamic(() => import("@/components/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100">
      <span className="text-sm text-ink-500">Loading map…</span>
    </div>
  ),
});

export default function RiderMapPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [rider, setRider] = useState<Rider | null>(null);
  const [jobs, setJobs] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [r, j] = await Promise.all([ridersApi.get(id), ridersApi.jobs(id)]);
      setRider(r);
      setJobs(j);
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

  const ridersList = useMemo(() => (rider ? [rider] : []), [rider]);

  return (
    <div className="px-5 sm:px-8 py-6 max-w-5xl">
      <header className="mb-4">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          Live map
        </div>
        <h1 className="font-display text-3xl text-ink-900 leading-tight">
          You and your jobs
        </h1>
      </header>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">
          {error}
        </div>
      )}

      <section className="card overflow-hidden h-[500px]">
        <FleetMap orders={jobs} riders={ridersList} sellerId="" />
      </section>

      {jobs.length > 0 && (
        <section className="mt-4">
          <h2 className="font-display text-lg text-ink-900 mb-2">Your stops</h2>
          <div className="space-y-2">
            {jobs.map((o) => (
              <Link
                key={o.id}
                href={`/rider/${id}/jobs/${o.id}`}
                className="card p-3 flex items-center justify-between hover:bg-sand-100"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-ink-500">{o.short_code}</div>
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {o.customer_name} — {o.customer_area}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-500" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
