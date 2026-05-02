import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ShieldCheck, Star, MapPin, Truck, CheckCircle2, Clock,
  MessageCircle, Sparkles, Quote, Calendar,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { PublicProfile } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function fetchProfile(slug: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/s/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const profile = await fetchProfile(params.slug);
  if (!profile) {
    return { title: "Seller not found · Tukole" };
  }
  const title = `${profile.business_name} · Tukole-verified seller`;
  const description = profile.bio
    ? profile.bio
    : `${profile.verified_deliveries} verified deliveries · ${profile.on_time_rate_pct}% on-time · Pay safely via Tukole escrow.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: ["/icon-512.png"],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicSellerProfile({
  params,
}: {
  params: { slug: string };
}) {
  const profile = await fetchProfile(params.slug);
  if (!profile) notFound();

  const whatsappCleaned = profile.whatsapp_number.replace(/[^\d+]/g, "");
  const prefilledText = encodeURIComponent(
    `Hi ${profile.business_name}! I'd like to order from you using Tukole's secure delivery (my payment is held in escrow until delivery is confirmed).`
  );
  const waLink = `https://wa.me/${whatsappCleaned.replace(/^\+/, "")}?text=${prefilledText}`;

  // Star rendering helper
  const fullStars = Math.floor(profile.rating_out_of_5);
  const halfStar = profile.rating_out_of_5 - fullStars >= 0.5;

  return (
    <main className="min-h-screen bg-sand-50">
      {/* Top bar */}
      <header className="bg-teal-700 text-sand-50">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <Logo size="sm" variant="light" />
          <span className="text-[10px] uppercase tracking-wider opacity-90 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Tukole secure delivery
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4 pb-24">
        {/* Identity card */}
        <section className="card overflow-hidden">
          <div
            className="h-24 sm:h-32"
            style={{ backgroundColor: profile.profile_color }}
          />
          <div className="px-5 pb-5 -mt-12 sm:-mt-16">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-card border-4 border-sand-50 shadow-lift bg-sand-50 flex items-center justify-center font-display text-3xl sm:text-4xl tabular"
              style={{ color: profile.profile_color }}
            >
              {profile.initials}
            </div>
            <div className="mt-3">
              <h1 className="font-display text-2xl sm:text-3xl text-ink-900 leading-tight">
                {profile.business_name}
              </h1>
              {profile.location_area && (
                <div className="text-sm text-ink-500 mt-1 inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {profile.location_area}, Kampala
                </div>
              )}
              {profile.bio && (
                <p className="text-sm text-ink-700 mt-3 leading-relaxed">
                  {profile.bio}
                </p>
              )}
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-chip bg-teal-100 text-teal-700 text-xs font-medium">
                <ShieldCheck className="w-3 h-3" />
                Verified by Tukole
              </div>
            </div>
          </div>
        </section>

        {/* Trust stats */}
        <section className="grid grid-cols-2 gap-3">
          <Stat
            icon={Truck}
            label="Verified deliveries"
            value={profile.verified_deliveries.toLocaleString("en-UG")}
            sub="confirmed by buyers"
            tone="primary"
          />
          <Stat
            icon={Clock}
            label="On-time rate"
            value={`${profile.on_time_rate_pct}%`}
            sub="last 90 days"
          />
          <Stat
            icon={Star}
            label="Rating"
            value={`${profile.rating_out_of_5.toFixed(1)} ★`}
            sub={`${profile.rating_count} reviews`}
            tone="coral"
          />
          <Stat
            icon={CheckCircle2}
            label="Return rate"
            value={`${profile.return_rate_pct}%`}
            sub="kept by buyers"
          />
        </section>

        {/* CTA — primary action */}
        <section className="card-coral p-5 sm:p-6 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-90" />
          <div className="font-display text-2xl sm:text-3xl">
            Order with delivery protection
          </div>
          <div className="text-sm opacity-90 mt-1 max-w-md mx-auto">
            Your payment is held safely in Tukole escrow until your boda
            confirms delivery and you say you're happy.
          </div>
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="btn mt-4 bg-sand-50 text-coral-600 hover:bg-sand-100 text-base px-6 py-3 inline-flex"
          >
            <MessageCircle className="w-4 h-4" />
            Chat on WhatsApp
          </a>
          <div className="text-xs opacity-80 mt-3">
            You'll be taken to {profile.business_name}'s WhatsApp with your
            message ready to send.
          </div>
        </section>

        {/* How it works */}
        <section className="card p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500 mb-3">
            How Tukole protects you
          </div>
          <ol className="space-y-3 text-sm">
            <Step n="1" title="Chat & agree on price">
              Discuss the item with {profile.business_name} on WhatsApp.
            </Step>
            <Step n="2" title="Pay into Tukole escrow">
              Your money is held safely. The seller doesn't get it yet.
            </Step>
            <Step n="3" title="Boda delivers, you confirm">
              Once you receive your item and you're happy, the funds release.
            </Step>
          </ol>
        </section>

        {/* Testimonials */}
        {profile.testimonials.length > 0 && (
          <section>
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-2 px-1">
              What buyers say
            </div>
            <div className="space-y-2">
              {profile.testimonials.map((t, i) => (
                <div key={i} className="card p-4">
                  <Quote className="w-4 h-4 text-coral-500" />
                  <p className="text-sm text-ink-700 mt-1.5 leading-relaxed">
                    {t.body}
                  </p>
                  <div className="flex items-center justify-between mt-3 text-xs text-ink-500">
                    <span className="font-medium text-ink-900">{t.author}</span>
                    <span>{"★".repeat(t.rating)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer trust line */}
        <div className="card p-4 bg-teal-50 border-teal-200 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
          <div className="text-xs text-teal-700 leading-relaxed">
            <strong>Why this is different.</strong> {profile.business_name}{" "}
            uses Tukole's vetted delivery fleet — bodas trained on this
            seller's standards. Every order comes with photo evidence at
            pickup and delivery. Disputes resolved within 24 hours.
          </div>
        </div>

        {/* Sticky bottom CTA on mobile */}
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto sm:hidden btn-coral justify-center text-base py-3 shadow-lift z-30"
        >
          <MessageCircle className="w-4 h-4" />
          Order with delivery protection
        </a>

        <div className="text-center text-xs text-ink-500 mt-6">
          Powered by{" "}
          <span className="font-display text-teal-700">tukole</span>. We move
          trust, not just packages.
        </div>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: typeof Truck;
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "primary" | "coral";
}) {
  const cls =
    tone === "primary" ? "card-teal" : tone === "coral" ? "card-coral" : "card";
  const accent = tone !== "default";
  return (
    <div className={`${cls} p-4`}>
      <div className="flex items-center gap-2">
        <Icon
          className={`w-4 h-4 ${accent ? "opacity-90" : "text-ink-500"}`}
        />
        <span
          className={`text-[10px] uppercase tracking-wider ${
            accent ? "opacity-80" : "text-ink-500"
          }`}
        >
          {label}
        </span>
      </div>
      <div
        className={`mt-1 font-display text-2xl tabular leading-tight ${
          accent ? "" : "text-ink-900"
        }`}
      >
        {value}
      </div>
      <div
        className={`text-[11px] mt-0.5 ${
          accent ? "opacity-75" : "text-ink-500"
        }`}
      >
        {sub}
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-coral-500 text-sand-50 text-xs font-medium flex items-center justify-center shrink-0">
        {n}
      </span>
      <div>
        <div className="font-medium text-ink-900">{title}</div>
        <div className="text-ink-500 text-xs mt-0.5">{children}</div>
      </div>
    </li>
  );
}
