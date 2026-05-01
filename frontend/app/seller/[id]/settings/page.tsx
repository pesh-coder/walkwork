"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { sellersApi, type Seller } from "@/lib/api";

export default function SettingsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");

  useEffect(() => {
    sellersApi.get(id).then((s) => {
      setSeller(s);
      setBusinessName(s.business_name);
      setOwnerName(s.owner_name);
      setLocationArea(s.location_area || "");
      setPickupNotes(s.pickup_notes || "");
    });
  }, [id]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await sellersApi.update(id, {
        business_name: businessName,
        owner_name: ownerName,
        location_area: locationArea,
        pickup_notes: pickupNotes,
      } as any);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!seller) {
    return <div className="px-5 py-6 text-sm text-ink-500">Loading…</div>;
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-2xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          Settings
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
          Your business
        </h1>
      </header>

      <div className="card p-6 sm:p-8 space-y-5">
        <Field label="Business name">
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="input"
            disabled={busy}
          />
        </Field>

        <Field label="Owner name">
          <input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="input"
            disabled={busy}
          />
        </Field>

        <Field label="Phone (login & WhatsApp)" hint="Cannot be changed without support.">
          <input type="tel" value={seller.phone} className="input" disabled />
        </Field>

        <Field
          label="Pickup area"
          hint="Where bodas come to collect from you. Default for new orders."
        >
          <input
            type="text"
            value={locationArea}
            onChange={(e) => setLocationArea(e.target.value)}
            className="input"
            placeholder="Bukoto"
            disabled={busy}
          />
        </Field>

        <Field
          label="Pickup notes"
          hint="What should the rider know when they arrive at your shop?"
        >
          <textarea
            value={pickupNotes}
            onChange={(e) => setPickupNotes(e.target.value)}
            className="input"
            placeholder="Cream-coloured shop with the green awning, opposite the salon."
            disabled={busy}
            rows={3}
          />
        </Field>

        {error && (
          <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700">
            {error}
          </div>
        )}

        <button
          onClick={save}
          disabled={busy}
          className="btn-primary justify-center w-full"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : savedAt && Date.now() - savedAt < 3000 ? (
            <>
              <Check className="w-4 h-4" />
              Saved
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="field-label">{label}</div>
      {hint && <div className="field-hint mb-2">{hint}</div>}
      <div>{children}</div>
    </label>
  );
}
