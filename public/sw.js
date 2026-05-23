// Minimal service worker for uRent PWA.
// Strategy: network-first for everything, fallback to cache only for the app
// shell when offline. We deliberately avoid aggressive precaching since the
// app is server-rendered and the data must stay fresh.

const CACHE = 'urent-shell-v1';
const SHELL = ['/'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Never intercept API/server-actions — must always go to network.
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/_next/data')) {
    return;
  }
  e.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then((r) => r ?? caches.match('/')) ?? Response.error()
    )
  );
});
