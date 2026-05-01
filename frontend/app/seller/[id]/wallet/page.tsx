"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowDownToLine, AlertCircle, Plus } from "lucide-react";
import {
  sellersApi,
  type Seller, type LedgerEntry,
} from "@/lib/api";
import {
  ugx, num, timeOnly, LEDGER_LABEL,
  ledgerSign, ledgerColor,
} from "@/lib/format";

export default function WalletPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [s, l] = await Promise.all([
        sellersApi.get(id),
        sellersApi.ledger(id),
      ]);
      setSeller(s);
      setEntries(l);
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

  const grouped = useMemo(() => {
    const groups: { day: string; entries: LedgerEntry[] }[] = [];
    for (const e of entries) {
      const day = new Date(e.created_at).toLocaleDateString("en-UG", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.entries.push(e);
      else groups.push({ day, entries: [e] });
    }
    return groups;
  }, [entries]);

  return (
    <div className="px-5 sm:px-8 py-6 max-w-4xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          Wallet & cash flow
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
          Every shilling, accounted for
        </h1>
      </header>

      <section className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card-teal p-6">
          <div className="text-xs uppercase tracking-wider text-teal-100">
            Wallet balance
          </div>
          <div className="mt-2 font-display text-4xl tabular">
            {ugx(seller?.wallet_balance_ugx ?? 0)}
          </div>
          <button className="btn mt-4 bg-sand-50 text-teal-700 hover:bg-sand-100">
            <ArrowDownToLine className="w-4 h-4" />
            Withdraw to MoMo
          </button>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-wider text-ink-500">
            How earnings work
          </div>
          <div className="mt-2 space-y-2 text-sm text-ink-700">
            <p>
              When a customer approves a delivery, your share of the escrow lands
              here instantly.
            </p>
            <p>
              Withdraw to your MTN or Airtel Money account anytime. Settlements
              are usually processed within 30 minutes.
            </p>
          </div>
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
            No movement yet
          </div>
          <p className="text-sm text-ink-500 mt-1">
            Once your first order is paid into escrow, you'll see the money
            trail here.
          </p>
        </div>
      ) : (
        <div className="ledger-paper p-6 sm:p-8">
          <div className="flex items-end justify-between border-b border-ledger-rule pb-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-500">
                Cash ledger
              </div>
              <div className="font-display text-xl text-ink-900">
                Money trail
              </div>
            </div>
            <div className="text-xs text-ink-500">{entries.length} entries</div>
          </div>

          {grouped.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-6" : ""}>
              <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-2">
                {group.day}
              </div>
              <div>
                {group.entries.map((entry, idx) => (
                  <Row key={entry.id} entry={entry} first={idx === 0} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ entry, first }: { entry: LedgerEntry; first: boolean }) {
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
