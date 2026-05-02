"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, Copy, Check, ExternalLink, Loader2, ShieldCheck,
  AlertCircle, MessageCircle, Download,
} from "lucide-react";
import { sellersApi, type Seller } from "@/lib/api";

export default function ProfileEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Editable fields
  const [bio, setBio] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    sellersApi
      .get(id)
      .then((s) => {
        setSeller(s);
        setBio(s.bio || "");
        setSlug(s.slug || "");
        setWhatsapp(s.whatsapp_number || s.phone || "");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await sellersApi.update(id, {
        bio: bio.trim() || undefined,
        slug: slug.trim() || undefined,
        whatsapp_number: whatsapp.trim() || undefined,
      } as any);
      setSeller(updated);
      setSlug(updated.slug || "");
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!seller) {
    return (
      <div className="px-5 py-6 text-sm text-ink-500">Loading…</div>
    );
  }

  const publicUrl =
    typeof window !== "undefined" && seller.slug
      ? `${window.location.origin}/s/${seller.slug}`
      : `${seller.slug ? "/s/" + seller.slug : ""}`;

  async function copyLink() {
    if (!seller?.slug) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadBadge() {
    if (!seller?.slug) return;
    const svg = makeBadgeSVG(seller.business_name, seller.slug);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tukole-verified-${seller.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          Public profile
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
          Your buyer-facing trust page
        </h1>
        <p className="mt-2 text-sm text-ink-700 max-w-2xl">
          Share this page in your Instagram bio, TikTok link-in-bio, or
          WhatsApp Business profile. New buyers see your verified delivery
          stats before they message you — and your "pay-on-delivery via Tukole
          escrow" promise turns hesitant scrollers into customers.
        </p>
      </header>

      {/* Live link card */}
      {seller.slug && (
        <section className="card-teal p-5 mb-4">
          <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
            Your shareable link
          </div>
          <div className="font-mono text-sm sm:text-base break-all">
            {publicUrl}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={copyLink}
              className="btn bg-sand-50 text-teal-700 hover:bg-sand-100 text-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="btn bg-sand-50/15 text-sand-50 hover:bg-sand-50/25 text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Preview my page
            </a>
            <button
              onClick={downloadBadge}
              className="btn bg-sand-50/15 text-sand-50 hover:bg-sand-50/25 text-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download "Verified" badge
            </button>
          </div>
        </section>
      )}

      {/* Editor */}
      <div className="card p-6 sm:p-8 space-y-5">
        <Field
          label="Page link (slug)"
          hint="The unique part of your tukole link. Lowercase letters, numbers, and dashes only."
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-500 shrink-0 font-mono hidden sm:inline">
              tukole.../s/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="sarahs-closet"
              className="input font-mono"
              disabled={busy}
            />
          </div>
        </Field>

        <Field
          label="Short bio"
          hint={`What you sell, your style. ${200 - bio.length} characters left.`}
        >
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 200))}
            placeholder="Curated African fashion · ships across Kampala · pay safely with Tukole"
            className="input"
            rows={3}
            disabled={busy}
          />
        </Field>

        <Field
          label="WhatsApp number"
          hint="Where buyers' WhatsApp messages land when they tap 'Order with delivery protection'."
        >
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="0772 123 456"
            className="input"
            disabled={busy}
          />
        </Field>

        {error && (
          <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={save}
          disabled={busy}
          className="btn-primary w-full justify-center"
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
            <>
              <Sparkles className="w-4 h-4" />
              Save changes
            </>
          )}
        </button>
      </div>

      {/* Tip card */}
      <section className="card p-5 mt-4 bg-coral-50 border-coral-200">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-coral-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-coral-700">
              Where to share your link
            </div>
            <ul className="text-sm text-ink-700 mt-1 space-y-1 list-disc pl-4">
              <li>Instagram bio (replace your old "DM to order" text)</li>
              <li>TikTok link-in-bio</li>
              <li>WhatsApp Business profile (under "Website")</li>
              <li>Twitter / X bio</li>
              <li>Pinned to the top of your Instagram stories highlight</li>
            </ul>
          </div>
        </div>
      </section>
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

function makeBadgeSVG(businessName: string, slug: string): string {
  // Simple downloadable badge — teal background, "Verified by Tukole" + "Pay safely" + slug
  const safeName = (businessName || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <rect width="800" height="800" rx="40" fill="#0E6B6B"/>
  <g transform="translate(60, 60)">
    <text x="0" y="40" font-family="Georgia, serif" font-weight="700" font-size="48" fill="#FBF6F0">tukole<tspan fill="#EF6018">.</tspan></text>
    <text x="0" y="80" font-family="Inter, sans-serif" font-size="20" fill="#FBF6F0" opacity="0.7">SECURE DELIVERY</text>
  </g>
  <g transform="translate(400, 380)" text-anchor="middle">
    <circle cx="0" cy="-100" r="60" fill="#EF6018"/>
    <path d="M -25 -100 L -8 -83 L 25 -116" stroke="#FBF6F0" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="0" y="-15" font-family="Georgia, serif" font-weight="700" font-size="48" fill="#FBF6F0">Verified seller</text>
    <text x="0" y="35" font-family="Inter, sans-serif" font-weight="500" font-size="32" fill="#FBF6F0" opacity="0.85">${safeName}</text>
  </g>
  <g transform="translate(400, 600)" text-anchor="middle">
    <text x="0" y="0" font-family="Inter, sans-serif" font-size="22" fill="#FBF6F0" opacity="0.85">Pay-on-delivery via Tukole escrow</text>
    <text x="0" y="30" font-family="Inter, sans-serif" font-size="22" fill="#FBF6F0" opacity="0.85">tukole.com/s/${slug}</text>
  </g>
  <g transform="translate(740, 740)" text-anchor="end">
    <text x="0" y="0" font-family="Inter, sans-serif" font-size="14" fill="#FBF6F0" opacity="0.5">tukole.com</text>
  </g>
</svg>`;
}
