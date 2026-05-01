"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { sellersApi } from "@/lib/api";

const KAMPALA_AREAS = [
  "Bukoto", "Ntinda", "Kololo", "Kamwokya", "Nakawa", "Kabalagala",
  "Bugolobi", "Muyenga", "Naguru", "Mbuya", "Najjera", "Kira",
  "Mengo", "Rubaga", "Kawempe", "Makindye", "Wandegeya", "Nakulabye",
  "Kansanga", "Katwe", "Other",
];

export default function SellerSignupPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");

  async function submit() {
    setError(null);
    if (!businessName.trim()) return setError("Business name is required.");
    if (!ownerName.trim()) return setError("Your name is required.");
    if (!phone.trim()) return setError("Phone number is required.");
    if (!area) return setError("Please pick your area.");

    setBusy(true);
    try {
      const seller = await sellersApi.signup({
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        location_area: area === "Other" ? undefined : area,
      });
      setDone(seller.id);
      setTimeout(() => router.push(`/seller/${seller.id}`), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 max-w-md w-full text-center"
        >
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-teal-600" />
          </div>
          <h1 className="font-display text-2xl text-ink-900 mt-4">
            Welcome to Tukole
          </h1>
          <p className="text-ink-500 text-sm mt-2">
            Check your WhatsApp — we've sent your dashboard link.
          </p>
          <p className="text-ink-500 text-xs mt-4">Redirecting…</p>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="px-5 sm:px-8 pt-6">
        <Link href="/">
          <Logo size="md" variant="teal" />
        </Link>
      </header>

      <section className="mx-auto max-w-xl px-5 sm:px-8 pt-10 sm:pt-16 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-chip bg-coral-100 text-coral-700 text-xs font-medium">
            UGX 10,000 starter credit
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl text-ink-900 leading-[1.05] tracking-tight">
            Set up your <em className="text-teal-600 not-italic">Tukole</em> shop
          </h1>
          <p className="mt-4 text-ink-700">
            Tell us about your business — under a minute. Your dashboard will be
            ready as soon as you finish.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="card p-6 sm:p-8 mt-8 space-y-5"
        >
          <Field label="Business name" hint="What your customers see on the tracking page.">
            <input
              type="text" value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Sarah's Closet"
              className="input" disabled={busy}
            />
          </Field>

          <Field label="Your name">
            <input
              type="text" value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Sarah Namugga"
              className="input" disabled={busy}
            />
          </Field>

          <Field
            label="WhatsApp number"
            hint="We'll send your dashboard link here. Use the same number you use on WhatsApp."
          >
            <input
              type="tel" inputMode="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0772 123 456"
              className="input" disabled={busy}
            />
          </Field>

          <Field label="Where are you based?">
            <select
              value={area} onChange={(e) => setArea(e.target.value)}
              className="input" disabled={busy}
            >
              <option value="">Pick an area…</option>
              {KAMPALA_AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>

          {error && (
            <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button" disabled={busy} onClick={submit}
            className="btn-coral w-full justify-center text-base py-3"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating your account…
              </>
            ) : (
              <>
                Create account <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-xs text-ink-500 text-center pt-2">
            By creating an account you agree to our terms.
          </p>
        </motion.div>

        <p className="text-sm text-ink-500 mt-6 text-center">
          Are you a boda rider?{" "}
          <Link href="/rider/signup" className="text-teal-700 hover:underline">
            Sign up here
          </Link>
        </p>
      </section>
    </main>
  );
}

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="field-label">{label}</div>
      {hint && <div className="field-hint mb-2">{hint}</div>}
      <div>{children}</div>
    </label>
  );
}
