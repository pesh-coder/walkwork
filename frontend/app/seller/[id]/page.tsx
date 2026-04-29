"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet, Package, ArrowUpRight, Plus, RefreshCw, ExternalLink,
  TrendingUp, AlertCircle, MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { StatusPill } from "@/components/StatusPill";
import {
  sellersApi,
  type Seller, type Order, type LedgerEntry,
} from "@/lib/api";
import {
  ugx, num, dateTime, relTime, timeOnly,
  PAYMENT_LABEL, LEDGER_LABEL, ledgerSign, ledgerColor,
} from "@/lib/format";

export default function SellerPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "ledger">("orders");

  async function loadAll() {
    try {
      const [s, o, l] = await Promise.all([
        sellersApi.get(id),
        sellersApi.orders(id),
        sellersApi.ledger(id),
      ]);
      setSeller(s);
      setOrders(o);
      setLedger(l);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 8_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error && !seller) {
    return <ErrorScreen message={error} />;
  }
  if (!seller) {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-screen">
      <Header seller={seller} onRefresh={loadAll} />

      <div className="mx-auto max-w-5xl px-5 py-6 space-y-6">
        <Stats seller={seller} orders={orders} />

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-cream-200">
          <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
            Orders
            <span className="ml-2 text-xs text-ink-500">({orders.length})</span>
          </TabButton>
          <TabButton active={tab === "ledger"} onClick={() => setTab("ledger")}>
            Cash flow
            <span className="ml-2 text-xs text-ink-500">({ledger.length})</span>
          </TabButton>
        </div>

        {tab === "orders" ? (
          <OrdersList orders={orders} />
        ) : (
          <LedgerView entries={ledger} />
        )}

        <WhatsAppCallout phone={seller.phone} />
      </div>
    </main>
  );
}

// =============================================================================
// Header
// =============================================================================
function Header({ seller, onRefresh }: { seller: Seller; onRefresh: () => void }) {
  return (
    <header className="border-b border-cream-200 bg-cream-50/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size="md" />
          <div className="hidden sm:block w-px h-6 bg-cream-300" />
          <div className="hidden sm:block">
            <div className="text-xs text-ink-500">Welcome back</div>
            <div className="font-display text-base text-ink-900 leading-tight">
              {seller.business_name}
            </div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="btn-secondary"
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}

// =============================================================================
// Top-line stats
// =============================================================================
function Stats({ seller, orders }: { seller: Seller; orders: Order[] }) {
  const stats = useMemo(() => {
    const settled = orders.filter((o) => o.status === "settled");
    const inFlight = orders.filter((o) =>
      ["assigned", "picked_up", "delivering", "otp_pending", "delivered"].includes(o.status)
    );
    const failed = orders.filter((o) => o.status === "failed").length;
    const successRate =
      orders.length > 0
        ? Math.round(((orders.length - failed) / orders.length) * 100)
        : 100;
    return { settled: settled.length, inFlight: inFlight.length, successRate };
  }, [orders]);

  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <BigStat
        label="Wallet balance"
        value={ugx(seller.wallet_balance_ugx)}
        icon={Wallet}
        accent
      />
      <BigStat
        label="In flight"
        value={`${stats.inFlight}`}
        sub="active deliveries"
        icon={Package}
      />
      <BigStat
        label="Completed"
        value={`${stats.settled}`}
        sub="all-time"
        icon={ArrowUpRight}
      />
      <BigStat
        label="Success rate"
        value={`${stats.successRate}%`}
        sub="delivered"
        icon={TrendingUp}
      />
    </section>
  );
}

