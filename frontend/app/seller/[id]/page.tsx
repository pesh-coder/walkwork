"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet, Package, ArrowUpRight, TrendingUp, Plus,
  Clock, ShieldCheck, AlertCircle,
} from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import {
  sellersApi,
  type Seller, type Order,
} from "@/lib/api";
import {
  ugx, num, dateTime, relTime,
  isInFlight, isTerminal,
} from "@/lib/format";

export default function SellerDashboard({ params }: { params: { id: string } }) {
  const { id } = params;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [s, o] = await Promise.all([
        sellersApi.get(id),
        sellersApi.orders(id),
      ]);
      setSeller(s);
      setOrders(o);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const stats = useMemo(() => {
    const now = Date.now();
    const today = orders.filter(
      (o) => new Date(o.created_at).getTime() > now - 24 * 3600 * 1000
    );
    const settled = orders.filter((o) => o.status === "settled");
    const inFlight = orders.filter((o) => isInFlight(o.status));
    const escrowHeld = orders
      .filter((o) => o.escrow_status === "held")
      .reduce((sum, o) => sum + (o.item_value_ugx + o.delivery_fee_ugx), 0);
    const todayRevenue = today
      .filter((o) => o.status === "settled")
      .reduce((sum, o) => {
        const commission = Math.floor((o.item_value_ugx * o.commission_rate_bps) / 10000);
        return sum + (o.item_value_ugx - commission);
      }, 0);
    const failed = orders.filter((o) => o.status === "failed" || o.status === "refunded").length;
    const completed = orders.filter((o) => isTerminal(o.status));
    const successRate =
      completed.length > 0
        ? Math.round(((completed.length - failed) / completed.length) * 100)
        : 100;

    return {
      todayRevenue,
      inFlight: inFlight.length,
      escrowHeld,
      successRate,
      total: orders.length,
      settled: settled.length,
    };
  }, [orders]);

  const inFlightOrders = orders.filter((o) => isInFlight(o.status)).slice(0, 5);
  const recentOrders = orders.slice(0, 8);

  if (error && !seller) {
    return <ErrorScreen message={error} />;
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-6xl">
      <header className="mb-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-500">
              Welcome back
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-ink-900">
              {seller?.business_name || "..."}
            </h1>
          </div>
          <Link href={`/seller/${id}/new-order`} className="btn-coral">
            <Plus className="w-4 h-4" />
            New order
          </Link>
        </div>
      </header>

      {/* Top-line stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <BigStat
          label="Wallet balance"
          value={ugx(seller?.wallet_balance_ugx ?? 0)}
          icon={Wallet}
          tone="primary"
        />
        <BigStat
          label="Held in escrow"
          value={ugx(stats.escrowHeld)}
          sub="across active orders"
          icon={ShieldCheck}
          tone="coral"
        />
        <BigStat
          label="In flight"
          value={`${stats.inFlight}`}
          sub="active deliveries"
          icon={Package}
        />
        <BigStat
          label="Success rate"
          value={`${stats.successRate}%`}
          sub={`${stats.settled} settled`}
          icon={TrendingUp}
        />
      </section>

      {/* In-flight live */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl text-ink-900">Active right now</h2>
          {inFlightOrders.length > 0 && (
            <Link
              href={`/seller/${id}/map`}
              className="text-sm text-teal-700 hover:underline inline-flex items-center gap-1"
            >
              See on map <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        {inFlightOrders.length === 0 ? (
          <div className="card p-8 text-center">
            <Clock className="w-8 h-8 mx-auto text-ink-500" />
            <div className="font-display text-lg text-ink-900 mt-3">
              No active deliveries
            </div>
            <div className="text-sm text-ink-500 mt-1">
              When you create an order, it'll show up here.
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {inFlightOrders.map((o) => (
              <Link
                key={o.id}
                href={`/seller/${id}/orders/${o.id}`}
                className="card p-4 hover:shadow-lift transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-ink-500">{o.short_code}</div>
                    <div className="font-display text-base text-ink-900 truncate mt-0.5">
                      {o.customer_name}
                    </div>
                    <div className="text-xs text-ink-500 truncate">
                      {o.customer_area} · {o.item_description}
                    </div>
                  </div>
                  <StatusPill status={o.status} className="shrink-0" />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
                  <span>{relTime(o.created_at)}</span>
                  <span className="font-display tabular text-ink-900">
                    {ugx(o.item_value_ugx + o.delivery_fee_ugx)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent orders table */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl text-ink-900">Recent orders</h2>
          <Link
            href={`/seller/${id}/orders`}
            className="text-sm text-teal-700 hover:underline inline-flex items-center gap-1"
          >
            See all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="font-display text-lg text-ink-900">No orders yet</div>
            <Link
              href={`/seller/${id}/new-order`}
              className="btn-primary mt-4 inline-flex"
            >
              Create your first order
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-sand-100 text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Order</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Customer</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Item</th>
                  <th className="text-right px-4 py-3 font-medium">Value</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-sand-200 hover:bg-sand-100/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/seller/${id}/orders/${o.id}`}
                        className="font-mono text-sm text-ink-900 hover:text-teal-700"
                      >
                        {o.short_code}
                      </Link>
                      <div className="text-xs text-ink-500">{relTime(o.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-sm text-ink-900">{o.customer_name}</div>
                      <div className="text-xs text-ink-500">{o.customer_area}</div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="text-sm text-ink-700 truncate max-w-[200px]">
                        {o.item_description}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-display tabular text-ink-900">
                        {ugx(o.item_value_ugx)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Wallet;
  tone?: "default" | "primary" | "coral";
}) {
  const toneClass =
    tone === "primary"
      ? "card-teal"
      : tone === "coral"
      ? "card-coral"
      : "card";
  const isAccent = tone !== "default";
  return (
    <div className={`${toneClass} p-4`}>
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] uppercase tracking-wider ${
            isAccent ? "opacity-80" : "text-ink-500"
          }`}
        >
          {label}
        </span>
        <Icon
          className={`w-4 h-4 ${isAccent ? "opacity-90" : "text-ink-500"}`}
        />
      </div>
      <div
        className={`mt-1.5 font-display text-2xl tabular leading-tight ${
          isAccent ? "" : "text-ink-900"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`text-xs mt-0.5 ${isAccent ? "opacity-75" : "text-ink-500"}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 max-w-md text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-coral-500" />
        <h1 className="font-display text-xl mt-3">Couldn't load dashboard</h1>
        <p className="text-ink-500 text-sm mt-1">{message}</p>
      </div>
    </main>
  );
}
