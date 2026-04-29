"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Package, MapPin, CheckCircle2, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ordersApi, type OrderTrack } from "@/lib/api";
import { STATUS_LABEL } from "@/lib/format";

// Map is client-only (Leaflet doesn't SSR cleanly)
const TrackingMap = dynamic(() => import("@/components/TrackingMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-cream-100 rounded-card">
      <div className="text-ink-500 text-sm">Loading map…</div>
    </div>
  ),
});

const STAGES: { key: OrderTrack["status"]; label: string }[] = [
  { key: "pending", label: "Order placed" },
  { key: "assigned", label: "Rider assigned" },
  { key: "picked_up", label: "Picked up" },
  { key: "delivering", label: "On the way" },
  { key: "otp_pending", label: "At your door" },
  { key: "delivered", label: "Delivered" },
];

const STAGE_ORDER: Record<OrderTrack["status"], number> = {
  pending: 0,
  assigned: 1,
  picked_up: 2,
  delivering: 3,
  otp_pending: 4,
  delivered: 5,
  settled: 5,
  failed: -1,
};

export default function TrackPage({ params }: { params: { shortCode: string } }) {
  const { shortCode } = params;
  const [track, setTrack] = useState<OrderTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await ordersApi.track(shortCode);
        if (!cancelled) {
          setTrack(data);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    const interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shortCode]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <h1 className="font-display text-xl mb-2">Order not found</h1>
          <p className="text-ink-500 text-sm">{error}</p>
        </div>
      </main>
    );
  }

  if (!track) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-ink-500 text-sm">Loading order…</div>
      </main>
    );
  }

  const currentStage = STAGE_ORDER[track.status];
  const isFailed = track.status === "failed";

  return (
    <main className="min-h-screen pb-12">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Logo size="sm" />
        <div className="text-xs font-mono text-ink-500">{track.short_code}</div>
      </header>

      {/* Status hero */}
      <section className="px-5">
        <motion.div
          key={track.status}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card p-6"
        >
          <div className="flex items-center gap-2 text-sm text-ink-500 mb-2">
            <Package className="w-4 h-4" />
            <span>{track.item_description}</span>
          </div>

          <h1 className="font-display text-3xl text-ink-900 leading-tight">
            {isFailed ? "Delivery failed" : STATUS_LABEL[track.status]}
          </h1>

          {track.estimated_minutes != null && track.status !== "delivered" && track.status !== "settled" && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-terracotta-600">
              <Clock className="w-4 h-4" />
              <span>about {track.estimated_minutes} min away</span>
            </div>
          )}

          {(track.status === "delivered" || track.status === "settled") && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-forest-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Delivered safely</span>
            </div>
          )}
        </motion.div>
      </section>

      {/* Map */}
      <section className="px-5 mt-4">
        <div className="card overflow-hidden h-[280px]">
          <TrackingMap
            riderLat={track.rider_lat}
            riderLng={track.rider_lng}
            riderName={track.rider_name}
            customerLat={track.customer_lat}
            customerLng={track.customer_lng}
          />
        </div>
      </section>

      {/* Rider card */}
      {track.rider_name && (
        <section className="px-5 mt-4">
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
              Your rider
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold text-ink-900">
                  {track.rider_name}
                </div>
                {track.rider_plate && (
                  <div className="text-sm font-mono text-ink-500">
                    {track.rider_plate}
                  </div>
                )}
              </div>
              {track.rider_phone && (
                <a
                  href={`tel:${track.rider_phone}`}
                  className="btn-primary"
                  aria-label="Call rider"
                >
                  <Phone className="w-4 h-4" />
                  Call
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Stage timeline */}
      <section className="px-5 mt-4">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500 mb-4">
            Progress
          </div>
          <ol className="space-y-3">
            {STAGES.map((stage, idx) => {
              const reached = currentStage >= idx && !isFailed;
              const active = currentStage === idx && !isFailed;
              return (
                <li key={stage.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-0.5">
                    <div
                      className={
                        "w-3 h-3 rounded-full border-2 " +
                        (reached
                          ? "bg-forest-500 border-forest-500"
                          : "bg-cream-50 border-cream-300")
                      }
                    />
                    {idx < STAGES.length - 1 && (
                      <div
                        className={
                          "w-0.5 h-6 mt-1 " +
                          (currentStage > idx && !isFailed
                            ? "bg-forest-500"
                            : "bg-cream-300")
                        }
                      />
                    )}
                  </div>
                  <div className="flex-1 -mt-0.5">
                    <div
                      className={
                        "text-sm " +
                        (active
                          ? "font-semibold text-ink-900"
                          : reached
                          ? "text-ink-700"
                          : "text-ink-500")
                      }
                    >
                      {stage.label}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* OTP hint */}
      <AnimatePresence>
        {track.status === "otp_pending" && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-5 mt-4"
          >
            <div className="card p-5 bg-terracotta-400/10 border-terracotta-400/30">
              <div className="font-display text-lg text-terracotta-700 mb-1">
                Check your SMS for a code
              </div>
              <div className="text-sm text-ink-700">
                Read the 4-digit code to your rider to confirm you received the package.
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <footer className="px-5 mt-8 text-center">
        <div className="text-xs text-ink-500">
          Powered by <Logo size="sm" />
        </div>
      </footer>
    </main>
  );
}
