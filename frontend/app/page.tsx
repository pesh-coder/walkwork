import Link from "next/link";
import {
  ArrowRight, Users, BarChart3, MapPin, ShieldCheck,
  Smartphone, Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-sand-50">
      {/* Top nav */}
      <header className="border-b border-sand-200 bg-sand-50/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <Logo size="md" />
          <nav className="hidden sm:flex items-center gap-6 text-sm text-ink-700">
            <a href="#how-it-works" className="hover:text-teal-700">How it works</a>
            <a href="#pricing" className="hover:text-teal-700">Pricing</a>
            <a href="#riders" className="hover:text-teal-700">Boda riders</a>
          </nav>
          <Link href="/seller/signup" className="btn-primary text-sm">
            Start selling
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 sm:px-8 pt-16 sm:pt-24 pb-20 max-w-6xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-chip bg-coral-100 text-coral-700 text-xs font-medium">
          <Sparkles className="w-3 h-3" />
          Built for online sellers in Kampala
        </div>
        <h1 className="mt-6 font-display text-5xl sm:text-7xl text-ink-900 leading-[1.04] tracking-tight max-w-4xl">
          Run your deliveries{" "}
          <em className="text-teal-600 not-italic">like a real business</em>.
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-ink-700 max-w-2xl leading-relaxed">
          Tukole is the delivery platform for online businesses. Trained riders,
          live tracking, and a record of every customer — so you can stop
          chasing orders and start growing your shop.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/seller/signup" className="btn-primary text-base">
            Start selling — UGX 10,000 free credit
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/rider/signup" className="btn-secondary text-base">
            I'm a boda rider
          </Link>
        </div>
      </section>

      {/* What changes for a seller */}
      <section className="px-5 sm:px-8 py-16 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl text-ink-900 max-w-2xl">
          What changes when you join Tukole.
        </h2>
        <p className="mt-3 text-ink-700 max-w-2xl">
          Three things every online business needs — and most don't have.
        </p>

        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          <BenefitCard
            icon={Users}
            title="Own your customers"
            body="Every customer's name, phone and address sits in your dashboard. They're yours — to follow up, to retain, to grow."
          />
          <BenefitCard
            icon={MapPin}
            title="Control your deliveries"
            body="Vetted bodas, assigned to your business. Live map tracking. Photo proof at pickup and delivery. No more chasing."
          />
          <BenefitCard
            icon={BarChart3}
            title="Grow your brand"
            body="Customers see your shop, not ours. Every delivery becomes a touchpoint that builds your reputation, not someone else's."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-5 sm:px-8 py-20 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl text-ink-900 max-w-2xl">
          How it works.
        </h2>
        <p className="mt-3 text-ink-700 max-w-2xl">
          Three steps from order to delivered. No phone calls. No chaos.
        </p>

        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          <Step
            n="01"
            title="You create the order"
            body="Open Tukole, enter your customer's name, phone, and what they're buying. Tukole sends them a tracking link."
          />
          <Step
            n="02"
            title="Customer drops their pin"
            body="They tap the link, drag a pin to their gate on a satellite map, and confirm. Your trained boda is dispatched."
          />
          <Step
            n="03"
            title="Delivered — recorded forever"
            body="Boda delivers. Customer confirms. The whole transaction lives in your dashboard, ready for repeat business."
          />
        </div>
      </section>

      {/* The address problem */}
      <section className="px-5 sm:px-8 py-12 max-w-6xl mx-auto">
        <div className="card-teal p-8 sm:p-12">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-wider opacity-80 mb-3">
              The Tukole bullseye
            </div>
            <h2 className="font-display text-3xl sm:text-4xl leading-tight">
              We solved the address problem.
            </h2>
            <p className="mt-4 text-base sm:text-lg leading-relaxed opacity-95">
              Most of Kampala doesn't have street addresses. Sellers tell their
              riders <em>"behind the petrol station, near the mango tree"</em> —
              and bodas get lost. We ask the customer to drop their own pin and
              snap a photo of their gate. Next time anyone delivers to that
              customer, the bullseye is already saved.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-chip bg-sand-50/15 backdrop-blur">
                Satellite-view pin drop
              </span>
              <span className="px-3 py-1.5 rounded-chip bg-sand-50/15 backdrop-blur">
                Plus Code precision
              </span>
              <span className="px-3 py-1.5 rounded-chip bg-sand-50/15 backdrop-blur">
                Landmark photo
              </span>
              <span className="px-3 py-1.5 rounded-chip bg-sand-50/15 backdrop-blur">
                Rider-learned map
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-5 sm:px-8 py-20 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl text-ink-900 max-w-2xl">
          Pricing that helps you keep more of what you earn.
        </h2>
        <p className="mt-3 text-ink-700 max-w-2xl">
          Pick the plan that matches how you sell. Cancel anytime.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {/* Basic */}
          <div className="card p-6 sm:p-8">
            <div className="text-xs uppercase tracking-wider text-teal-700 font-semibold">
              Basic
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl text-ink-900">UGX 20,000</span>
              <span className="text-sm text-ink-500">/ month</span>
            </div>
            <p className="text-sm text-ink-500 mt-1">
              Plus 2% on item value
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-700">
              <Feature>Trained bodas assigned to your shop</Feature>
              <Feature>Live order tracking for you and your customer</Feature>
              <Feature>Customer + delivery history saved</Feature>
              <Feature>Branded tracking page</Feature>
              <Feature>Photo proof of every delivery</Feature>
            </ul>
            <Link href="/seller/signup" className="btn-secondary w-full justify-center mt-6">
              Start with Basic
            </Link>
          </div>

          {/* Premium */}
          <div className="card-coral p-6 sm:p-8 relative">
            <span className="absolute top-4 right-4 px-2.5 py-1 rounded-chip bg-sand-50/25 text-xs font-semibold backdrop-blur">
              Recommended
            </span>
            <div className="text-xs uppercase tracking-wider opacity-90 font-semibold">
              Premium
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl">UGX 50,000</span>
              <span className="text-sm opacity-90">/ month</span>
            </div>
            <p className="text-sm opacity-90 mt-1">
              Plus 2% on item value
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              <Feature accent>Everything in Basic</Feature>
              <Feature accent>Dedicated team of bodas for your shop</Feature>
              <Feature accent>Public verified shop profile</Feature>
              <Feature accent>Customer attribution analytics</Feature>
              <Feature accent>Priority support, faster dispute resolution</Feature>
            </ul>
            <Link href="/seller/signup" className="btn w-full justify-center mt-6 bg-sand-50 text-coral-600 hover:bg-sand-100">
              Start with Premium
            </Link>
          </div>
        </div>

        <p className="mt-6 text-sm text-ink-500 max-w-2xl">
          We make money when sellers make sales. That keeps everyone honest.
        </p>
      </section>

      {/* Boda riders */}
      <section id="riders" className="px-5 sm:px-8 py-20 max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-8 items-center">
          <div>
            <div className="text-xs uppercase tracking-wider text-coral-600 font-semibold">
              For boda riders
            </div>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
              Steady work. Fair pay. Every trip guaranteed plus 350/= off every trip.
            </h2>
            <p className="mt-4 text-ink-700 leading-relaxed">
              Tukole partners with vetted boda riders to handle deliveries for
              real businesses. Every trip is paid even if the customer rejects
              the item. We auto-calculate your fee by distance — no haggling.
            </p>
            <Link href="/rider/signup" className="btn-coral mt-6 inline-flex">
              Join as a rider
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="card p-6 space-y-4">
            <RiderPoint icon={ShieldCheck} title="Trip is paid before you arrive">
              Funds are guaranteed before you pick up the package. You're never the one carrying the loss.
            </RiderPoint>
            <RiderPoint icon={Smartphone} title="One simple app">
              Battery level, jobs, earnings — all in one place. No paperwork.
            </RiderPoint>
            <RiderPoint icon={MapPin} title="Customers know where to meet you">
              They drop a pin on the map. You ride to the bullseye. No "behind the mango tree."
            </RiderPoint>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 sm:px-8 pb-24 max-w-6xl mx-auto">
        <div className="card-teal p-10 sm:p-14 text-center">
          <h2 className="font-display text-3xl sm:text-4xl leading-tight">
            Ready to take control of your deliveries?
          </h2>
          <p className="mt-3 max-w-2xl mx-auto opacity-95">
            Sign up in two minutes. UGX 10,000 free credit on your first day.
          </p>
          <Link href="/seller/signup" className="btn-coral mt-6 inline-flex text-base px-6">
            Start selling on Tukole
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sand-200 px-5 sm:px-8 py-8 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span>Built in Kampala for Kampala.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/explore" className="hover:text-teal-700">
              Explore sellers
            </Link>
            <Link href="/seller/signup" className="hover:text-teal-700">
              Start selling
            </Link>
            <Link href="/rider/signup" className="hover:text-teal-700">
              Become a rider
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function BenefitCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Users;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6 sm:p-7">
      <div className="w-10 h-10 rounded-card bg-teal-100 text-teal-700 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="mt-4 font-display text-xl text-ink-900">{title}</h3>
      <p className="mt-2 text-sm text-ink-700 leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-6 sm:p-7">
      <div className="text-xs font-mono text-coral-600 font-semibold">{n}</div>
      <h3 className="mt-3 font-display text-xl text-ink-900">{title}</h3>
      <p className="mt-2 text-sm text-ink-700 leading-relaxed">{body}</p>
    </div>
  );
}

function Feature({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
          accent ? "bg-sand-50" : "bg-teal-600"
        }`}
      />
      <span>{children}</span>
    </li>
  );
}

function RiderPoint({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-card bg-coral-100 text-coral-600 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="font-display text-base text-ink-900">{title}</div>
        <div className="text-sm text-ink-700 mt-0.5 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
