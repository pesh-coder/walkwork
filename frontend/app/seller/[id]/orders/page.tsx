"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { sellersApi, type Order } from "@/lib/api";
import { ugx, relTime, isInFlight, isTerminal } from "@/lib/format";

type Filter = "all" | "in_flight" | "settled" | "disputed";

export default function OrdersListPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const o = await sellersApi.orders(id);
        if (!cancelled) {
          setOrders(o);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  const filtered = useMemo(() => {
    let r = orders;
    if (filter === "in_flight") r = r.filter((o) => isInFlight(o.status));
    if (filter === "settled") r = r.filter((o) => o.status === "settled");
    if (filter === "disputed")
      r = r.filter((o) => o.status === "disputed" || o.status === "refunded");

    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (o) =>
          o.short_code.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_area.toLowerCase().includes(q) ||
          o.item_description.toLowerCase().includes(q)
      );
    }
    return r;
  }, [orders, filter, search]);

  return (
    <div className="px-5 sm:px-8 py-6 max-w-6xl">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-500">
            All orders
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
            Orders <span className="text-ink-500 text-2xl">({orders.length})</span>
          </h1>
        </div>
        <Link href={`/seller/${id}/new-order`} className="btn-coral">
          <Plus className="w-4 h-4" />
          New order
        </Link>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, customer, area..."
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-1 bg-sand-100 rounded-chip p-1">
          {([
            ["all", "All"],
            ["in_flight", "In flight"],
            ["settled", "Settled"],
            ["disputed", "Disputed"],
          ] as [Filter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-chip text-xs font-medium transition ${
                filter === key
                  ? "bg-teal-600 text-sand-50"
                  : "text-ink-700 hover:bg-sand-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="font-display text-xl text-ink-900">
            {orders.length === 0 ? "No orders yet" : "Nothing matches"}
          </div>
          <div className="text-sm text-ink-500 mt-1">
            {orders.length === 0
              ? "Create your first order to get started."
              : "Try adjusting the search or filter."}
          </div>
          {orders.length === 0 && (
            <Link
              href={`/seller/${id}/new-order`}
              className="btn-primary mt-4 inline-flex"
            >
              Create order
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand-100 text-[11px] uppercase tracking-wider text-ink-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Order</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Item</th>
                <th className="text-right px-4 py-3 font-medium">Value</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
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
                  <td className="px-4 py-3">
                    <div className="text-sm text-ink-900">{o.customer_name}</div>
                    <div className="text-xs text-ink-500">{o.customer_area}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="text-sm text-ink-700 truncate max-w-[260px]">
                      {o.item_description}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-display tabular text-ink-900">
                      {ugx(o.item_value_ugx)}
                    </div>
                    <div className="text-xs text-ink-500">
                      +{ugx(o.delivery_fee_ugx)}
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
    </div>
  );
}
