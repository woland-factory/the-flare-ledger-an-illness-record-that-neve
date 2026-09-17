// Hand-written service worker. It caches the app shell so a navigation survives
// offline and the app meets browser install criteria. It runs no timer and
// touches only the cache and fetch APIs. The shell only: creating or editing a
// flare still needs the network.

const CACHE = "flare-shell-v1";
const SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Navigations: network first, fall back to the cached offline shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  // Same-origin static shell assets: serve cache-first.
  const url = new URL(request.url);
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
  }
});
