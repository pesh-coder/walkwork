"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, ArrowDownToLine, TrendingUp } from "lucide-react";
import {
  ridersApi,
  type Rider, type LedgerEntry,
} from "@/lib/api";
import { ugx, num, timeOnly } from "@/lib/format";

export default function RiderEarningsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [rider, setRider] = useState<Rider | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [r, e] = await Promise.all([
        ridersApi.get(id),
        ridersApi.earnings(id),
      ]);
      setRider(r);
      setEntries(e);
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const weekStart = todayMs - 6 * 24 * 3600 * 1000;

    const t = entries
      .filter((e) => new Date(e.created_at).getTime() >= todayMs)
      .reduce((sum, e) => sum + e.amount_ugx, 0);
    const w = entries
      .filter((e) => new Date(e.created_at).getTime() >= weekStart)
      .reduce((sum, e) => sum + e.amount_ugx, 0);
    return { today: t, week: w, total: entries.length };
  }, [entries]);

  const grouped = useMemo(() => {
    const groups: { day: string; entries: LedgerEntry[]; total: number }[] = [];
    for (const e of entries) {
      const day = new Date(e.created_at).toLocaleDateString("en-UG", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      const last = groups[groups.length - 1];
      if (last && last.day === day) {
        last.entries.push(e);
        last.total += e.amount_ugx;
      } else {
        groups.push({ day, entries: [e], total: e.amount_ugx });
      }
    }
    return groups;
  }, [entries]);

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          Earnings
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
          Your money, by trip
        </h1>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-6">
        <div className="card-coral p-4">
          <div className="text-[11px] uppercase tracking-wider opacity-80">
            Wallet
          </div>
          <div className="font-display text-2xl tabular leading-tight mt-1">
            {ugx(rider?.wallet_balance_ugx ?? 0)}
          </div>
          <button className="btn-ghost text-xs text-sand-50 hover:bg-coral-600 mt-2 px-2 py-1">
            <ArrowDownToLine className="w-3 h-3" />
            Withdraw
          </button>
        </div>
        <div className="stat-card">
          <span className="stat-label">Today</span>
          <span className="stat-value">{ugx(stats.today)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last 7 days</span>
          <span className="stat-value">{ugx(stats.week)}</span>
        </div>
      </section>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card p-10 text-center">
          <Wallet className="w-10 h-10 mx-auto text-ink-500" />
          <div className="font-display text-xl text-ink-900 mt-3">
            Your first paid trip will show up here
          </div>
          <p className="text-sm text-ink-500 mt-1">
            Every completed delivery puts UGX 5,000+ into your wallet,
            automatically.
          </p>
        </div>
      ) : (
        <div className="ledger-paper p-6 sm:p-8">
          <div className="flex items-end justify-between border-b border-ledger-rule pb-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-500">
                Trip earnings
              </div>
              <div className="font-display text-xl text-ink-900">
                Recent trips
              </div>
            </div>
            <div className="text-xs text-ink-500">{entries.length} trips</div>
          </div>

          {grouped.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-6" : ""}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wider text-ink-500">
                  {group.day}
                </div>
                <div className="text-xs font-display tabular text-teal-700">
                  +{num(group.total)}
                </div>
              </div>
              {group.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 py-3 border-b border-dashed border-ledger-rule last:border-0"
                >
                  <div className="w-14 text-xs font-mono text-ink-500 tabular shrink-0">
                    {timeOnly(entry.created_at)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">
                      Delivery completed
                    </div>
                    <div className="text-xs text-ink-500 truncate">
                      {entry.description}
                    </div>
                  </div>
                  <div className="text-right font-display text-lg tabular shrink-0 text-ledger-credit">
                    +{num(entry.amount_ugx)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
