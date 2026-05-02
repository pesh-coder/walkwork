import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, MapPin, Search, Sparkles, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const metadata: Metadata = {
  title: "Explore verified sellers in Kampala · Tukole",
  description:
    "Browse Kampala's online sellers — every shop verified by Tukole, every order protected by escrow. Modest fashion, electronics, home goods, more.",
  openGraph: {
    title: "Explore verified sellers in Kampala · Tukole",
    description:
      "Trust-protected shopping for Kampala's online economy. Pay safely, get delivered, confirm satisfaction.",
    type: "website",
  },
};

interface Seller {
  id: string;
  business_name: string;
  slug: string | null;
  bio?: string | null;
  location_area?: string | null;
  profile_color?: string | null;
}

async function loadSellers(): Promise<Seller[]> {
  try {
    const res = await fetch(`${API_BASE}/sellers`, {
      next: { revalidate: 60 }, // refresh once a minute
    });
    if (!res.ok) return [];
    const all = await res.json();
    // Only sellers with public slugs
    return all.filter((s: Seller) => s.slug);
  } catch {
    return [];
  }
}

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (!parts.length) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Group sellers by area for SEO-friendly internal linking
function groupByArea(sellers: Seller[]): Record<string, Seller[]> {
  const groups: Record<string, Seller[]> = {};
  for (const s of sellers) {
    const area = s.location_area || "Kampala";
    (groups[area] ||= []).push(s);
  }
  return groups;
}

export default async function ExplorePage() {
  const sellers = await loadSellers();
  const grouped = groupByArea(sellers);
  const areas = Object.keys(grouped).sort();

  return (
    <main className="min-h-screen bg-sand-50">
      {/* Header */}
      <header className="bg-teal-700 text-sand-50">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between">
          <Link href="/">
            <Logo size="md" variant="light" />
          </Link>
          <Link
            href="/seller/signup"
            className="btn bg-coral-500 text-sand-50 hover:bg-coral-600 text-sm"
          >
            Sell on Tukole <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 sm:px-8 pt-12 pb-8 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-chip bg-coral-100 text-coral-700 text-xs font-medium">
          <ShieldCheck className="w-3 h-3" />
          {sellers.length} verified sellers in Kampala
        </div>
        <h1 className="mt-5 font-display text-4xl sm:text-6xl text-ink-900 leading-[1.05] tracking-tight">
          Discover Kampala's{" "}
          <em className="text-teal-600 not-italic">verified shops</em>.
        </h1>
        <p className="mt-5 text-lg text-ink-700 max-w-2xl leading-relaxed">
          Every seller below is protected by Tukole's escrow. Pay safely, get
          your item delivered, confirm you're happy — only then does the seller
          get the money.
        </p>
      </section>

      {/* Sellers grouped by area */}
      <section className="px-5 sm:px-8 pb-16 max-w-5xl mx-auto">
        {sellers.length === 0 ? (
          <div className="card p-12 text-center">
            <Sparkles className="w-10 h-10 mx-auto text-ink-500" />
            <div className="font-display text-xl text-ink-900 mt-3">
              No sellers yet
            </div>
            <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
              Tukole is just launching. Come back soon — sellers are joining every day.
            </p>
            <Link href="/seller/signup" className="btn-primary mt-4 inline-flex">
              Be the first to sell on Tukole
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {areas.map((area) => (
              <div key={area}>
                <h2 className="font-display text-xl text-ink-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-coral-500" />
                  {area}
                  <span className="text-xs text-ink-500 font-sans font-normal">
                    ({grouped[area].length}{" "}
                    {grouped[area].length === 1 ? "shop" : "shops"})
                  </span>
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped[area].map((s) => (
                    <Link
                      key={s.id}
                      href={`/s/${s.slug}`}
                      className="card p-5 hover:shadow-lift transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-card flex items-center justify-center font-display text-base font-semibold text-sand-50 shrink-0"
                          style={{ backgroundColor: s.profile_color || "#0E6B6B" }}
                        >
                          {initials(s.business_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-base text-ink-900 truncate">
                            {s.business_name}
                          </div>
                          <div className="text-xs text-ink-500 truncate">
                            {s.location_area || "Kampala"} · Verified
                          </div>
                        </div>
                      </div>
                      {s.bio && (
                        <p className="text-sm text-ink-700 mt-3 line-clamp-2 leading-relaxed">
                          {s.bio}
                        </p>
                      )}
                      <div className="mt-3 inline-flex items-center gap-1 text-xs text-teal-700 font-medium">
                        <ShieldCheck className="w-3 h-3" />
                        Pay safely with escrow
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEO/discoverability footer */}
      <footer className="px-5 sm:px-8 py-12 border-t border-sand-200 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-6 text-sm text-ink-700">
          <div>
            <div className="font-display text-base text-ink-900 mb-2">
              Why shop on Tukole?
            </div>
            <ul className="space-y-1.5 text-ink-700 leading-relaxed">
              <li>✓ Escrow protection on every order</li>
              <li>✓ Vetted boda riders with photo proof</li>
              <li>✓ Buy directly from sellers — no middleman markup</li>
              <li>✓ Same-day delivery across Kampala</li>
            </ul>
          </div>
          <div>
            <div className="font-display text-base text-ink-900 mb-2">
              Are you a seller?
            </div>
            <p className="text-ink-700 leading-relaxed">
              Get a Google-discoverable trust page, escrow-protected payments,
              and a vetted delivery fleet — without building a website.
            </p>
            <Link
              href="/seller/signup"
              className="btn-primary mt-3 inline-flex text-sm"
            >
              Start selling <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
