"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowDownToLine } from "lucide-react";
import { ridersApi, type Rider, type LedgerEntry } from "@/lib/api";
import { ugx, num, timeOnly } from "@/lib/format";

export default function RiderEarningsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [rider, setRider] = useState<Rider | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [r, e] = await Promise.all([ridersApi.get(id), ridersApi.earnings(id)]);
      setRider(r); setEntries(e); setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const grouped = useMemo(() => {
    const groups: { day: string; entries: LedgerEntry[]; subtotal: number }[] = [];
    for (const e of entries) {
      const day = new Date(e.created_at).toLocaleDateString("en-UG", {
        weekday: "long", month: "short", day: "numeric",
      });
      const last = groups[groups.length - 1];
      if (last && last.day === day) { last.entries.push(e); last.subtotal += e.amount_ugx; }
      else groups.push({ day, entries: [e], subtotal: e.amount_ugx });
    }
    return groups;
  }, [entries]);

  const total = entries.reduce((s, e) => s + e.amount_ugx, 0);

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-ink-500">Earnings</div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">What you've earned</h1>
      </header>

      <section className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card-coral p-6">
          <div className="text-xs uppercase tracking-wider opacity-80">Wallet balance</div>
          <div className="mt-2 font-display text-4xl tabular">{ugx(rider?.wallet_balance_ugx ?? 0)}</div>
          <button className="btn mt-4 bg-sand-50 text-coral-600 hover:bg-sand-100">
            <ArrowDownToLine className="w-4 h-4" />
            Cash out to MoMo
          </button>
        </div>
        <div className="card p-6">
          <div className="text-xs uppercase tracking-wider text-ink-500">Lifetime earnings</div>
          <div className="mt-2 font-display text-3xl tabular text-ink-900">{ugx(total)}</div>
          <div className="text-xs text-ink-500 mt-1">from {entries.length} trips</div>
        </div>
      </section>

      {error && <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">{error}</div>}

      {entries.length === 0 ? (
        <div className="card p-10 text-center">
          <Wallet className="w-10 h-10 mx-auto text-ink-500" />
          <div className="font-display text-xl text-ink-900 mt-3">No earnings yet</div>
          <div className="text-sm text-ink-500 mt-1">Your first completed trip will show up here.</div>
        </div>
      ) : (
        <div className="ledger-paper p-6">
          {grouped.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-6" : ""}>
              <div className="flex items-baseline justify-between mb-2 pb-1 border-b border-ledger-rule">
                <div className="text-[11px] uppercase tracking-wider text-ink-500">{group.day}</div>
                <div className="font-display text-base tabular text-teal-700">+ {num(group.subtotal)}</div>
              </div>
              <div>
                {group.entries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 py-2 border-b border-dashed border-ledger-rule last:border-0"
                  >
                    <div className="w-12 text-xs font-mono text-ink-500 tabular shrink-0">{timeOnly(entry.created_at)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-900 truncate">{entry.description}</div>
                    </div>
                    <div className="font-display text-sm tabular text-teal-700 shrink-0">+ {num(entry.amount_ugx)}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
