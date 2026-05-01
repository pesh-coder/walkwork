"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Phone, Copy, Check, Package, MapPin,
  ShieldCheck, AlertCircle, Image as ImageIcon, Clock,
  ExternalLink,
} from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import {
  ordersApi, ridersApi,
  type Order, type Rider, type Photo,
} from "@/lib/api";
import {
  ugx, num, dateTime, timeOnly, relTime, ESCROW_LABEL,
} from "@/lib/format";

const OrderMap = dynamic(() => import("@/components/OrderMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100 rounded-card">
      <span className="text-sm text-ink-500">Loading map…</span>
    </div>
  ),
});

const STAGES = [
  { key: "awaiting_payment", label: "Awaiting customer payment" },
  { key: "paid_into_escrow", label: "Funds secured in escrow" },
  { key: "assigned", label: "Rider assigned" },
  { key: "picked_up", label: "Picked up" },
  { key: "delivering", label: "On the way" },
  { key: "at_customer", label: "At customer's door" },
  { key: "delivered", label: "Delivered (awaiting approval)" },
  { key: "settled", label: "Settled" },
];

const STAGE_INDEX: Record<string, number> = {
  pending: 0,
  awaiting_payment: 0,
  paid_into_escrow: 1,
  assigned: 2,
  picked_up: 3,
  delivering: 4,
  at_customer: 5,
  delivered: 6,
  approved: 7,
  settled: 7,
};

