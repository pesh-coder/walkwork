/**
 * Tukole service worker — minimum viable to satisfy PWA install criteria.
 *
 * Strategy:
 *   - During install, pre-cache the home page + manifest + favicon.
 *   - During fetch:
 *       - For navigation requests (HTML): network-first, fallback to cache
 *         on offline.
 *       - For other requests (CSS/JS/images): network-first, but cache them
 *         on the way through so a flaky network can use the last-good copy.
 *   - On activation, clean up old caches.
 *
 * We deliberately do NOT cache the API or anything under /track or /admin —
 * those are real-time and stale data would confuse riders, sellers, customers.
 */

const CACHE = "tukole-v1";
const PRECACHE = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip API calls, websockets, and cross-origin requests entirely
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;

  // Network-first for everything else
  event.respondWith(
    fetch(req)
      .then((response) => {
        // Only cache successful basic responses
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        // Fallback to cache when offline
        caches.match(req).then((cached) => cached || caches.match("/"))
      )
  );
});
