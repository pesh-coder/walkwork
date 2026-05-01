"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard, Plus, Package, Map as MapIcon,
  Wallet, Settings, LogOut,
} from "lucide-react";
import { Sidebar, type SidebarItem } from "@/components/Sidebar";
import { sellersApi, type Seller } from "@/lib/api";
import { ugx } from "@/lib/format";

export default function SellerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { id } = params;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await sellersApi.get(id);
        if (!cancelled) {
          setSeller(s);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    const interval = setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  const items: SidebarItem[] = [
    {
      label: "Dashboard",
      href: `/seller/${id}`,
      icon: LayoutDashboard,
      match: (p) => p === `/seller/${id}`,
    },
    { label: "New order", href: `/seller/${id}/new-order`, icon: Plus },
    { label: "Orders", href: `/seller/${id}/orders`, icon: Package },
    { label: "Live map", href: `/seller/${id}/map`, icon: MapIcon },
    { label: "Wallet", href: `/seller/${id}/wallet`, icon: Wallet },
    { label: "Settings", href: `/seller/${id}/settings`, icon: Settings },
  ];

  const sidebarFooter = seller ? (
    <div className="px-2">
      <div className="text-xs text-ink-500 mb-1">Wallet balance</div>
      <div className="font-display text-xl tabular text-teal-700">
        {ugx(seller.wallet_balance_ugx)}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-teal-600 text-sand-50 flex items-center justify-center font-medium text-sm">
          {seller.business_name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-900 truncate">
            {seller.business_name}
          </div>
          <div className="text-xs text-ink-500 truncate">{seller.owner_name}</div>
        </div>
      </div>
    </div>
  ) : null;

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <h1 className="font-display text-xl">Couldn't load dashboard</h1>
          <p className="text-ink-500 text-sm mt-1">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="shell">
      <Sidebar
        items={items}
        subtitle={seller?.business_name}
        footer={sidebarFooter}
      />
      <div className="main-content pb-24 lg:pb-0">{children}</div>
    </div>
  );
}
