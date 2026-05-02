"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight, Loader2, AlertCircle, Sparkles, Info,
  CloudRain, Package, Calculator, MapPin,
} from "lucide-react";
import { sellersApi, pricingApi, type DeliveryQuote } from "@/lib/api";
import { ugx } from "@/lib/format";

// Approximate centroids for Kampala neighbourhoods — used to *estimate*
// distance for the delivery quote shown to the seller. Final settlement uses
// the real customer pin captured on the tracking page.
const AREA_CENTROIDS: Record<string, [number, number]> = {
  Bukoto:    [0.3500, 32.5950],
  Ntinda:    [0.3580, 32.6100],
  Kololo:    [0.3346, 32.5916],
  Kamwokya:  [0.3404, 32.5829],
  Nakawa:    [0.3322, 32.6266],
  Kabalagala:[0.2958, 32.6046],
  Bugolobi:  [0.3115, 32.6147],
  Muyenga:   [0.2962, 32.6157],
  Naguru:    [0.3357, 32.6144],
  Mbuya:     [0.3220, 32.6280],
  Najjera:   [0.3680, 32.6420],
  Kira:      [0.3860, 32.6570],
  Mengo:     [0.2954, 32.5546],
  Rubaga:    [0.3081, 32.5511],
  Kawempe:   [0.3782, 32.5635],
  Makindye:  [0.2786, 32.5848],
  Wandegeya: [0.3375, 32.5712],
  Nakulabye: [0.3239, 32.5588],
  Kansanga:  [0.2882, 32.6066],
  Katwe:     [0.2956, 32.5773],
};
const KAMPALA_AREAS = Object.keys(AREA_CENTROIDS).concat(["Other"]);

const FALLBACK_DELIVERY_FEE = 7500;

