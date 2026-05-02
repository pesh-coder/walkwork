"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Camera, Loader2, CheckCircle2, AlertCircle, X,
  Phone, Truck, ShieldCheck, Sparkles, Copy, Check,
  ThumbsUp, ThumbsDown, Image as ImageIcon, Info, ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { StatusPill } from "@/components/StatusPill";
import {
  trackingApi,
  type OrderTrack, type DisputeReason,
} from "@/lib/api";
import { ugx, num, ESCROW_LABEL } from "@/lib/format";

const PinDropMap = dynamic(() => import("@/components/PinDropMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100">
      <span className="text-sm text-ink-500">Loading map…</span>
    </div>
  ),
});

const OrderMap = dynamic(() => import("@/components/OrderMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-sand-100">
      <span className="text-sm text-ink-500">Loading map…</span>
    </div>
  ),
});

export default function CustomerTrackingPage({
  params,
}: {
  params: { shortCode: string };
}) {
  const { shortCode } = params;
  const [order, setOrder] = useState<OrderTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const o = await trackingApi.get(shortCode);
      setOrder(o);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode]);

  if (error && !order) {
    return (
      <main className="min-h-screen flex items-center justify-center p-5">
        <div className="card p-8 max-w-md text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-coral-500" />
          <h1 className="font-display text-xl mt-3">Order not found</h1>
          <p className="text-ink-500 text-sm mt-1">{error}</p>
          <p className="text-xs text-ink-500 mt-4">Check the link from your seller.</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
      </main>
    );
  }

  // Decide which stage UI to show
  const needsPin = !order.customer_pin_confirmed;
  const needsPayment = order.escrow_status === "none";
  const isDelivered = order.status === "delivered";
  const isSettled = order.status === "settled";
  const isFailed = order.status === "failed" || order.status === "refunded";
  const isDisputed = order.status === "disputed";
  const inFlight =
    order.status === "assigned" ||
    order.status === "picked_up" ||
    order.status === "delivering" ||
    order.status === "at_customer";

  return (
    <main className="min-h-screen pb-12 bg-sand-50">
      {/* Seller-branded header */}
      <header
        className="text-sand-50"
        style={{ backgroundColor: order.seller_profile_color || "#0E6B6B" }}
      >
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-5">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
              <ShieldCheck className="w-3 h-3" />
              Verified by Tukole
            </span>
            <div className="text-xs opacity-80 font-mono">{order.short_code}</div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-card bg-sand-50 flex items-center justify-center font-display text-lg font-semibold shrink-0"
              style={{ color: order.seller_profile_color || "#0E6B6B" }}
            >
              {order.seller_initials || "T"}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider opacity-75">
                You're ordering from
              </div>
              <div className="font-display text-xl truncate">
                {order.seller_business_name || "Tukole seller"}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-6 space-y-4">
        {/* Order summary */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-500">
                Your order
              </div>
              <h1 className="font-display text-2xl text-ink-900 leading-tight mt-0.5">
                {order.item_description}
              </h1>
            </div>
            <StatusPill status={order.status} />
          </div>
          <div className="flex items-baseline justify-between pt-3 border-t border-sand-200">
            <span className="text-sm text-ink-500">Total</span>
            <span className="font-display text-xl tabular text-ink-900">
              {ugx(order.total_charge_ugx)}
            </span>
          </div>
        </motion.section>

        {/* Stage 1: Pin drop */}
        {needsPin && (
          <PinDropStage shortCode={shortCode} onSaved={load} />
        )}

        {/* Stage 2: Payment */}
        {!needsPin && needsPayment && (
          <PaymentStage order={order} onPaid={load} />
        )}

        {/* Stage 3: In flight */}
        {!needsPayment && (inFlight || isDisputed) && (
          <InFlightStage order={order} />
        )}

        {/* Stage 4: Delivered → approve */}
        {isDelivered && (
          <ApprovalStage shortCode={shortCode} order={order} onUpdate={load} />
        )}

        {/* Stage 5: Settled */}
        {isSettled && <SettledStage order={order} />}

        {/* Failed */}
        {isFailed && (
          <div className="card p-5 bg-coral-50 border-coral-200">
            <AlertCircle className="w-6 h-6 text-coral-600" />
            <div className="font-display text-lg text-coral-700 mt-2">
              {order.status === "refunded"
                ? "You've been refunded"
                : "This order failed"}
            </div>
            <div className="text-sm text-ink-700 mt-1">
              Your funds have been returned to you.
            </div>
          </div>
        )}

        {/* Trust footer */}
        <div className="card p-4 bg-teal-50 border-teal-200">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-teal-700">
                Tukole holds your money safely
              </div>
              <div className="text-xs text-ink-700 mt-0.5 leading-relaxed">
                We never release funds to the seller until you've received your
                item and confirmed you're happy with it.
              </div>
            </div>
          </div>
        </div>

        {/* Link to seller's public profile (deepens the brand connection) */}
        {order.seller_slug && (
          <div className="text-center text-xs text-ink-500 mt-2">
            Want to see more from{" "}
            <a
              href={`/s/${order.seller_slug}`}
              className="font-medium underline"
              style={{ color: order.seller_profile_color || "#0E6B6B" }}
            >
              {order.seller_business_name}
            </a>
            ? Visit their verified profile.
          </div>
        )}

        {/* Powered by Tukole footer */}
        <div className="text-center text-[10px] text-ink-500 uppercase tracking-wider mt-3">
          Powered by{" "}
          <span className="font-display normal-case text-teal-700">tukole</span>
          {" "}— escrow + delivery for African social commerce
        </div>
      </div>
    </main>
  );
}

