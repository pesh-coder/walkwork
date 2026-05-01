"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LucideIcon } from "lucide-react";
import { Logo } from "./Logo";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}

interface SidebarProps {
  items: SidebarItem[];
  /** Footer area: usually a profile card */
  footer?: React.ReactNode;
  /** Greeting/subtitle under the logo */
  subtitle?: string;
}

/**
 * Responsive sidebar:
 *   Desktop (lg+): vertical sidebar on the left
 *   Mobile (< lg): horizontal scrollable bar fixed at the bottom
 */
export function Sidebar({ items, footer, subtitle }: SidebarProps) {
  const pathname = usePathname() || "";

  const isActive = (item: SidebarItem) =>
    item.match ? item.match(pathname) : pathname.startsWith(item.href);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar hidden lg:flex">
        <div className="px-6 py-6">
          <Link href="/" className="block">
            <Logo size="md" variant="teal" />
          </Link>
          {subtitle && (
            <div className="mt-2 text-xs text-ink-500">{subtitle}</div>
          )}
        </div>

        <nav className="flex-1 py-2 space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "sidebar-link",
                  active && "sidebar-link-active"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {footer && (
          <div className="px-3 pb-6 pt-4 border-t border-sand-200 mt-2">
            {footer}
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-sand-200 bg-sand-50 sticky top-0 z-30">
        <Link href="/">
          <Logo size="sm" variant="teal" />
        </Link>
        {subtitle && (
          <span className="text-xs text-ink-500 truncate ml-2">
            {subtitle}
          </span>
        )}
      </header>

      {/* Mobile bottom nav (with safe-area inset padding) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-sand-50 border-t border-sand-200 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch overflow-x-auto scrollbar-thin">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex-1 min-w-[80px] flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium",
                  active ? "text-coral-600" : "text-ink-500"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
