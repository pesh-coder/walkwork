"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, MapPin, Camera, Loader2, Check, AlertCircle,
  Sparkles, Phone, Bike, Package, ThumbsUp, X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { StatusPill } from "@/components/StatusPill";
import {
  trackingApi,
  type OrderTrack, type DisputeReason,
} from "@/lib/api";
import { ugx, STATUS_LABEL } from "@/lib/format";

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
      <main className="min-h-screen flex items-center justify-center px-5">
        <div className="card p-8 max-w-md text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-coral-500" />
          <h1 className="font-display text-xl mt-3">We can't find this order</h1>
          <p className="text-ink-500 text-sm mt-1">{error}</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5 text-sm text-ink-500">
        Loading your order…
      </main>
    );
  }

  // Decide which panel to show based on status + pin state
  const needsPin = !order.customer_pin_confirmed;
  const needsPayment =
    order.customer_pin_confirmed && order.escrow_status === "none";
  const isInTransit = ["paid_into_escrow", "assigned", "picked_up", "delivering"].includes(
    order.status
  );
  const isAtDoor = order.status === "at_customer";
  const needsApproval = order.status === "delivered";
  const isComplete = order.status === "settled";
  const isDisputed = order.status === "disputed" || order.status === "refunded";

  return (
    <main className="min-h-screen bg-sand-50">
      {/* Top bar */}
      <header className="px-5 py-4 bg-teal-700 text-sand-50 flex items-center justify-between">
        <Logo size="sm" variant="light" />
        <div className="flex items-center gap-2 text-xs opacity-90">
          <ShieldCheck className="w-3 h-3" />
          Tukole secure delivery
        </div>
      </header>

      {/* Order header card */}
      <section className="px-5 pt-4">
        <div className="card-teal p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider opacity-80">
                {order.seller_business_name || "Your order"}
              </div>
              <div className="font-display text-xl mt-0.5 truncate">
                {order.item_description}
              </div>
              <div className="font-mono text-xs opacity-80 mt-1">
                {order.short_code}
              </div>
            </div>
            <StatusPill status={order.status} className="bg-sand-50/20 text-sand-50 border-0" />
          </div>

          <div className="mt-4 pt-4 border-t border-teal-600 flex items-baseline justify-between">
            <span className="text-sm opacity-90">Total to pay</span>
            <span className="font-display text-3xl tabular">
              {ugx(order.total_charge_ugx)}
            </span>
          </div>
          <div className="text-xs opacity-75 mt-0.5">
            Held in Tukole escrow until you confirm delivery
          </div>
        </div>
      </section>

      {/* Stage-specific panel */}
      <AnimatePresence mode="wait">
        {needsPin && <PinDropPanel key="pin" shortCode={shortCode} onUpdate={load} />}
        {needsPayment && <PaymentPanel key="pay" order={order} onUpdate={load} />}
        {isInTransit && <TransitPanel key="transit" order={order} />}
        {isAtDoor && <AtDoorPanel key="door" order={order} />}
        {needsApproval && (
          <ApprovalPanel key="approve" order={order} onUpdate={load} />
        )}
        {isComplete && <CompletePanel key="complete" order={order} />}
        {isDisputed && <DisputedPanel key="disputed" order={order} />}
      </AnimatePresence>

      {/* Order item summary at bottom */}
      <section className="px-5 py-6">
        <div className="card p-4 text-sm text-ink-700">
          <div className="flex items-baseline justify-between">
            <span>Item</span>
            <span className="text-ink-900">{ugx(order.item_value_ugx)}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span>Delivery</span>
            <span className="text-ink-900">{ugx(order.delivery_fee_ugx)}</span>
          </div>
          <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-sand-200">
            <span className="font-medium text-ink-900">Total</span>
            <span className="font-display tabular text-ink-900">
              {ugx(order.total_charge_ugx)}
            </span>
          </div>
        </div>

        <div className="text-center text-xs text-ink-500 mt-4">
          Powered by <span className="font-display">tukole</span>. We move trust,
          not just packages.
        </div>
      </section>
    </main>
  );
}

// =============================================================================
// Stage panels
// =============================================================================

