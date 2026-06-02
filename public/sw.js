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

// ── Web-Push: daily nudge (fällige Zusagen / wartende Kunden) ──
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'Ctrl+K';
  const body = data.body || '';
  const url = data.url || '/plan';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: 'ctrlk-nudge', // collapse same-day nudges into one
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  // Only ever navigate to in-app relative paths (defense-in-depth: never let a
  // payload url open an external/absolute destination).
  const raw = e.notification.data && e.notification.data.url;
  const target = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/plan';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(target).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
