"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

/**
 * Registers the service worker on mount, and listens for the
 * `beforeinstallprompt` event so we can show a friendly "Add to Home Screen"
 * button on Chrome / Edge for Android.
 *
 * This component renders the install prompt UI inline (only when the browser
 * actually allows it). On iOS Safari, install is manual ("Share → Add to
 * Home Screen") so we show a minimal hint instead.
 */
export function ServiceWorkerRegistrar() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showHint, setShowHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }

    // Capture install prompt for Chrome/Edge/Android
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari needs a hint since it doesn't fire beforeinstallprompt
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isStandalone =
      "standalone" in window.navigator && (window.navigator as any).standalone;
    if (isIOS && !isStandalone) {
      // Show hint after a small delay so it doesn't spam first-time visitors
      const t = setTimeout(() => {
        if (!localStorage.getItem("tukole_pwa_hint_dismissed")) {
          setShowHint(true);
        }
      }, 4000);
      return () => clearTimeout(t);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  }

  function dismiss() {
    setDismissed(true);
    setShowHint(false);
    try {
      localStorage.setItem("tukole_pwa_hint_dismissed", "1");
    } catch {}
  }

  if (dismissed) return null;

  // Chrome/Edge — native prompt available
  if (installPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-[100] card-elevated p-4 bg-teal-700 text-sand-50 border-teal-700 shadow-lift animate-slide_up">
        <div className="flex items-start gap-3">
          <Download className="w-5 h-5 shrink-0 mt-0.5 text-coral-300" />
          <div className="flex-1 min-w-0">
            <div className="font-display text-base">Install Tukole</div>
            <div className="text-xs opacity-90 mt-0.5">
              Add to your home screen for one-tap access.
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={install} className="btn bg-coral-500 text-sand-50 hover:bg-coral-600 text-xs">
                Install
              </button>
              <button onClick={dismiss} className="btn bg-sand-50/15 text-sand-50 hover:bg-sand-50/25 text-xs">
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // iOS hint
  if (showHint) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-[100] card-elevated p-4 bg-teal-700 text-sand-50 border-teal-700 shadow-lift animate-slide_up">
        <div className="flex items-start gap-3">
          <button onClick={dismiss} className="absolute top-2 right-2 btn-ghost p-1 text-sand-50/70 hover:text-sand-50">
            <X className="w-3.5 h-3.5" />
          </button>
          <Download className="w-5 h-5 shrink-0 mt-0.5 text-coral-300" />
          <div className="flex-1 min-w-0 pr-4">
            <div className="font-display text-base">Save Tukole to your phone</div>
            <div className="text-xs opacity-90 mt-1 leading-relaxed">
              Tap the share icon at the bottom of Safari, then choose{" "}
              <strong>"Add to Home Screen"</strong>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
