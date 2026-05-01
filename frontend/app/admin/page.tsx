"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity, Wallet, Package, ShieldCheck, TrendingUp, Users,
  Bike, AlertCircle, Sparkles, Plus, RefreshCw, Inbox,
  CheckCircle2, MessageSquare,
} from "lucide-react";
import {
  adminApi, ridersApi, sellersApi,
  type AdminStats, type ActivityItem, type AdminOrderRow,
  type Order as ApiOrder, type Rider as ApiRider,
} from "@/lib/api";
import { ugx, num, relTime, isInFlight } from "@/lib/format";

const FleetMap = dynamic(() => import("@/components/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100 rounded-card">
      <span className="text-sm text-ink-500">Loading map…</span>
    </div>
  ),
});

export default function TukoleAdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [riders, setRiders] = useState<ApiRider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function load() {
    try {
      const [s, a, o, r] = await Promise.all([
        adminApi.stats(),
        adminApi.activity(40),
        adminApi.allOrders(),
        ridersApi.listAll(),
      ]);
      setStats(s);
      setActivity(a);
      setOrders(o);
      setRiders(r);
      setError(null);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  // Convert AdminOrderRow → minimal Order shape that FleetMap can consume.
  // We also need lat/lng on customer + pickup; the AdminOrderRow doesn't include those,
  // so for the map we work with the activeOrders list from a richer source.
  const inFlightOrders: ApiOrder[] = useMemo(() => {
    return orders
      .filter((o) => isInFlight(o.status as any) && o.rider !== null)
      .map((o) => ({
        // We use AdminOrderRow but reshape — most fields the map cares about
        // come from elsewhere; here we only need rider_id + customer_lat/lng.
        // Since the current /admin/orders doesn't return geo, FleetMap will
        // gracefully render riders without per-order routes. Good enough.
        id: o.id,
        short_code: o.short_code,
        seller_id: "",
        customer_name: o.customer_name,
        customer_phone: "",
        customer_area: o.customer_area,
        customer_lat: null,
        customer_lng: null,
        rider_id: null,
        item_description: o.item,
        item_value_ugx: o.value_ugx,
        delivery_fee_ugx: o.delivery_fee_ugx,
        commission_rate_bps: 500,
        platform_fee_ugx: 1500,
        escrow_status: o.escrow_status as any,
        status: o.status as any,
        created_at: o.created_at,
      }) as unknown as ApiOrder);
  }, [orders]);

  if (error && !stats) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5">
        <div className="card p-8 max-w-md text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-coral-500" />
          <h1 className="font-display text-xl mt-3">Couldn't load admin</h1>
          <p className="text-ink-500 text-sm mt-1">{error}</p>
        </div>
      </main>
    );
  }

  const headline = stats?.headline;
  const counts = stats?.counts;

  return (
    <>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6">
        {/* Title row */}
        <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-500">
              Tukole control room
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
              Platform overview
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              Every seller, every rider, every shilling in motion.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-ink-500">
              {lastRefresh && `Updated ${lastRefresh.toLocaleTimeString("en-UG", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: false })}`}
            </span>
            <button onClick={load} className="btn-secondary text-xs">
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* Headline metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Metric
            label="Platform revenue · all-time"
            value={ugx(headline?.platform_revenue_total_ugx ?? 0)}
            sub={`+${ugx(headline?.platform_revenue_today_ugx ?? 0)} today`}
            tone="primary"
            icon={TrendingUp}
          />
          <Metric
            label="GMV · this week"
            value={ugx(headline?.gmv_week_ugx ?? 0)}
            sub={`${ugx(headline?.gmv_total_ugx ?? 0)} all-time`}
            icon={Wallet}
          />
          <Metric
            label="Held in escrow"
            value={ugx(headline?.held_in_escrow_ugx ?? 0)}
            sub="across all live orders"
            tone="coral"
            icon={ShieldCheck}
          />
          <Metric
            label="Active orders"
            value={`${counts?.orders_in_flight ?? 0}`}
            sub={`${counts?.orders_total ?? 0} total · ${counts?.settlement_rate_pct ?? 0}% settled`}
            icon={Package}
          />
        </section>

        {/* Secondary metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SmallMetric
            label="Sellers"
            value={counts?.sellers_total ?? 0}
            sub={`${counts?.sellers_active_week ?? 0} active this week`}
            icon={Users}
          />
          <SmallMetric
            label="Riders online"
            value={counts?.riders_online_now ?? 0}
            sub={`${counts?.riders_total ?? 0} registered`}
            icon={Bike}
          />
          <SmallMetric
            label="Customers"
            value={counts?.customers_total ?? 0}
            sub="unique phone numbers"
            icon={Users}
          />
          <SmallMetric
            label="Disputes"
            value={counts?.orders_disputed ?? 0}
            sub="awaiting review"
            icon={AlertCircle}
            tone={
              counts && counts.orders_disputed > 0 ? "coral" : "default"
            }
          />
        </section>

        {/* Map + Activity */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <section className="lg:col-span-2 card overflow-hidden">
            <div className="px-4 py-3 border-b border-sand-200 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-500">
                  Live operations
                </div>
                <div className="font-display text-lg text-ink-900 leading-tight">
                  Kampala right now
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Legend dot="bg-teal-600" label="Riders" />
                <Legend dot="bg-coral-500" label="Customers" />
              </div>
            </div>
            <div className="h-[480px]">
              <FleetMap
                orders={inFlightOrders}
                riders={riders}
                sellerId="admin"
              />
            </div>
          </section>

          <aside className="card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-sand-200 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-500">
                  Activity
                </div>
                <div className="font-display text-lg text-ink-900 leading-tight">
                  Recent events
                </div>
              </div>
              <Activity className="w-4 h-4 text-ink-500" />
            </div>
            <div className="flex-1 overflow-y-auto max-h-[480px] divide-y divide-sand-200">
              {activity.length === 0 ? (
                <div className="p-6 text-sm text-ink-500 text-center">
                  Nothing yet.
                </div>
              ) : (
                activity.map((item, i) => (
                  <ActivityRow key={`${item.at}-${i}`} item={item} />
                ))
              )}
            </div>
          </aside>
        </div>

        {/* Recent orders table */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-500">
                Order log
              </div>
              <h2 className="font-display text-xl text-ink-900">
                Every Tukole order
              </h2>
            </div>
            <span className="text-xs text-ink-500">
              {orders.length} total
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="card p-8 text-center text-ink-500">
              No orders yet. Have a seller create one to see it here.
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-sand-100 text-[11px] uppercase tracking-wider text-ink-500">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Order</th>
                      <th className="text-left px-4 py-3 font-medium">Seller</th>
                      <th className="text-left px-4 py-3 font-medium">Customer</th>
                      <th className="text-left px-4 py-3 font-medium">Item</th>
                      <th className="text-left px-4 py-3 font-medium">Rider</th>
                      <th className="text-right px-4 py-3 font-medium">Value</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Escrow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 50).map((o) => (
                      <tr
                        key={o.id}
                        className="border-t border-sand-200 hover:bg-sand-100/50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-ink-900">
                            {o.short_code}
                          </div>
                          <div className="text-xs text-ink-500">
                            {relTime(o.created_at)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-900">
                          {o.seller || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-ink-900">{o.customer_name}</div>
                          <div className="text-xs text-ink-500">{o.customer_area}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-ink-700 truncate max-w-[200px]">
                            {o.item}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-700">
                          {o.rider || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-display tabular text-ink-900">
                            {ugx(o.value_ugx)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`pill-${pillClassForStatus(o.status)}`}>
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-700 capitalize">
                          {o.escrow_status.replace(/_/g, " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------
function Metric({
  label,
  value,
  sub,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "primary" | "coral";
  icon: typeof Wallet;
}) {
  const cls =
    tone === "primary" ? "card-teal" : tone === "coral" ? "card-coral" : "card";
  const accent = tone !== "default";
  return (
    <div className={`${cls} p-4`}>
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] uppercase tracking-wider ${
            accent ? "opacity-80" : "text-ink-500"
          }`}
        >
          {label}
        </span>
        <Icon className={`w-4 h-4 ${accent ? "opacity-90" : "text-ink-500"}`} />
      </div>
      <div
        className={`mt-1.5 font-display text-2xl tabular leading-tight ${
          accent ? "" : "text-ink-900"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`text-xs mt-0.5 ${accent ? "opacity-75" : "text-ink-500"}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function SmallMetric({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  sub: string;
  icon: typeof Users;
  tone?: "default" | "coral";
}) {
  return (
    <div
      className={`card p-3 ${
        tone === "coral" ? "border-coral-200 bg-coral-50" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-ink-500">
          {label}
        </span>
        <Icon
          className={`w-4 h-4 ${
            tone === "coral" ? "text-coral-600" : "text-ink-500"
          }`}
        />
      </div>
      <div
        className={`font-display text-2xl tabular leading-tight ${
          tone === "coral" ? "text-coral-700" : "text-ink-900"
        } mt-1`}
      >
        {num(value)}
      </div>
      <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-ink-500">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const config = activityConfig[item.kind];
  const Icon = config.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: 4 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-4 py-3 flex items-start gap-3"
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}
      >
        <Icon className={`w-4 h-4 ${config.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-900 truncate">
          {item.title}
        </div>
        {item.subtitle && (
          <div className="text-xs text-ink-500 truncate">{item.subtitle}</div>
        )}
        <div className="text-[10px] text-ink-500 mt-0.5">{relTime(item.at)}</div>
      </div>
      {item.amount_ugx !== undefined && (
        <div className="text-sm font-display tabular text-ink-900 shrink-0">
          {ugx(item.amount_ugx)}
        </div>
      )}
    </motion.div>
  );
}

const activityConfig: Record<
  ActivityItem["kind"],
  { icon: typeof Plus; bg: string; text: string }
> = {
  order_created:    { icon: Plus,           bg: "bg-teal-100",  text: "text-teal-700" },
  escrow_deposit:   { icon: ShieldCheck,    bg: "bg-coral-100", text: "text-coral-600" },
  settled:          { icon: CheckCircle2,   bg: "bg-teal-200",  text: "text-teal-700" },
  dispute_opened:   { icon: AlertCircle,    bg: "bg-coral-200", text: "text-coral-700" },
  seller_signup:    { icon: Sparkles,       bg: "bg-sand-200",  text: "text-ink-700" },
  rider_signup:     { icon: Bike,           bg: "bg-sand-200",  text: "text-ink-700" },
};

function pillClassForStatus(status: string): string {
  switch (status) {
    case "pending":
    case "awaiting_payment": return "awaiting";
    case "paid_into_escrow": return "paid";
    case "assigned":
    case "picked_up": return "assigned";
    case "delivering":
    case "at_customer": return "delivering";
    case "delivered": return "delivered";
    case "approved":
    case "settled": return "settled";
    case "disputed": return "disputed";
    case "refunded": return "refunded";
    case "failed": return "failed";
    default: return "pending";
  }
}