export default function OrderDetailPage({
  params,
}: {
  params: { id: string; orderId: string };
}) {
  const { id, orderId } = params;
  const [order, setOrder] = useState<Order | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const o = await ordersApi.get(orderId);
      setOrder(o);
      if (o.rider_id) {
        try {
          setRider(await ridersApi.get(o.rider_id));
        } catch {}
      }
      try {
        setPhotos(await ordersApi.listPhotos(orderId));
      } catch {}
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
          <Link href={`/seller/${id}/orders`} className="btn-secondary mt-4 inline-flex">
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-5 py-6 text-sm text-ink-500">Loading order…</div>
    );
  }

  const trackUrl = `${window.location.origin}/track/${order.short_code}`;
  const stageIdx = STAGE_INDEX[order.status] ?? 0;
  const isFailed = order.status === "failed" || order.status === "refunded";
  const isDisputed = order.status === "disputed";

  const commission = Math.floor((order.item_value_ugx * order.commission_rate_bps) / 10000);
  const sellerPayout = order.item_value_ugx - commission;

  async function copyTrackUrl() {
    await navigator.clipboard.writeText(trackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-6xl">
      <Link
        href={`/seller/${id}/orders`}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        All orders
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-xs text-ink-500">{order.short_code}</div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight mt-1">
            {order.customer_name}
          </h1>
          <div className="text-sm text-ink-500 mt-1">
            {order.customer_area} · created {relTime(order.created_at)}
          </div>
        </div>
        <StatusPill status={order.status} className="text-sm px-3 py-1.5" />
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Map (spans 2 cols on desktop) */}
        <section className="lg:col-span-2 card overflow-hidden h-[400px]">
          <OrderMap
            pickupLat={order.pickup_lat}
            pickupLng={order.pickup_lng}
            customerLat={order.customer_lat}
            customerLng={order.customer_lng}
            riderLat={rider?.current_lat || null}
            riderLng={rider?.current_lng || null}
            riderName={rider?.full_name}
          />
        </section>

        {/* Right rail: rider + tracking link + actions */}
        <aside className="space-y-3">
          {/* Tracking link share */}
          <div className="card p-4">
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-1">
              Customer tracking link
            </div>
            <div className="text-xs font-mono text-ink-700 break-all">
              {trackUrl}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={copyTrackUrl} className="btn-secondary text-xs flex-1 justify-center">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={trackUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-xs flex-1 justify-center"
              >
                <ExternalLink className="w-3 h-3" />
                Open
              </a>
            </div>
          </div>

          {/* Rider card */}
          {rider ? (
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
                Rider
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-600 text-sand-50 flex items-center justify-center font-display text-sm">
                  {rider.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {rider.full_name}
                  </div>
                  <div className="text-xs text-ink-500">
                    {rider.plate_number || "—"} · {rider.stage}
                  </div>
                </div>
                <a
                  href={`tel:${rider.phone}`}
                  className="btn-secondary p-2"
                  aria-label="Call rider"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </div>
          ) : (
            <div className="card p-4 bg-sand-100">
              <div className="text-xs uppercase tracking-wider text-ink-500 mb-1">
                Rider
              </div>
              <div className="text-sm text-ink-500">
                {order.escrow_status === "held"
                  ? "Searching for the nearest available boda…"
                  : "A rider will be assigned once the customer pays."}
              </div>
            </div>
          )}

          {/* Customer info */}
          <div className="card p-4">
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
              Customer
            </div>
            <div className="text-sm text-ink-900">{order.customer_name}</div>
            <div className="text-xs text-ink-500 mt-1">{order.customer_phone}</div>
            {order.customer_address_notes && (
              <div className="text-xs text-ink-700 mt-2 leading-relaxed">
                <MapPin className="w-3 h-3 inline mr-1" />
                {order.customer_address_notes}
              </div>
            )}
            {order.customer_pin_confirmed_at && (
              <div className="mt-2 text-xs text-teal-700 inline-flex items-center gap-1">
                <Check className="w-3 h-3" />
                Pin confirmed by customer
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Status timeline + money */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <section className="card p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500 mb-3">
            Progress
          </div>
          {isFailed ? (
            <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700">
              Order {order.status}: {order.failure_reason || "(no reason given)"}
            </div>
          ) : (
            <ol className="space-y-3">
              {STAGES.map((stage, i) => {
                const reached = stageIdx >= i;
                const active = stageIdx === i && !isDisputed;
                return (
                  <li key={stage.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-0.5">
                      <div
                        className={
                          "w-3 h-3 rounded-full border-2 " +
                          (reached
                            ? "bg-teal-600 border-teal-600"
                            : "bg-sand-50 border-sand-300")
                        }
                      />
                      {i < STAGES.length - 1 && (
                        <div
                          className={
                            "w-0.5 h-6 mt-1 " +
                            (stageIdx > i ? "bg-teal-600" : "bg-sand-300")
                          }
                        />
                      )}
                    </div>
                    <div className="flex-1">
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
          )}
        </section>

        <section className="ledger-paper p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500 mb-3">
            Money split
          </div>
          <div className="space-y-2">
            <Row
              label="Customer paid into escrow"
              value={ugx(order.item_value_ugx + order.delivery_fee_ugx)}
              bold
            />
            <div className="text-xs text-ink-500 -mt-1">
              {ESCROW_LABEL[order.escrow_status]}
            </div>
            <Hr />
            <Row label="Item price" value={ugx(order.item_value_ugx)} muted />
            <Row label="Delivery fee" value={ugx(order.delivery_fee_ugx)} muted />
            <Hr />
            <Row label="You earn (after 5% commission)" value={ugx(sellerPayout)} positive />
            <Row label="Rider earns" value={ugx(order.delivery_fee_ugx)} muted />
            <Row label="Tukole keeps" value={ugx(commission + order.platform_fee_ugx)} muted />
          </div>
        </section>
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <section className="mt-4">
          <h2 className="font-display text-lg text-ink-900 mb-3">
            <ImageIcon className="inline w-4 h-4 mr-1.5 mb-0.5" />
            Evidence
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <img
                  src={p.image_data}
                  alt={p.phase}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2">
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">
                    {p.phase.replace("_", " ")}
                  </div>
                  <div className="text-xs text-ink-700">
                    {timeOnly(p.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  positive,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-sm ${muted ? "text-ink-500" : "text-ink-900"}`}>
        {label}
      </span>
      <span
        className={`tabular ${
          bold ? "font-display text-lg text-ink-900" : "text-sm"
        } ${positive ? "text-teal-700 font-semibold" : ""} ${
          muted && !positive ? "text-ink-500" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Hr() {
  return <div className="border-t border-dashed border-sand-300" />;
}
