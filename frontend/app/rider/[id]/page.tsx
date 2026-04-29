"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, MapPin, Phone, CheckCircle2, ArrowRight,
  Banknote, Smartphone, AlertCircle, LogOut, Wallet,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { StatusPill } from "@/components/StatusPill";
import {
  ridersApi, ordersApi,
  type Rider, type Order,
} from "@/lib/api";
import { ugx, num, timeOnly, PAYMENT_LABEL } from "@/lib/format";

export default function RiderPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [rider, setRider] = useState<Rider | null>(null);
  const [jobs, setJobs] = useState<Order[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial + polling load
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [r, j] = await Promise.all([
          ridersApi.get(id),
          ridersApi.jobs(id),
        ]);
        if (cancelled) return;
        setRider(r);
        setJobs(j);
        setError(null);
        // auto-select first active job
        if (j.length > 0 && !activeJobId) {
          setActiveJobId(j[0].id);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    const interval = setInterval(load, 8_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const activeJob = jobs.find((j) => j.id === activeJobId) || jobs[0] || null;

  if (error && !rider) {
    return (
      <ErrorScreen message={error} />
    );
  }

  if (!rider) {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-screen pb-24">
      <RiderHeader rider={rider} />

      <div className="px-5 mt-4 space-y-4">
        {/* Tabs for multiple jobs */}
        {jobs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => setActiveJobId(j.id)}
                className={
                  "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition " +
                  (j.id === (activeJobId || jobs[0]?.id)
                    ? "bg-ink-900 text-cream-50"
                    : "bg-cream-100 text-ink-700")
                }
              >
                {j.short_code}
              </button>
            ))}
          </div>
        )}

        {activeJob ? (
          <ActiveJobCard
            job={activeJob}
            onUpdate={(updated) =>
              setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)))
            }
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
}

