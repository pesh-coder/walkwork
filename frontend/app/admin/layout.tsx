"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Inbox } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/Logo";

const TABS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Fleet management", href: "/admin/fleet", icon: Users },
  { label: "Outbox", href: "/admin/outbox", icon: Inbox },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  return (
    <main className="min-h-screen bg-sand-50">
      <header className="bg-teal-700 text-sand-50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <Logo size="md" variant="light" />
              <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded-chip bg-coral-500 font-medium tracking-wider uppercase">
                Operator
              </span>
            </div>
          </div>

          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={clsx(
                    "px-4 py-2.5 inline-flex items-center gap-2 text-sm font-medium rounded-t-card border-b-2 transition-colors",
                    active
                      ? "bg-sand-50 text-teal-700 border-sand-50"
                      : "text-sand-50/80 border-transparent hover:text-sand-50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {children}
    </main>
  );
}
