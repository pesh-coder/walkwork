"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { adminApi } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [demoIds, setDemoIds] = useState<{ seller: string; moses: string; grace: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function launchDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.seed();
      setDemoIds({
        seller: res.seller_id,
        moses: res.rider_ids.moses,
        grace: res.rider_ids.grace,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="px-5 sm:px-8 pt-6 flex items-center justify-between">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          <a
            href="#how"
            className="hidden sm:inline text-sm text-ink-700 hover:text-ink-900"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="hidden sm:inline text-sm text-ink-700 hover:text-ink-900"
          >
            Pricing
          </a>
          <a
            href="/seller/signup"
            className="text-sm text-ink-700 hover:text-ink-900"
          >
            Sign up
          </a>
          <button onClick={launchDemo} className="btn-primary">
            Launch demo <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-5 sm:px-8 pt-16 sm:pt-24 pb-12 mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-terracotta-400/15 text-terracotta-700 text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            Built for Kampala's online sellers
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 font-display text-4xl sm:text-6xl lg:text-7xl text-ink-900 leading-[1.05] tracking-tight"
        >
          We move <em className="text-terracotta-600 not-italic">orders</em>
          <br />
          and <em className="text-forest-600 not-italic">money</em> reliably.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-ink-700 max-w-2xl leading-relaxed"
        >
          Online sellers in Kampala lose 30% of orders to failed deliveries and
          missing cash. Tukole tracks every package <em>and</em> every shilling
          — so you always know where your money is.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-wrap gap-3"
        >
          <button onClick={launchDemo} disabled={busy} className="btn-primary text-base px-6 py-3">
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Launching demo…
              </>
            ) : (
              <>
                Launch demo <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <a href="#how" className="btn-secondary text-base px-6 py-3">
            How it works
          </a>
        </motion.div>

        {error && (
          <p className="mt-4 text-sm text-terracotta-700">
            Couldn't reach backend: {error}. Make sure it's running on localhost:8000.
          </p>
        )}

        {demoIds && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 card p-6 max-w-3xl"
          >
            <div className="text-xs uppercase tracking-wider text-forest-600 font-medium">
              Demo ready
            </div>
            <h3 className="font-display text-2xl text-ink-900 mt-1">
              Open the three surfaces side-by-side
            </h3>
            <p className="text-sm text-ink-500 mt-1">
              Right-click each link, "Open in new tab", and arrange them on screen.
              That's the demo setup.
            </p>
            <div className="mt-4 grid sm:grid-cols-3 gap-3">
              <DemoLink
                title="Sarah's dashboard"
                subtitle="Seller view"
                href={`/seller/${demoIds.seller}`}
              />
              <DemoLink
                title="Moses's app"
                subtitle="Rider PWA"
                href={`/rider/${demoIds.moses}`}
              />
              <DemoLink
                title="Customer tracking"
                subtitle="Pick an order from Sarah's dashboard"
                href={`/seller/${demoIds.seller}`}
              />
            </div>
          </motion.div>
        )}
      </section>

      {/* How it works */}
      <section id="how" className="px-5 sm:px-8 py-20 mx-auto max-w-5xl">
        <h2 className="font-display text-3xl sm:text-4xl text-ink-900 mb-12">
          How it works.
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <Step
            num="01"
            title="Send the order from WhatsApp"
            body="No app to install. Sarah forwards the customer's details to her Tukole bot the same way she already coordinates riders today."
          />
          <Step
            num="02"
            title="A trusted rider is assigned"
            body="Moses gets the job on his rider PWA. He confirms pickup, navigates with the built-in map, and meets the customer."
          />
          <Step
            num="03"
            title="OTP confirms delivery + cash"
            body="The customer's SMS code proves the package was received. Cash is deposited to MoMo and lands in Sarah's wallet — visible on her ledger in real time."
          />
        </div>
      </section>

      {/* Differentiator */}
      <section className="px-5 sm:px-8 py-20 mx-auto max-w-5xl">
        <div className="card p-8 sm:p-12 bg-forest-700 text-cream-50 border-forest-700">
          <div className="text-xs uppercase tracking-wider text-cream-200/80 font-medium">
            The difference
          </div>
          <h2 className="mt-2 font-display text-3xl sm:text-5xl leading-tight">
            Glovo is like calling a taxi.
            <br />
            <span className="text-terracotta-400">Tukole is like owning a fleet.</span>
          </h2>
          <p className="mt-6 text-cream-200/80 max-w-2xl text-lg">
            We don't compete on rides. We give online sellers the operating
            system they need to run all their deliveries every day — with
            visibility into every shilling.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-5 sm:px-8 py-20 mx-auto max-w-5xl">
        <h2 className="font-display text-3xl sm:text-4xl text-ink-900 mb-3">
          Simple pricing.
        </h2>
        <p className="text-ink-700 mb-12">Start per-delivery. Switch to subscription when you scale.</p>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card p-8">
            <div className="text-xs uppercase tracking-wider text-ink-500 font-medium">
              Per delivery
            </div>
            <div className="mt-2 font-display text-5xl tabular text-ink-900">
              UGX 5,000
            </div>
            <p className="text-sm text-ink-500 mt-1">per successful delivery</p>
            <ul className="mt-6 space-y-2 text-sm text-ink-700">
              <li>· Real-time tracking + customer SMS</li>
              <li>· OTP-confirmed delivery</li>
              <li>· Cash reconciliation in your wallet</li>
              <li>· No commitment — pay as you go</li>
            </ul>
          </div>
          <div className="card p-8 bg-cream-100 border-cream-300">
            <div className="text-xs uppercase tracking-wider text-terracotta-700 font-medium">
              Subscription <span className="ml-1 px-1.5 py-0.5 rounded bg-terracotta-500 text-cream-50 text-[10px]">Coming Soon</span>
            </div>
            <div className="mt-2 font-display text-5xl tabular text-ink-900">
              UGX 150,000<span className="text-base text-ink-500 font-sans">/mo</span>
            </div>
            <p className="text-sm text-ink-500 mt-1">includes 30 deliveries/day</p>
            <ul className="mt-6 space-y-2 text-sm text-ink-700">
              <li>· Everything in per-delivery</li>
              <li>· Priority dispatch</li>
              <li>· 95% on-time SLA</li>
              <li>· Dedicated rider pool</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="px-5 sm:px-8 py-12 border-t border-cream-200 mx-auto max-w-5xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-xs text-ink-500">
              Built in Kampala for Kampala.
            </span>
          </div>
          <div className="text-xs text-ink-500">
            Future Makers Hackathon 2026
          </div>
        </div>
      </footer>
    </main>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="card p-6">
      <div className="font-mono text-xs text-terracotta-600 mb-2">{num}</div>
      <h3 className="font-display text-xl text-ink-900 leading-tight">{title}</h3>
      <p className="mt-2 text-sm text-ink-700 leading-relaxed">{body}</p>
    </div>
  );
}

function DemoLink({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="card p-4 hover:shadow-lift transition-all flex items-center justify-between group"
    >
      <div className="min-w-0">
        <div className="font-display text-base text-ink-900 truncate">{title}</div>
        <div className="text-xs text-ink-500 truncate">{subtitle}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-ink-500 group-hover:text-ink-900 group-hover:translate-x-0.5 transition-transform shrink-0" />
    </a>
  );
}