// =============================================================================
// Stage 1: Customer drops their pin
// =============================================================================
function PinDropStage({
  shortCode,
  onSaved,
}: {
  shortCode: string;
  onSaved: () => void;
}) {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [plusCode, setPlusCode] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPhoto(file: File | null) {
    if (!file) return;
    if (file.size > 1_500_000) {
      setError("Image too large. Try a lower-quality photo.");
      return;
    }
    const r = new FileReader();
    r.onload = () => { setPhoto(r.result as string); setError(null); };
    r.readAsDataURL(file);
  }

  async function save() {
    if (lat === null || lng === null) {
      setError("Please drop a pin on your location.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await trackingApi.confirmPin(shortCode, {
        lat, lng,
        plus_code: plusCode || undefined,
        landmark_photo: photo || undefined,
        landmark_notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-coral-500 text-sand-50 text-xs font-medium flex items-center justify-center">1</span>
        <h2 className="font-display text-lg text-ink-900">Drop your pin</h2>
      </div>
      <p className="text-sm text-ink-500 mb-4">
        Drag the orange pin to your exact gate. The boda will use this to find
        you. A landmark photo helps even more.
      </p>

      <div className="rounded-card overflow-hidden border border-sand-200 mb-3 h-[300px]">
        <PinDropMap
          onPinChange={(la, ln, code) => {
            setLat(la);
            setLng(ln);
            setPlusCode(code);
          }}
        />
      </div>

      {plusCode && (
        <div className="text-xs font-mono text-ink-500 mb-3 flex items-center gap-2">
          <span>Plus Code:</span>
          <code className="px-2 py-0.5 bg-sand-100 rounded text-ink-900">
            {plusCode}
          </code>
        </div>
      )}

      <div className="space-y-3">
        <label className="block">
          <div className="field-label">
            <ImageIcon className="w-3 h-3 inline mr-1" /> Gate or landmark photo (optional)
          </div>
          <div className="field-hint mb-2">
            Snap your gate, a nearby shop, or any visible feature.
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="w-16 h-16 rounded-card bg-sand-100 border-2 border-dashed border-sand-300 flex items-center justify-center overflow-hidden shrink-0">
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-5 h-5 text-ink-500" />
              )}
            </div>
            <span className="btn-secondary text-sm">
              {photo ? "Change photo" : "Take photo"}
            </span>
            <input
              type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => onPhoto(e.target.files?.[0] || null)}
            />
          </label>
        </label>

        <label className="block">
          <div className="field-label">Notes for the rider (optional)</div>
          <input
            type="text" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Yellow gate next to MTN kiosk"
            className="input"
          />
        </label>
      </div>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mt-3">
          {error}
        </div>
      )}

      <button
        onClick={save}
        disabled={busy || lat === null}
        className="btn-coral w-full justify-center mt-4"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Confirm location
      </button>
    </motion.section>
  );
}

