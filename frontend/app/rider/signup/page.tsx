"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, CheckCircle2, AlertCircle, Camera } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ridersApi } from "@/lib/api";

export default function RiderSignupPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nin, setNin] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [stage, setStage] = useState("");
  const [chairman, setChairman] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  function onPhotoChange(file: File | null) {
    if (!file) {
      setPhoto(null);
      return;
    }
    if (file.size > 800_000) {
      setError("Photo too large. Please pick a smaller image (under 800 KB).");
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
    setError(null);
    if (!fullName.trim()) return setError("Your full name is required.");
    if (!phone.trim()) return setError("Phone is required.");
    if (!plateNumber.trim()) return setError("Plate number is required.");

    setBusy(true);
    try {
      const rider = await ridersApi.signup({
        full_name: fullName.trim(),
        phone: phone.trim(),
        nin: nin.trim() || undefined,
        plate_number: plateNumber.trim(),
        stage: stage.trim() || undefined,
        chairman_reference: chairman.trim() || undefined,
        photo_url: photo || undefined,
      });
      setDone(rider.id);
      setTimeout(() => router.push(`/rider/${rider.id}`), 1800);
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
          <h1 className="font-display text-2xl text-ink-900 mt-4">You're in!</h1>
          <p className="text-ink-500 text-sm mt-2">
            Check your WhatsApp for your rider app link. Add it to your home screen.
          </p>
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
            For boda riders
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl text-ink-900 leading-[1.05] tracking-tight">
            Earn with <em className="text-teal-600 not-italic">Tukole</em>
          </h1>
          <p className="mt-4 text-ink-700">
            Every trip is paid — even if the customer rejects the item. Your
            earnings land in your wallet the moment delivery is confirmed.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="card p-6 sm:p-8 mt-8 space-y-5"
        >
          <Field label="Full name">
            <input
              type="text" value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Moses Kato"
              className="input" disabled={busy}
            />
          </Field>

          <Field label="Phone (WhatsApp)">
            <input
              type="tel" inputMode="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0701 123 456"
              className="input" disabled={busy}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Plate number">
              <input
                type="text" value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="UBE 123A"
                className="input font-mono" disabled={busy}
              />
            </Field>
            <Field label="National ID (optional)">
              <input
                type="text" value={nin}
                onChange={(e) => setNin(e.target.value.toUpperCase())}
                placeholder="CM..."
                className="input font-mono" disabled={busy}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Boda stage" hint="Where you usually park">
              <input
                type="text" value={stage}
                onChange={(e) => setStage(e.target.value)}
                placeholder="Bukoto Stage"
                className="input" disabled={busy}
              />
            </Field>
            <Field label="Stage chairman" hint="Who can vouch for you">
              <input
                type="text" value={chairman}
                onChange={(e) => setChairman(e.target.value)}
                placeholder="Chairman David"
                className="input" disabled={busy}
              />
            </Field>
          </div>

          <Field
            label="Profile photo (optional)"
            hint="Helps customers recognise you when you arrive."
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-sand-100 border-2 border-dashed border-sand-300 flex items-center justify-center overflow-hidden">
                {photo ? (
                  <img src={photo} alt="profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-5 h-5 text-ink-500" />
                )}
              </div>
              <span className="btn-secondary">
                {photo ? "Change photo" : "Take a photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => onPhotoChange(e.target.files?.[0] || null)}
                disabled={busy}
              />
            </label>
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
                Sign up <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>

        <p className="text-sm text-ink-500 mt-6 text-center">
          Selling instead?{" "}
          <Link href="/seller/signup" className="text-teal-700 hover:underline">
            Sign up as a seller
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