function BigStat({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon: any; accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "card p-4 bg-forest-700 text-cream-50 border-forest-700"
          : "card p-4"
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            "text-[11px] uppercase tracking-wider " +
            (accent ? "text-cream-200/80" : "text-ink-500")
          }
        >
          {label}
        </span>
        <Icon
          className={"w-4 h-4 " + (accent ? "text-cream-200" : "text-ink-500")}
        />
      </div>
      <div
        className={
          "mt-1.5 font-display text-2xl tabular leading-tight " +
          (accent ? "text-cream-50" : "text-ink-900")
        }
      >
        {value}
      </div>
      {sub && (
        <div
          className={
            "text-xs mt-0.5 " +
            (accent ? "text-cream-200/70" : "text-ink-500")
          }
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tab button
// =============================================================================
function TabButton({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition " +
        (active
          ? "border-terracotta-500 text-ink-900"
          : "border-transparent text-ink-500 hover:text-ink-700")
      }
    >
      {children}
    </button>
  );
}

// =============================================================================
// Orders list
// =============================================================================
function OrdersList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="card p-10 text-center">
        <Package className="w-10 h-10 mx-auto text-ink-500" />
        <div className="font-display text-xl text-ink-900 mt-3">No orders yet</div>
        <p className="text-sm text-ink-500 mt-1">
          Send a WhatsApp message to your Tukole bot to create your first order.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead className="bg-cream-100 text-[11px] uppercase tracking-wider text-ink-500">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Order</th>
            <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Customer</th>
            <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Item</th>
            <th className="text-right px-4 py-3 font-medium">Value</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              className="border-t border-cream-200 hover:bg-cream-100/50 transition"
            >
              <td className="px-4 py-3">
                <div className="font-mono text-sm text-ink-900">{o.short_code}</div>
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
                <div className="text-xs text-ink-500">{PAYMENT_LABEL[o.payment_mode]}</div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="font-display text-base tabular text-ink-900">
                  {ugx(o.item_value_ugx)}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusPill status={o.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/track/${o.short_code}`}
                  target="_blank"
                  className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 text-xs"
                >
                  Track <ExternalLink className="w-3 h-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Ledger — the cash differentiator
// =============================================================================
function LedgerView({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="card p-10 text-center">
        <Wallet className="w-10 h-10 mx-auto text-ink-500" />
        <div className="font-display text-xl text-ink-900 mt-3">No transactions yet</div>
        <p className="text-sm text-ink-500 mt-1">
          Top up your wallet and create an order to see your cash flow here.
        </p>
      </div>
    );
  }

  // Group by day for the ledger paper effect
  const groups: { day: string; entries: LedgerEntry[] }[] = [];
  for (const entry of entries) {
    const day = new Date(entry.created_at).toLocaleDateString("en-UG", {
      weekday: "long", month: "short", day: "numeric", year: "numeric",
    });
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.day === day) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ day, entries: [entry] });
    }
  }

  return (
    <div className="space-y-6">
      <div className="ledger-paper p-6 sm:p-8">
        <div className="flex items-end justify-between border-b border-ledger-rule pb-4 mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-500">
              Cash flow ledger
            </div>
            <div className="font-display text-2xl text-ink-900">
              Every shilling, accounted for
            </div>
          </div>
          <div className="text-xs text-ink-500 hidden sm:block">
            {entries.length} entries
          </div>
        </div>

        {groups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-6" : ""}>
            <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-2">
              {group.day}
            </div>
            <div>
              {group.entries.map((entry, idx) => (
                <LedgerRow key={entry.id} entry={entry} first={idx === 0} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LedgerRow({ entry, first }: { entry: LedgerEntry; first: boolean }) {
  const sign = ledgerSign(entry.entry_type);
  const color = ledgerColor(entry.entry_type);
  const label = LEDGER_LABEL[entry.entry_type];

  return (
    <motion.div
      initial={first ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-3 border-b border-dashed border-ledger-rule last:border-0"
    >
      <div className="w-14 text-xs font-mono text-ink-500 tabular shrink-0">
        {timeOnly(entry.created_at)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-900 truncate">{label}</div>
        <div className="text-xs text-ink-500 truncate">{entry.description}</div>
      </div>
      <div
        className={
          "text-right font-display text-lg tabular shrink-0 " +
          (color === "credit"
            ? "text-ledger-credit"
            : color === "debit"
            ? "text-ledger-debit"
            : "text-ink-700")
        }
      >
        {sign}
        {num(entry.amount_ugx)}
      </div>
    </motion.div>
  );
}

// =============================================================================
// WhatsApp callout
// =============================================================================
function WhatsAppCallout({ phone }: { phone: string }) {
  return (
    <div className="card p-5 bg-forest-500/5 border-forest-500/20">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-forest-600 flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5 text-cream-50" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg text-ink-900">
            Create orders from WhatsApp
          </div>
          <p className="text-sm text-ink-700 mt-1">
            Send a message to your Tukole bot in this format:
          </p>
          <code className="block mt-2 px-3 py-2 bg-cream-100 rounded font-mono text-xs text-ink-900 overflow-x-auto">
            Order: Bukoto, 0772999888, Jane, dress UGX 85,000 COD
          </code>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// States
// =============================================================================
function LoadingScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-ink-500 text-sm">Loading dashboard…</div>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 max-w-md text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-terracotta-500" />
        <h1 className="font-display text-xl mt-3">Couldn't load dashboard</h1>
        <p className="text-ink-500 text-sm mt-1">{message}</p>
      </div>
    </main>
  );
}
