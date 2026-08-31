// Service worker for the ultranet PWA (tablet / Android head-unit install).
//
// Strategy:
// - Only GET requests are ever touched (Server Actions are POST — left alone).
// - Navigations and data (RSC/API) requests: network-first, so every deploy
//   is picked up immediately whenever there's a connection; cache is only a
//   fallback for offline/flaky connectivity.
// - Hashed static assets (/_next/static/...): cache-first, they're immutable
//   per build.
// - CACHE_NAME is bumped on every deploy indirectly via skipWaiting/claim +
//   the activate handler purging any cache not in KEEP list, so stale
//   responses never linger across versions.
const CACHE_NAME = "ultranet-shell-v2";
const KEEP = [CACHE_NAME];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (request.mode === "navigate" && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