function PinDropPanel({
  shortCode,
  onUpdate,
}: {
  shortCode: string;
  onUpdate: () => void;
}) {
  const [pin, setPin] = useState<{ lat: number; lng: number; code: string } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPhotoChange(file: File | null) {
    if (!file) return;
    if (file.size > 1_500_000) {
      setError("Image too large. Try at lower quality.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      setPhoto(r.result as string);
      setError(null);
    };
    r.readAsDataURL(file);
  }

  async function submit() {
    if (!pin) {
      setError("Please drop a pin on the map first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await trackingApi.confirmPin(shortCode, {
        lat: pin.lat,
        lng: pin.lng,
        plus_code: pin.code,
        landmark_photo: photo || undefined,
        landmark_notes: notes.trim() || undefined,
      });
      onUpdate();
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
      exit={{ opacity: 0 }}
      className="px-5 mt-4"
    >
      <div className="card p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-coral-100 text-coral-700 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-lg text-ink-900 leading-tight">
              Drop a pin on your gate
            </h2>
            <p className="text-sm text-ink-500 mt-1">
              Drag the map until the pin sits exactly on your gate. The boda
              will see this on a satellite map.
            </p>
          </div>
        </div>

        <div className="rounded-card overflow-hidden border border-sand-200 h-[320px]">
          <PinDropMap
            onChange={(lat, lng, code) => setPin({ lat, lng, code })}
          />
        </div>

        {pin && (
          <div className="mt-3 card p-3 bg-teal-50 border-teal-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div className="text-xs text-teal-700">
              Plus Code: <span className="font-mono font-medium">{pin.code}</span>
              <div className="opacity-75 mt-0.5">
                Accurate to 3m × 3m. Lat {pin.lat.toFixed(5)}, Lng {pin.lng.toFixed(5)}.
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="field-label">
            Snap a photo of your gate (optional)
          </label>
          <p className="field-hint mb-2">
            Helps your boda find you faster. The photo stays private to the
            assigned rider.
          </p>
          <label className="block cursor-pointer">
            <div className="aspect-[3/2] max-w-xs rounded-card border-2 border-dashed border-sand-300 bg-sand-100 flex items-center justify-center overflow-hidden">
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-ink-500">
                  <Camera className="w-7 h-7 mx-auto mb-2" />
                  <div className="text-xs">Tap to snap</div>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPhotoChange(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <label className="block mt-4">
          <span className="field-label">Anything else? (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
            placeholder="Yellow gate next to MTN kiosk"
          />
        </label>

        {error && (
          <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mt-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || !pin}
          className="btn-primary w-full justify-center text-base py-3 mt-4"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Confirm location
            </>
          )}
        </button>
      </div>
    </motion.section>
  );
}

function PaymentPanel({
  order,
  onUpdate,
}: {
  order: OrderTrack;
  onUpdate: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"momo" | "airtel_money" | "card">("momo");

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await trackingApi.pay(order.short_code, "mock");
      onUpdate();
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
      exit={{ opacity: 0 }}
      className="px-5 mt-4"
    >
      <div className="card p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-lg text-ink-900 leading-tight">
              Pay safely into escrow
            </h2>
            <p className="text-sm text-ink-500 mt-1">
              Your money goes to Tukole, not the seller — we only release it
              once you've received and approved your item.
            </p>
          </div>
        </div>

        <div className="text-xs uppercase tracking-wider text-ink-500 mt-4 mb-2">
          Payment method
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PayBtn
            label="MTN MoMo"
            active={method === "momo"}
            onClick={() => setMethod("momo")}
          />
          <PayBtn
            label="Airtel Money"
            active={method === "airtel_money"}
            onClick={() => setMethod("airtel_money")}
          />
          <PayBtn
            label="Card"
            active={method === "card"}
            onClick={() => setMethod("card")}
          />
        </div>

        {error && (
          <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mt-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={pay}
          disabled={busy}
          className="btn-coral w-full justify-center text-base py-3 mt-4"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Securing your payment…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Pay {ugx(order.total_charge_ugx)} into escrow
            </>
          )}
        </button>

        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
          <span className="pill bg-sand-100 text-ink-500">256-bit encrypted</span>
          <span className="pill bg-sand-100 text-ink-500">No seller access</span>
          <span className="pill bg-sand-100 text-ink-500">Refundable on dispute</span>
        </div>
      </div>
    </motion.section>
  );
}

function PayBtn({
  label, active, onClick,
}: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "py-2.5 rounded-card border text-xs font-medium transition " +
        (active
          ? "bg-teal-600 border-teal-600 text-sand-50"
          : "bg-sand-50 border-sand-200 text-ink-700 hover:bg-sand-100")
      }
    >
      {label}
    </button>
  );
}

function TransitPanel({ order }: { order: OrderTrack }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-5 mt-4 space-y-4"
    >
      {/* OTP card — visible the moment escrow is held */}
      {order.otp_code && (
        <div className="card-coral p-5">
          <div className="text-[11px] uppercase tracking-wider opacity-80">
            Your delivery code
          </div>
          <div className="font-display text-5xl tabular tracking-widest mt-1">
            {order.otp_code}
          </div>
          <p className="text-xs opacity-90 mt-2 leading-relaxed">
            Read this 4-digit code to your boda <strong>only after</strong> you've
            opened the package and you're satisfied. The code releases your
            money from escrow.
          </p>
        </div>
      )}

      {/* Rider info + map */}
      <div className="card overflow-hidden">
        {order.rider_lat && order.rider_lng && (
          <div className="h-[280px]">
            <OrderMap
              pickupLat={order.pickup_lat}
              pickupLng={order.pickup_lng}
              customerLat={order.customer_lat}
              customerLng={order.customer_lng}
              riderLat={order.rider_lat}
              riderLng={order.rider_lng}
              riderName={order.rider_name}
              defaultLayer="streets"
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-600 text-sand-50 flex items-center justify-center font-display">
              <Bike className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-ink-500">
                {order.rider_name ? "Your boda" : "Finding a rider"}
              </div>
              <div className="text-sm font-medium text-ink-900 truncate">
                {order.rider_name || "Searching for the closest available rider…"}
              </div>
              {order.rider_plate && (
                <div className="text-xs text-ink-500 font-mono">
                  {order.rider_plate}
                </div>
              )}
            </div>
            {order.rider_phone && (
              <a href={`tel:${order.rider_phone}`} className="btn-secondary p-2.5">
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
          {order.estimated_minutes && (
            <div className="mt-3 text-sm text-ink-700">
              Estimated arrival in <strong>{order.estimated_minutes} min</strong>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-teal-700">
            <ShieldCheck className="w-3 h-3" />
            <span>Funds secured. Boda is paid the moment delivery is verified.</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function AtDoorPanel({ order }: { order: OrderTrack }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-5 mt-4"
    >
      <div className="card-coral p-5">
        <div className="text-[11px] uppercase tracking-wider opacity-80">
          Your boda has arrived
        </div>
        <h2 className="font-display text-2xl mt-1">
          {order.rider_name || "Your rider"} is at your door
        </h2>
        <p className="text-sm opacity-90 mt-2 leading-relaxed">
          Take your package, open it, and check that everything matches your
          order. <strong>Only after that</strong>, give the rider this code:
        </p>
        <div className="bg-sand-50/20 border border-sand-50/30 rounded-card p-4 mt-3 text-center">
          <div className="font-display text-5xl tabular tracking-widest">
            {order.otp_code || "----"}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ApprovalPanel({
  order,
  onUpdate,
}: {
  order: OrderTrack;
  onUpdate: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState(false);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await trackingApi.approve(order.short_code);
      onUpdate();
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
      exit={{ opacity: 0 }}
      className="px-5 mt-4"
    >
      <div className="card p-5">
        <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
          <Package className="w-6 h-6 text-teal-700" />
        </div>
        <h2 className="font-display text-xl text-ink-900 mt-3">
          Are you happy with your order?
        </h2>
        <p className="text-sm text-ink-500 mt-1">
          Your boda has confirmed delivery. Tap <strong>Approve</strong> to
          release {ugx(order.item_value_ugx)} to {order.seller_business_name},
          or report a problem to keep the funds in escrow.
        </p>

        {error && (
          <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mt-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => setShowDispute(true)}
            disabled={busy}
            className="btn-secondary justify-center"
          >
            Report a problem
          </button>
          <button
            onClick={approve}
            disabled={busy}
            className="btn-primary justify-center"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
            Approve
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showDispute && (
          <DisputeModal
            shortCode={order.short_code}
            onClose={() => setShowDispute(false)}
            onSuccess={() => {
              setShowDispute(false);
              onUpdate();
            }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function DisputeModal({
  shortCode,
  onClose,
  onSuccess,
}: {
  shortCode: string;
  onClose: () => void;
  onSuccess: () => void;
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
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="card p-5 max-w-sm w-full m-4"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="font-display text-lg text-ink-900">Report a problem</div>
            <div className="text-xs text-ink-500 mt-1">
              Funds stay in escrow. Tukole's team will reach out to help.
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {([
            ["different_item", "Item is different from what was ordered"],
            ["damaged", "Item arrived damaged"],
            ["not_received", "I did not receive my order"],
            ["other", "Something else"],
          ] as [DisputeReason, string][]).map(([k, label]) => (
            <label
              key={k}
              className={`flex items-center gap-3 p-3 rounded-card border cursor-pointer ${
                reason === k
                  ? "bg-teal-50 border-teal-300"
                  : "bg-sand-50 border-sand-200"
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={k}
                checked={reason === k}
                onChange={() => setReason(k)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded-full border-2 ${
                  reason === k ? "border-teal-600 bg-teal-600" : "border-sand-300"
                }`}
              />
              <span className="text-sm text-ink-900">{label}</span>
            </label>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="input mt-3"
          placeholder="Tell us what happened (optional)"
        />

        {error && (
          <div className="text-sm text-coral-700 mt-2">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary justify-center">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="btn-danger justify-center"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompletePanel({ order }: { order: OrderTrack }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-5 mt-4"
    >
      <div className="card-teal p-5 text-center">
        <div className="w-12 h-12 rounded-full bg-sand-50 flex items-center justify-center mx-auto">
          <Check className="w-6 h-6 text-teal-700" />
        </div>
        <h2 className="font-display text-2xl mt-3">All done</h2>
        <p className="text-sm opacity-90 mt-2 leading-relaxed">
          Your payment has been released. {order.seller_business_name} got
          their share. Your boda got theirs. Thank you for shopping safely with
          Tukole.
        </p>
      </div>
    </motion.section>
  );
}

function DisputedPanel({ order }: { order: OrderTrack }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-5 mt-4"
    >
      <div className="card p-5 bg-coral-50 border-coral-200">
        <AlertCircle className="w-6 h-6 text-coral-600" />
        <h2 className="font-display text-xl text-coral-700 mt-2">
          Your dispute is being reviewed
        </h2>
        <p className="text-sm text-ink-700 mt-2 leading-relaxed">
          Tukole's team will be in touch to help resolve this. Your funds are
          held safely in escrow.
        </p>
      </div>
    </motion.section>
  );
}
