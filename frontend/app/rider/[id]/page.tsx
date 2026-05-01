"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, MapPin, Phone, Clock, Camera, X, CheckCircle2,
  AlertCircle, Loader2, ShieldCheck, ArrowRight, Image as ImageIcon,
} from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import {
  ordersApi, ridersApi,
  type Order, type Photo,
} from "@/lib/api";
import { ugx, relTime, STATUS_LABEL } from "@/lib/format";

export default function RiderJobsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [jobs, setJobs] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const j = await ridersApi.jobs(id);
      setJobs(j);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const active = jobs[0]; // Most recent active job

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          {jobs.length === 0
            ? "No active jobs"
            : jobs.length === 1
            ? "Your active job"
            : `${jobs.length} active jobs`}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
          Today's deliveries
        </h1>
      </header>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">
          {error}
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="card p-10 text-center">
          <Package className="w-10 h-10 mx-auto text-ink-500" />
          <div className="font-display text-xl text-ink-900 mt-3">
            Nothing yet — keep the app open
          </div>
          <div className="text-sm text-ink-500 mt-1 max-w-sm mx-auto">
            When a customer pays into escrow and you're the closest available
            rider, your next job will appear here.
          </div>
        </div>
      ) : (
        <>
          {active && <ActiveJobCard order={active} riderId={id} onUpdate={load} />}
          {jobs.length > 1 && (
            <section className="mt-6">
              <h2 className="font-display text-lg text-ink-900 mb-3">
                Other jobs in your queue
              </h2>
              <div className="space-y-2">
                {jobs.slice(1).map((o) => (
                  <Link
                    key={o.id}
                    href={`/rider/${id}/jobs/${o.id}`}
                    className="card p-4 flex items-center justify-between hover:shadow-lift"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-ink-500">
                        {o.short_code}
                      </div>
                      <div className="text-sm font-medium text-ink-900 truncate">
                        {o.customer_name}
                      </div>
                      <div className="text-xs text-ink-500 truncate">
                        {o.customer_area} · {o.item_description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill status={o.status} />
                      <ArrowRight className="w-4 h-4 text-ink-500" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Active job card — the heart of the rider experience
// =============================================================================
function ActiveJobCard({
  order,
  riderId,
  onUpdate,
}: {
  order: Order;
  riderId: string;
  onUpdate: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOtp, setShowOtp] = useState(false);
  const [showPickupPhoto, setShowPickupPhoto] = useState(false);
  const [showDropoffPhoto, setShowDropoffPhoto] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);

  async function loadPhotos() {
    try {
      setPhotos(await ordersApi.listPhotos(order.id));
    } catch {}
  }

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const hasPickupPhoto = photos.some((p) => p.phase === "seller_pickup");
  const hasDropoffPhoto = photos.some((p) => p.phase === "rider_dropoff");

  async function action(fn: () => Promise<any>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onUpdate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Decide which big action to show next
  let primaryAction: React.ReactNode = null;
  switch (order.status) {
    case "assigned":
      primaryAction = hasPickupPhoto ? (
        <BigButton
          icon={Package}
          label="Confirm pickup"
          tone="primary"
          onClick={() =>
            action(() => ordersApi.pickedUp(order.id))
          }
          busy={busy}
        />
      ) : (
        <BigButton
          icon={Camera}
          label="Take pickup photo"
          tone="primary"
          onClick={() => setShowPickupPhoto(true)}
        />
      );
      break;
    case "picked_up":
      primaryAction = (
        <BigButton
          icon={ArrowRight}
          label="Start delivery"
          tone="primary"
          onClick={() => action(() => ordersApi.startDelivery(order.id))}
          busy={busy}
        />
      );
      break;
    case "delivering":
      primaryAction = (
        <BigButton
          icon={MapPin}
          label="I've arrived"
          tone="coral"
          onClick={() => action(() => ordersApi.arrived(order.id))}
          busy={busy}
        />
      );
      break;
    case "at_customer":
      primaryAction = (
        <div className="space-y-2">
          {!hasDropoffPhoto && (
            <BigButton
              icon={Camera}
              label="Take handover photo"
              tone="secondary"
              onClick={() => setShowDropoffPhoto(true)}
            />
          )}
          <BigButton
            icon={ShieldCheck}
            label="Get OTP from customer"
            tone="primary"
            onClick={() => setShowOtp(true)}
          />
        </div>
      );
      break;
    case "delivered":
      primaryAction = (
        <div className="card p-4 bg-teal-50 border-teal-200 text-center">
          <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto" />
          <div className="font-display text-lg text-teal-700 mt-2">
            Delivered!
          </div>
          <div className="text-sm text-ink-700 mt-1">
            Waiting for the customer to approve the delivery on their tracking
            page. Your earnings will land in your wallet automatically.
          </div>
        </div>
      );
      break;
    case "disputed":
      primaryAction = (
        <div className="card p-4 bg-coral-50 border-coral-200">
          <AlertCircle className="w-6 h-6 text-coral-600" />
          <div className="font-display text-base text-coral-700 mt-2">
            This order is being reviewed
          </div>
          <div className="text-sm text-ink-700 mt-1">
            The customer raised a concern. You'll still be paid for the trip —
            Tukole's team will resolve the dispute.
          </div>
        </div>
      );
      break;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="font-mono text-xs text-ink-500">
              {order.short_code}
            </div>
            <div className="font-display text-xl text-ink-900 truncate">
              {order.customer_name}
            </div>
            <div className="text-xs text-ink-500">
              {order.customer_area} · {relTime(order.created_at)}
            </div>
          </div>
          <StatusPill status={order.status} />
        </div>

        {/* Earnings preview */}
        <div className="card-coral p-3 flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-80">
              Your earnings on this trip
            </div>
            <div className="font-display text-2xl tabular leading-tight">
              {ugx(order.delivery_fee_ugx)}
            </div>
          </div>
          <ShieldCheck className="w-8 h-8 opacity-50" />
        </div>

        {/* Item info */}
        <div className="space-y-2 mb-4">
          <Detail label="Item" value={order.item_description} />
          {order.customer_address_notes && (
            <Detail label="Notes" value={order.customer_address_notes} />
          )}
          <Detail
            label="Customer phone"
            value={
              <a href={`tel:${order.customer_phone}`} className="text-teal-700 hover:underline">
                {order.customer_phone}
              </a>
            }
          />
        </div>

        {/* Pickup photos preview */}
        {photos.length > 0 && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-1">
              <ImageIcon className="w-3 h-3 inline mr-1" /> Photos
            </div>
            <div className="flex gap-2">
              {photos.map((p) => (
                <img
                  key={p.id}
                  src={p.image_data}
                  alt={p.phase}
                  className="w-16 h-16 rounded-card object-cover border border-sand-200"
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {primaryAction}

        <Link
          href={`/rider/${riderId}/jobs/${order.id}`}
          className="btn-ghost w-full justify-center mt-3 text-sm"
        >
          View full details
        </Link>
      </motion.div>

      {/* OTP modal */}
      <AnimatePresence>
        {showOtp && (
          <OtpModal
            order={order}
            onClose={() => setShowOtp(false)}
            onSuccess={() => {
              setShowOtp(false);
              onUpdate();
            }}
          />
        )}
      </AnimatePresence>

      {/* Pickup photo modal */}
      <AnimatePresence>
        {showPickupPhoto && (
          <PhotoModal
            title="Pickup photo"
            description="Take a clear photo of the item as you collect it from the seller."
            onClose={() => setShowPickupPhoto(false)}
            onUpload={async (data) => {
              await ordersApi.uploadPhoto(order.id, {
                phase: "seller_pickup",
                image_data: data,
              });
              await loadPhotos();
              setShowPickupPhoto(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Dropoff photo modal */}
      <AnimatePresence>
        {showDropoffPhoto && (
          <PhotoModal
            title="Handover photo"
            description="Snap the package with the customer or at their door."
            onClose={() => setShowDropoffPhoto(false)}
            onUpload={async (data) => {
              await ordersApi.uploadPhoto(order.id, {
                phase: "rider_dropoff",
                image_data: data,
              });
              await loadPhotos();
              setShowDropoffPhoto(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-ink-500 w-20 shrink-0">
        {label}
      </span>
      <span className="text-ink-900">{value}</span>
    </div>
  );
}

function BigButton({
  icon: Icon,
  label,
  onClick,
  tone,
  busy,
}: {
  icon: typeof Package;
  label: string;
  onClick: () => void;
  tone: "primary" | "coral" | "secondary";
  busy?: boolean;
}) {
  const cls =
    tone === "primary"
      ? "btn-primary"
      : tone === "coral"
      ? "btn-coral"
      : "btn-secondary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`${cls} w-full justify-center text-base py-4`}
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
      {label}
    </button>
  );
}

// =============================================================================
// OTP modal
// =============================================================================
function OtpModal({
  order,
  onClose,
  onSuccess,
}: {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit() {
    if (otp.length !== 4) {
      setError("Enter the 4-digit code from the customer's tracking page.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ordersApi.verifyOtp(order.id, otp);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="card p-6 max-w-sm w-full"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="font-display text-xl text-ink-900">
              Customer's code
            </div>
            <div className="text-sm text-ink-500 mt-1">
              Ask {order.customer_name} for the 4-digit code shown on their
              tracking page after they've checked the item.
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="0000"
          className="input text-center font-mono text-3xl tracking-[0.5em] tabular my-4"
          disabled={busy}
        />

        {error && (
          <div className="text-sm text-coral-700 mb-3">{error}</div>
        )}

        <button
          onClick={submit}
          disabled={busy || otp.length !== 4}
          className="btn-primary w-full justify-center"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              Confirm delivery <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </motion.div>
    </Backdrop>
  );
}

// =============================================================================
// Photo capture modal
// =============================================================================
function PhotoModal({
  title,
  description,
  onClose,
  onUpload,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onUpload: (data: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFileChange(file: File | null) {
    if (!file) return;
    if (file.size > 1_500_000) {
      setError("Image too large. Try again at lower quality.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      setPreview(r.result as string);
      setError(null);
    };
    r.readAsDataURL(file);
  }

  async function submit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(preview);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="card p-6 max-w-sm w-full"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="font-display text-xl text-ink-900">{title}</div>
            <div className="text-sm text-ink-500 mt-1">{description}</div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block mt-4 cursor-pointer">
          <div className="aspect-square rounded-card border-2 border-dashed border-sand-300 bg-sand-100 flex items-center justify-center overflow-hidden">
            {preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-ink-500">
                <Camera className="w-8 h-8 mx-auto mb-2" />
                <div className="text-sm">Tap to take photo</div>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            disabled={busy}
          />
        </label>

        {error && (
          <div className="text-sm text-coral-700 mt-3">{error}</div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !preview}
            className="btn-primary flex-1 justify-center"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload"}
          </button>
        </div>
      </motion.div>
    </Backdrop>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </motion.div>
  );
}
