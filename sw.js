// C1500 Rebuild Quest service worker: installable + offline.
// - The page (index.html / navigations) is network-first, so a new deploy shows on the next open.
// - Icons/manifest are cache-first. Nothing cross-origin is touched (xAI API calls go straight to the network).
const VERSION = "2026-09-27.2"; // bump on each deploy so phones pick up the new worker
const CACHE = "c1500-" + VERSION;
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./maskable-192.png",
  "./maskable-512.png", "./apple-touch-icon.png", "./favicon.ico", "./favicon-32.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  // no skipWaiting here: an update waits until the page's "Updated, tap to reload" is tapped
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("c1500-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache API calls or other sites
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  if (isPage) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: "no-cache" });
        if (res.ok) cache.put(url.pathname.endsWith("/") ? "./index.html" : req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  })());
});