// =============================================================================
// Header
// =============================================================================
function RiderHeader({ rider }: { rider: Rider }) {
  return (
    <header className="bg-forest-700 text-cream-50 px-5 pt-6 pb-8 rounded-b-[24px]">
      <div className="flex items-center justify-between">
        <Logo size="sm" variant="light" />
        <button className="text-cream-200 hover:text-cream-50">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-cream-50/10 border border-cream-50/20 flex items-center justify-center font-display text-xl">
          {rider.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-xl truncate">{rider.full_name}</div>
          <div className="text-cream-200/80 text-xs font-mono">
            {rider.plate_number || "—"} · {rider.stage || "Independent"}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Cash on hand" value={ugx(rider.cash_float_ugx)} icon={Banknote} />
        <Stat
          label="Status"
          value={rider.is_available ? "Available" : "On a job"}
          dotClass={rider.is_available ? "bg-emerald-400" : "bg-terracotta-400"}
        />
      </div>
    </header>
  );
}

function Stat({
  label, value, icon: Icon, dotClass,
}: {
  label: string; value: string;
  icon?: any; dotClass?: string;
}) {
  return (
    <div className="bg-cream-50/10 border border-cream-50/15 rounded-card p-3">
      <div className="text-cream-200/70 text-[11px] uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2 font-medium">
        {Icon && <Icon className="w-4 h-4 text-cream-200" />}
        {dotClass && <span className={`w-2 h-2 rounded-full ${dotClass}`} />}
        <span className="tabular">{value}</span>
      </div>
    </div>
  );
}

// =============================================================================
// Active job card — the heart of the rider experience
// =============================================================================
function ActiveJobCard({
  job, onUpdate,
}: {
  job: Order;
  onUpdate: (j: Order) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [showCash, setShowCash] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-open OTP modal when status flips to OTP_PENDING after we hit "arrived"
  useEffect(() => {
    if (job.status === "otp_pending") setShowOtp(true);
    if (job.status === "delivered" && job.payment_mode === "cod") setShowCash(true);
  }, [job.status, job.payment_mode]);

  async function call<T>(fn: () => Promise<T>) {
    setBusy(true);
    setErrorMsg(null);
    try {
      const result = await fn();
      return result;
    } catch (e: any) {
      setErrorMsg(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  const next = nextStepForJob(job);

  return (
    <div className="space-y-4">
      {/* Customer card */}
      <motion.div
        layout
        className="card p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-1">
              Deliver to
            </div>
            <div className="font-display text-2xl text-ink-900 truncate">
              {job.customer_name}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
              <MapPin className="w-3.5 h-3.5" />
              <span>{job.customer_area}</span>
            </div>
            {job.customer_address_notes && (
              <div className="mt-1 text-sm text-ink-700">{job.customer_address_notes}</div>
            )}
          </div>
          <a
            href={`tel:${job.customer_phone}`}
            className="btn-secondary shrink-0"
            aria-label="Call customer"
          >
            <Phone className="w-4 h-4" />
          </a>
        </div>

        <hr className="my-4 border-cream-200" />

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-500">Item</div>
            <div className="text-sm font-medium text-ink-900 mt-0.5">
              {job.item_description}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-ink-500">Value</div>
            <div className="font-display text-xl tabular">
              {ugx(job.item_value_ugx)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            {job.payment_mode === "cod" ? (
              <>
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash on delivery</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile Money</span>
              </>
            )}
          </div>
          <div className="text-xs font-mono text-ink-500">{job.short_code}</div>
        </div>
      </motion.div>

      {/* Status banner */}
      <div className="flex items-center justify-between px-1">
        <StatusPill status={job.status} />
        {job.assigned_at && (
          <span className="text-xs text-ink-500">
            Assigned {timeOnly(job.assigned_at)}
          </span>
        )}
      </div>

      {/* Action button — the big primary CTA */}
      {next && (
        <motion.button
          key={next.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          disabled={busy}
          onClick={async () => {
            try {
              const updated = await call(() => next.action(job.id));
              onUpdate(updated);
            } catch {
              /* error already shown */
            }
          }}
          className={
            "w-full py-5 rounded-card font-display text-xl font-semibold " +
            "shadow-lift transition-all flex items-center justify-center gap-3 " +
            (busy
              ? "bg-cream-200 text-ink-500"
              : "bg-terracotta-500 text-cream-50 hover:bg-terracotta-600")
          }
        >
          {busy ? "Working…" : next.label}
          {!busy && <ArrowRight className="w-5 h-5" />}
        </motion.button>
      )}

      {!next && (job.status === "delivered" || job.status === "settled") && (
        <div className="card p-6 text-center bg-forest-500/5 border-forest-500/30">
          <CheckCircle2 className="w-8 h-8 mx-auto text-forest-600" />
          <div className="font-display text-xl text-ink-900 mt-2">
            {job.status === "settled" ? "Job complete" : "Delivered"}
          </div>
          <div className="text-sm text-ink-500 mt-1">
            {job.status === "settled"
              ? "Payment settled. Nice work!"
              : "Awaiting cash confirmation."}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="card p-3 bg-terracotta-400/10 border-terracotta-400/30 text-sm text-terracotta-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* OTP modal */}
      <AnimatePresence>
        {showOtp && job.status === "otp_pending" && (
          <OtpModal
            onClose={() => setShowOtp(false)}
            busy={busy}
            value={otp}
            setValue={setOtp}
            onSubmit={async () => {
              try {
                const updated = await call(() => ordersApi.verifyOtp(job.id, otp));
                onUpdate(updated);
                setShowOtp(false);
                setOtp("");
              } catch {
                /* shown */
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Cash deposit modal */}
      <AnimatePresence>
        {showCash && job.status === "delivered" && job.payment_mode === "cod" && (
          <CashModal
            onClose={() => setShowCash(false)}
            amount={job.item_value_ugx}
            busy={busy}
            onConfirm={async () => {
              try {
                const updated = await call(() => ordersApi.confirmCash(job.id));
                onUpdate(updated);
                setShowCash(false);
              } catch {
                /* shown */
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function nextStepForJob(job: Order): { label: string; action: (id: string) => Promise<Order> } | null {
  switch (job.status) {
    case "assigned":
      return { label: "Confirm pickup", action: ordersApi.pickedUp };
    case "picked_up":
      return { label: "Start delivery", action: ordersApi.startDelivery };
    case "delivering":
      return { label: "I've arrived", action: ordersApi.arrived };
    case "otp_pending":
      // We use the modal; surface a button that just opens it via re-trigger
      return null;
    default:
      return null;
  }
}

// =============================================================================
// Modals
// =============================================================================
function OtpModal({
  onClose, busy, value, setValue, onSubmit,
}: {
  onClose: () => void;
  busy: boolean;
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-cream-50 w-full sm:max-w-md rounded-t-[24px] sm:rounded-card p-6"
      >
        <div className="text-xs uppercase tracking-wider text-terracotta-600 font-medium">
          Confirm with customer
        </div>
        <h2 className="font-display text-2xl text-ink-900 mt-1">
          Ask the customer for the 4-digit code
        </h2>
        <p className="text-sm text-ink-500 mt-2">
          They received it by SMS when you marked "I've arrived". This proves they got the package.
        </p>

        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          placeholder="0 0 0 0"
          className="mt-6 w-full h-20 text-center font-display text-5xl tabular tracking-[0.5em]
                     bg-cream-100 rounded-card border-2 border-cream-300
                     focus:outline-none focus:border-terracotta-500"
        />

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="btn-secondary justify-center">
            Cancel
          </button>
          <button
            disabled={busy || value.length !== 4}
            onClick={onSubmit}
            className="btn-primary justify-center"
          >
            {busy ? "Verifying…" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CashModal({
  onClose, amount, busy, onConfirm,
}: {
  onClose: () => void;
  amount: number;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-cream-50 w-full sm:max-w-md rounded-t-[24px] sm:rounded-card p-6"
      >
        <div className="text-xs uppercase tracking-wider text-forest-600 font-medium">
          Cash deposit
        </div>
        <h2 className="font-display text-2xl text-ink-900 mt-1">
          Did you deposit {ugx(amount)} to MoMo?
        </h2>
        <p className="text-sm text-ink-500 mt-2">
          Send the cash to the Tukole MoMo line. Once confirmed, this amount moves to the seller's wallet automatically.
        </p>

        <div className="mt-6 ledger-paper p-5">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-ink-500">Cash collected</span>
            <span className="font-display text-2xl tabular">{ugx(amount)}</span>
          </div>
          <div className="mt-2 text-xs text-ink-500">
            Pay to: *165*1*XXXXXX# (Tukole)
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="btn-secondary justify-center">
            Not yet
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="btn-primary justify-center"
          >
            {busy ? "Confirming…" : "Yes, deposited"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// Empty / loading / error
// =============================================================================
function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <Package className="w-10 h-10 mx-auto text-ink-500" />
      <div className="font-display text-xl text-ink-900 mt-3">No active jobs</div>
      <div className="text-sm text-ink-500 mt-1">
        You're available. The next job will appear here automatically.
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-ink-500 text-sm">Loading…</div>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 max-w-md text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-terracotta-500" />
        <h1 className="font-display text-xl mt-3">Couldn't load rider</h1>
        <p className="text-ink-500 text-sm mt-1">{message}</p>
      </div>
    </main>
  );
}