// =============================================================================
// Stage 2: Payment
// =============================================================================
function PaymentStage({
  order,
  onPaid,
}: {
  order: OrderTrack;
  onPaid: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await trackingApi.pay(order.short_code, "mock");
      onPaid();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-coral-500 text-sand-50 text-xs font-medium flex items-center justify-center">2</span>
        <h2 className="font-display text-lg text-ink-900">Pay into escrow</h2>
      </div>
      <p className="text-sm text-ink-500 mb-4">
        Your money sits with Tukole, not the seller. We only release it to them
        once you've received your item and confirmed you're happy.
      </p>

      <div className="ledger-paper p-4 mb-4">
        <Row label="Item" value={order.item_description} muted />
        <Row label="Item price" value={ugx(order.item_value_ugx)} />
        <Row label="Delivery fee" value={ugx(order.delivery_fee_ugx)} muted />
        <div className="border-t border-dashed border-sand-300 my-2" />
        <Row label="Total" value={ugx(order.total_charge_ugx)} bold />
      </div>

      <div className="space-y-2 mb-4">
        <PaymentMethodOption icon="📱" label="MTN Mobile Money" available />
        <PaymentMethodOption icon="📲" label="Airtel Money" available />
        <PaymentMethodOption icon="💳" label="Card payment" />
      </div>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-3">
          {error}
        </div>
      )}

      <button onClick={pay} disabled={busy} className="btn-coral w-full justify-center text-base py-3">
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" />
            Pay {ugx(order.total_charge_ugx)} into escrow
          </>
        )}
      </button>

      <div className="text-xs text-ink-500 text-center mt-3">
        Demo: this is a one-tap mock payment.
      </div>
    </motion.section>
  );
}

