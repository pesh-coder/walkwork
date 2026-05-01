"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, AlertCircle, Sparkles, Info } from "lucide-react";
import { sellersApi } from "@/lib/api";
import { ugx } from "@/lib/format";

const KAMPALA_AREAS = [
  "Bukoto", "Ntinda", "Kololo", "Kamwokya", "Nakawa", "Kabalagala",
  "Bugolobi", "Muyenga", "Naguru", "Mbuya", "Najjera", "Kira",
  "Mengo", "Rubaga", "Kawempe", "Makindye", "Wandegeya", "Nakulabye",
  "Kansanga", "Katwe", "Other",
];

const DEFAULT_DELIVERY_FEE = 5000;

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
  const [deliveryFee, setDeliveryFee] = useState(`${DEFAULT_DELIVERY_FEE}`);

  const itemValueNum = parseInt(itemValue.replace(/[^\d]/g, "") || "0");
  const deliveryFeeNum = parseInt(deliveryFee.replace(/[^\d]/g, "") || "0");
  const totalCharge = itemValueNum + deliveryFeeNum;
  const commission = Math.floor((itemValueNum * 500) / 10000); // 5%
  const sellerKeeps = itemValueNum - commission;

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
          link, hold the money in escrow, and find them a boda.
        </p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 sm:p-8"
      >
        <h2 className="font-display text-lg text-ink-900 mb-4">Customer</h2>
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
          <Field label="Phone (WhatsApp)">
            <input
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="0772 123 456"
              className="input"
              disabled={busy}
            />
          </Field>
          <Field label="Area">
            <select
              value={customerArea}
              onChange={(e) => setCustomerArea(e.target.value)}
              className="input"
              disabled={busy}
            >
              <option value="">Pick an area…</option>
              {KAMPALA_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Notes for the rider (optional)"
            hint="The customer will also drop a pin themselves."
          >
            <input
              type="text"
              value={addressNotes}
              onChange={(e) => setAddressNotes(e.target.value)}
              placeholder="Yellow gate next to MTN kiosk"
              className="input"
              disabled={busy}
            />
          </Field>
        </div>

        <h2 className="font-display text-lg text-ink-900 mt-8 mb-4">Item</h2>
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
          <Field
            label="Delivery fee (UGX)"
            hint={`Default UGX ${DEFAULT_DELIVERY_FEE.toLocaleString()}. Adjust for distance.`}
          >
            <input
              type="text"
              inputMode="numeric"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value.replace(/[^\d,]/g, ""))}
              placeholder="5,000"
              className="input"
              disabled={busy}
            />
          </Field>
        </div>

        {/* Live receipt preview */}
        {itemValueNum > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 ledger-paper p-5"
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

        <div className="mt-6 card p-4 bg-teal-50 border-teal-200">
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
          <div className="mt-4 card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="btn-coral w-full justify-center text-base py-3 mt-6"
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
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="field-label">{label}</div>
      {hint && <div className="field-hint mb-2">{hint}</div>}
      <div>{children}</div>
    </label>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  positive,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-sm ${muted ? "text-ink-500" : "text-ink-900"}`}>
        {label}
      </span>
      <span
        className={`tabular ${
          bold ? "font-display text-lg text-ink-900" : "text-sm"
        } ${positive ? "text-teal-700 font-semibold" : ""} ${
          muted ? "text-ink-500" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Hr() {
  return <div className="border-t border-dashed border-sand-300" />;
}