export default function NewOrderPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerArea, setCustomerArea] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemValue, setItemValue] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(`${FALLBACK_DELIVERY_FEE}`);

  // Pricing controls
  const [parcelSize, setParcelSize] = useState<"regular" | "large" | "fragile">("regular");
  const [isRaining, setIsRaining] = useState(false);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const itemValueNum = parseInt(itemValue.replace(/[^\d]/g, "") || "0");
  const deliveryFeeNum = parseInt(deliveryFee.replace(/[^\d]/g, "") || "0");
  const totalCharge = itemValueNum + deliveryFeeNum;
  const commission = Math.floor((itemValueNum * 500) / 10000); // 5%
  const sellerKeeps = itemValueNum - commission;

  // Auto-quote when area or parcel/rain changes
  useEffect(() => {
    const centroid = AREA_CENTROIDS[customerArea];
    if (!centroid) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);
    pricingApi
      .quote({
        seller_id: id,
        drop_lat: centroid[0],
        drop_lng: centroid[1],
        parcel_size: parcelSize,
        is_raining: isRaining,
      })
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        // If user hasn't manually overridden, fill in
        setDeliveryFee(`${q.total_ugx}`);
      })
      .catch((e) => {
        if (cancelled) return;
        setQuoteError(e.message);
        setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerArea, parcelSize, isRaining, id]);

  async function submit() {
    setError(null);
    if (!customerName.trim()) return setError("Customer name is required.");
    if (!customerPhone.trim()) return setError("Customer phone is required.");
    if (!customerArea) return setError("Customer area is required.");
    if (!itemDescription.trim()) return setError("What is the customer ordering?");
    if (!itemValueNum || itemValueNum <= 0) return setError("Item price must be greater than zero.");

    setBusy(true);
    try {
      const order = await sellersApi.createOrder(id, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_area: customerArea,
        customer_address_notes: addressNotes.trim() || undefined,
        item_description: itemDescription.trim(),
        item_value_ugx: itemValueNum,
        delivery_fee_ugx: deliveryFeeNum || undefined,
      });
      router.push(`/seller/${id}/orders/${order.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          Create order
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
          New delivery
        </h1>
        <p className="mt-2 text-sm text-ink-700">
          Fill this in once. We'll text your customer with a tracking + payment
          link, hold the money in escrow, and find them a vetted boda.
        </p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Customer */}
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3">Customer</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Customer name">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Cotrida Akello"
                className="input"
                disabled={busy}
              />
            </Field>
            <Field label="Customer phone">
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0750 366 664"
                className="input"
                disabled={busy}
              />
            </Field>
            <Field label="Area" hint="Where in Kampala the customer is.">
              <select
                value={customerArea}
                onChange={(e) => setCustomerArea(e.target.value)}
                className="input"
                disabled={busy}
              >
                <option value="">Select an area</option>
                {KAMPALA_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Address notes (optional)" hint="Landmark, gate colour, etc.">
              <input
                type="text"
                value={addressNotes}
                onChange={(e) => setAddressNotes(e.target.value)}
                placeholder="Big white gate, opposite the bakery"
                className="input"
                disabled={busy}
              />
            </Field>
          </div>
        </section>

        {/* Item */}
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3">What they're buying</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Description" className="sm:col-span-2">
              <input
                type="text"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Black leather shoes, size 41"
                className="input"
                disabled={busy}
              />
            </Field>
            <Field label="Item price (UGX)">
              <input
                type="text"
                inputMode="numeric"
                value={itemValue}
                onChange={(e) => setItemValue(e.target.value.replace(/[^\d,]/g, ""))}
                placeholder="60,000"
                className="input"
                disabled={busy}
              />
            </Field>
            <Field label="Parcel type" hint="Affects the delivery quote.">
              <div className="flex gap-2">
                {(["regular", "large", "fragile"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setParcelSize(s)}
                    className={`flex-1 btn ${parcelSize === s ? "btn-primary" : "btn-secondary"} text-xs capitalize`}
                    disabled={busy}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </section>

        {/* Pricing */}
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-coral-500" />
            Delivery quote
          </h2>

          {!customerArea ? (
            <div className="card p-4 bg-sand-100 text-sm text-ink-500 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              Pick a customer area to see the auto-calculated quote.
            </div>
          ) : quoting ? (
            <div className="card p-4 flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Calculating…
            </div>
          ) : quoteError ? (
            <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{quoteError} (Tip: set your pickup location in Settings.)</span>
            </div>
          ) : quote ? (
            <div className="card p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-500">
                  Auto-quoted
                </span>
                <span className="font-display text-3xl tabular text-ink-900">
                  {ugx(quote.total_ugx)}
                </span>
              </div>
              <div className="text-xs text-ink-500 space-y-1">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {quote.distance_km.toFixed(1)} km · ~{quote.estimated_minutes} min
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <span>Base fare:</span><span className="text-right tabular">{ugx(quote.base_fare_ugx)}</span>
                  <span>Distance ({quote.distance_km.toFixed(1)} km):</span><span className="text-right tabular">{ugx(quote.distance_charge_ugx)}</span>
                  <span>Time ({quote.estimated_minutes} min):</span><span className="text-right tabular">{ugx(quote.time_charge_ugx)}</span>
                  {quote.parcel_supplement_ugx > 0 && (
                    <>
                      <span>Parcel ({parcelSize}):</span>
                      <span className="text-right tabular">{ugx(quote.parcel_supplement_ugx)}</span>
                    </>
                  )}
                  {quote.surge_multiplier !== 1.0 && (
                    <>
                      <span className="text-coral-600">Surge ({quote.surge_reason}):</span>
                      <span className="text-right tabular text-coral-600">×{quote.surge_multiplier}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-sand-200 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsRaining((v) => !v)}
                  className={`btn ${isRaining ? "btn-coral" : "btn-secondary"} text-xs`}
                  disabled={busy}
                >
                  <CloudRain className="w-3.5 h-3.5" />
                  {isRaining ? "Raining now" : "It's raining"}
                </button>
                <span className="text-xs text-ink-500">
                  Quote uses {customerArea}'s centre. Customer's exact pin updates the final settlement.
                </span>
              </div>
            </div>
          ) : null}

          <Field
            label="Delivery fee charged to customer"
            hint="Auto-filled from quote. You can override (e.g. you're absorbing some)."
            className="mt-3"
          >
            <input
              type="text"
              inputMode="numeric"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value.replace(/[^\d,]/g, ""))}
              placeholder="7,500"
              className="input"
              disabled={busy}
            />
          </Field>
        </section>

        {/* Money split */}
        {itemValueNum > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="ledger-paper p-5"
          >
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-3">
              Money split
            </div>
            <div className="space-y-2">
              <Row label="Customer pays" value={ugx(totalCharge)} bold />
              <Hr />
              <Row label="Item price" value={ugx(itemValueNum)} muted />
              <Row label="Delivery fee" value={ugx(deliveryFeeNum)} muted />
              <Hr />
              <Row label="You earn (95% of item)" value={ugx(sellerKeeps)} positive />
              <Row label="Rider gets" value={ugx(deliveryFeeNum)} muted />
              <Row label="Tukole keeps" value={ugx(commission + 1500)} muted />
            </div>
          </motion.div>
        )}

        <div className="card p-4 bg-teal-50 border-teal-200">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div className="text-sm text-teal-700 leading-relaxed">
              When you create this order, the customer will get an SMS with a
              tracking link. They drop a pin on the map, pay into Tukole's
              escrow, and only then is the boda dispatched. Your earnings land
              in your wallet the moment they approve the delivery.
            </div>
          </div>
        </div>

        {error && (
          <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="btn-coral w-full justify-center text-base py-3"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating order…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Create order & text the customer
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}

function Field({
  label, hint, className, children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className || ""}`}>
      <div className="field-label">{label}</div>
      {hint && <div className="field-hint mb-1.5">{hint}</div>}
      <div>{children}</div>
    </label>
  );
}

function Row({
  label, value, bold, muted, positive,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={muted ? "text-ink-500" : "text-ink-900"}>{label}</span>
      <span
        className={`tabular ${
          bold ? "font-display text-lg" : ""
        } ${positive ? "text-teal-700 font-medium" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function Hr() {
  return <div className="border-t border-dashed border-ink-500/20 my-1" />;
}