function PaymentMethodOption({
  icon, label, available,
}: {
  icon: string; label: string; available?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-card border flex items-center gap-3 ${
        available
          ? "border-sand-200 bg-sand-50"
          : "border-sand-200 bg-sand-100 opacity-50"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm text-ink-900 flex-1">{label}</span>
      {available && (
        <span className="text-[10px] uppercase tracking-wider text-teal-700 bg-teal-100 px-2 py-0.5 rounded-chip">
          Available
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Stage 3: In flight (paid, rider on the way)
// =============================================================================
function InFlightStage({ order }: { order: OrderTrack }) {
  const [copied, setCopied] = useState(false);

  async function copyOtp() {
    if (!order.otp_code) return;
    await navigator.clipboard.writeText(order.otp_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* OTP — always visible once paid */}
      {order.otp_code && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-coral p-5"
        >
          <div className="flex items-center gap-2 mb-1 opacity-90">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider">
              Your delivery code
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <div className="font-display text-5xl tabular tracking-[0.2em]">
              {order.otp_code}
            </div>
            <button
              onClick={copyOtp}
              className="btn bg-sand-50/20 text-sand-50 hover:bg-sand-50/30 text-xs"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-sm opacity-90 mt-2 leading-relaxed">
            <strong>Read this code aloud to the boda</strong> only after you've
            opened the package and you're happy with what's inside. This
            releases the payment to the seller.
          </p>
        </motion.section>
      )}

      {/* Live map */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden h-[300px]"
      >
        <OrderMap
          pickupLat={order.pickup_lat}
          pickupLng={order.pickup_lng}
          customerLat={order.customer_lat}
          customerLng={order.customer_lng}
          riderLat={order.rider_lat}
          riderLng={order.rider_lng}
          riderName={order.rider_name}
        />
      </motion.section>

      {/* Rider info */}
      {order.rider_name && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4"
        >
          <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
            <Truck className="w-3 h-3 inline mr-1" /> Your rider
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-teal-600 text-sand-50 flex items-center justify-center font-display text-base">
              {order.rider_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900">{order.rider_name}</div>
              <div className="text-xs font-mono text-ink-500">
                {order.rider_plate || ""}
              </div>
              {order.estimated_minutes && order.estimated_minutes < 60 && (
                <div className="text-xs text-coral-600 mt-0.5">
                  ETA ~{order.estimated_minutes} min
                </div>
              )}
            </div>
            {order.rider_phone && (
              <a
                href={`tel:${order.rider_phone}`}
                className="btn-secondary p-2.5"
                aria-label="Call rider"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </motion.section>
      )}
    </>
  );
}

// =============================================================================
// Stage 4: Delivered → approve or dispute
// =============================================================================
function ApprovalStage({
  shortCode,
  order,
  onUpdate,
}: {
  shortCode: string;
  order: OrderTrack;
  onUpdate: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await trackingApi.approve(shortCode);
      onUpdate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5"
      >
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-teal-600" />
          <h2 className="font-display text-lg text-ink-900">
            How was your order?
          </h2>
        </div>
        <p className="text-sm text-ink-500 mb-4">
          You've received your {order.item_description}. Are you happy with it?
        </p>

        {error && (
          <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-3">
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-2">
          <button onClick={approve} disabled={busy} className="btn-primary justify-center text-base py-3">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
            All good — release payment
          </button>
          <button
            onClick={() => setShowDispute(true)}
            disabled={busy}
            className="btn-secondary justify-center text-base py-3"
          >
            <ThumbsDown className="w-4 h-4" />
            Something's wrong
          </button>
        </div>
      </motion.section>

      <AnimatePresence>
        {showDispute && (
          <DisputeModal
            shortCode={shortCode}
            onClose={() => setShowDispute(false)}
            onSubmitted={() => {
              setShowDispute(false);
              onUpdate();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function DisputeModal({
  shortCode,
  onClose,
  onSubmitted,
}: {
  shortCode: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState<DisputeReason>("different_item");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await trackingApi.dispute(shortCode, reason, message.trim() || undefined);
      onSubmitted();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="card p-6 max-w-md w-full"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="font-display text-xl text-ink-900">
              What went wrong?
            </div>
            <div className="text-sm text-ink-500 mt-1">
              Your money stays in escrow while we review.
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mt-4">
          {([
            ["different_item", "Item is not as described"],
            ["damaged", "Item arrived damaged"],
            ["not_received", "I didn't receive what was shown"],
            ["other", "Something else"],
          ] as [DisputeReason, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 p-3 rounded-card border border-sand-200 cursor-pointer hover:bg-sand-100">
              <input
                type="radio"
                name="reason"
                checked={reason === key}
                onChange={() => setReason(key)}
                className="accent-coral-500"
              />
              <span className="text-sm text-ink-900">{label}</span>
            </label>
          ))}
        </div>

        <textarea
          className="input mt-4"
          placeholder="Describe what happened (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />

        {error && <div className="text-sm text-coral-700 mt-3">{error}</div>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="btn-danger flex-1 justify-center"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Open dispute"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// Stage 5: Settled — celebratory
// =============================================================================
function SettledStage({ order }: { order: OrderTrack }) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card-teal p-6 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-sand-50/20 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-9 h-9" />
      </div>
      <div className="font-display text-2xl mt-4">All done!</div>
      <p className="text-sm opacity-90 mt-1 leading-relaxed">
        Thanks for using Tukole. The seller has been paid, and your boda has
        too. Hope the {order.item_description.toLowerCase()} is everything you
        wanted.
      </p>
    </motion.section>
  );
}

// =============================================================================
// Helpers
// =============================================================================
function Row({
  label, value, bold, muted,
}: {
  label: string; value: string; bold?: boolean; muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className={`text-sm ${muted ? "text-ink-500" : "text-ink-900"}`}>{label}</span>
      <span className={`tabular ${bold ? "font-display text-lg text-ink-900" : "text-sm"} ${muted ? "text-ink-500" : ""}`}>
        {value}
      </span>
    </div>
  );
}
