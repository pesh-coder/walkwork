"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Shield, MapPin, Smartphone, Sparkles,
  PackageCheck, Banknote, Eye,
} from "lucide-react";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="px-5 sm:px-8 pt-6 flex items-center justify-between max-w-6xl mx-auto">
        <Logo size="md" variant="teal" />
        <div className="flex items-center gap-3">
          <a href="#how" className="hidden sm:inline text-sm text-ink-700 hover:text-ink-900">
            How it works
          </a>
          <a href="#pricing" className="hidden sm:inline text-sm text-ink-700 hover:text-ink-900">
            Pricing
          </a>
          <Link href="/rider/signup" className="hidden md:inline text-sm text-ink-700 hover:text-ink-900">
            Boda riders
          </Link>
          <Link href="/seller/signup" className="btn-primary">
            Start selling <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-5 sm:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-chip bg-coral-100 text-coral-700 text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            Trust, built into every delivery
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 font-display text-4xl sm:text-6xl lg:text-7xl text-ink-900 leading-[1.05] tracking-tight max-w-4xl"
        >
          Your customer pays{" "}
          <em className="text-teal-600 not-italic">safely</em>.<br />
          Your boda gets paid <em className="text-coral-500 not-italic">guaranteed</em>.<br />
          You see <em className="text-teal-600 not-italic">every shilling</em>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-ink-700 max-w-2xl leading-relaxed"
        >
          Tukole is the trust layer between Kampala's online sellers and their
          customers. Money sits in escrow until the customer is happy. The rider
          is paid for the trip. The seller is paid for the sale. No more
          disappearing cash, no more failed deliveries.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-wrap gap-3"
        >
          <Link href="/seller/signup" className="btn-primary text-base px-6 py-3">
            Start selling — UGX 10,000 free credit <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/rider/signup" className="btn-secondary text-base px-6 py-3">
            I'm a boda rider
          </Link>
        </motion.div>
      </section>

      {/* The trust proposition (3 columns) */}
      <section id="how" className="px-5 sm:px-8 py-16 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl text-ink-900 mb-3">
          Trust on every side.
        </h2>
        <p className="text-ink-700 mb-12 max-w-2xl">
          Other delivery apps move packages. Tukole moves trust between three
          parties — and gets each one paid the right amount, at the right time.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          <Trust
            icon={Shield}
            title="For the customer"
            body="You pay into Tukole's escrow, not the seller. The boda only delivers once your money is secured. After you receive the item and check it, you release the funds — or open a dispute if something's wrong."
          />
          <Trust
            icon={Banknote}
            title="For the seller"
            body="No more chasing customers for payment. Your earnings appear in your wallet the moment the customer approves. See every order, every shilling, and every boda live on your dashboard."
          />
          <Trust
            icon={Smartphone}
            title="For the boda rider"
            body="Every trip is paid — even if the customer rejects the item. The funds are guaranteed before you pick up. Pickup and delivery photos protect you from disputes."
          />
        </div>
      </section>

      {/* The flow */}
      <section className="px-5 sm:px-8 py-16 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl text-ink-900 mb-12">
          How it works.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Step num="01" title="Seller creates the order">
            Sarah opens her Tukole dashboard, enters her customer's name, phone
            and the item price. Tukole sends an SMS with a tracking link.
          </Step>
          <Step num="02" title="Customer drops their pin & pays">
            On the tracking page, the customer drags a pin on a satellite map
            to their exact gate, optionally uploads a landmark photo, then pays
            into escrow with one tap.
          </Step>
          <Step num="03" title="Rider delivers, customer approves">
            The nearest available boda is dispatched. Customer reads them the
            OTP, approves the delivery — and Tukole releases the money to the
            seller and the rider in seconds.
          </Step>
        </div>
      </section>

      {/* The Tukole Bullseye */}
      <section className="px-5 sm:px-8 py-16 max-w-6xl mx-auto">
        <div className="card-teal p-8 sm:p-12">
          <div className="text-xs uppercase tracking-wider text-teal-100 font-medium">
            The Tukole Bullseye
          </div>
          <h2 className="mt-2 font-display text-3xl sm:text-5xl leading-tight">
            We solved the address problem.
          </h2>
          <p className="mt-6 text-teal-100 max-w-3xl text-lg">
            Most of Kampala doesn't have street addresses. Sellers tell their
            riders things like <em>"behind the petrol station, near the mango
            tree"</em> — and bodas get lost. Tukole asks the customer to drop
            their own pin and snap a photo of their gate. The next time anyone
            delivers to that customer, the bullseye is already saved.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>Satellite-view pin drop</Badge>
            <Badge>Plus Code (3m precision)</Badge>
            <Badge>Landmark photo</Badge>
            <Badge>Rider-learned map</Badge>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-5 sm:px-8 py-16 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl text-ink-900 mb-3">
          Honest pricing.
        </h2>
        <p className="text-ink-700 mb-12 max-w-2xl">
          We make money when sellers make sales. No commitment, no monthly fee.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <PricingCard
            label="Customer pays"
            value="Item + UGX 5,000"
            sub="Total stays in escrow"
            tone="default"
          />
          <PricingCard
            label="Seller keeps"
            value="95%"
            sub="of the item value"
            tone="primary"
          />
          <PricingCard
            label="Rider gets"
            value="UGX 5,000"
            sub="per completed trip"
            tone="coral"
          />
        </div>
        <p className="mt-6 text-sm text-ink-500">
          Tukole keeps a 5% commission on the item value plus a fixed UGX 1,500
          platform fee. That's how we keep the lights on.
        </p>
      </section>

      <footer className="px-5 sm:px-8 py-12 border-t border-sand-200 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" variant="teal" />
            <span className="text-xs text-ink-500">Built in Kampala for Kampala.</span>
          </div>
          <div className="text-xs text-ink-500">Future Makers Hackathon 2026</div>
        </div>
      </footer>
    </main>
  );
}

function Trust({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Shield;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6">
      <div className="w-10 h-10 rounded-card bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-display text-xl text-ink-900">{title}</h3>
      <p className="mt-2 text-sm text-ink-700 leading-relaxed">{body}</p>
    </div>
  );
}

function Step({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="font-mono text-xs text-coral-600 mb-2">{num}</div>
      <h3 className="font-display text-xl text-ink-900 leading-tight">{title}</h3>
      <p className="mt-2 text-sm text-ink-700 leading-relaxed">{children}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-chip bg-teal-600 border border-teal-500 text-teal-100 text-xs">
      {children}
    </span>
  );
}

function PricingCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "default" | "primary" | "coral";
}) {
  const toneClass =
    tone === "primary"
      ? "card-teal"
      : tone === "coral"
      ? "card-coral"
      : "card";

  return (
    <div className={`${toneClass} p-6`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-2 font-display text-3xl tabular leading-tight">
        {value}
      </div>
      <div className="text-sm opacity-80 mt-1">{sub}</div>
    </div>
  );
}
