// Calorie Tracker service worker: lets the app open without a connection
// (data comes from the app's own offline cache) and shows reminder
// notifications. Supabase/Gemini requests are never touched.
const CACHE = 'calorie-tracker-shell-v1';
const NAVIGATION_TIMEOUT_MS = 3000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: try the network first so a new deploy shows up right away — but
  // on a weak connection don't make the app wait on it: after a few seconds
  // the cached copy is used (the network copy still refreshes the cache).
  if (request.mode === 'navigate') {
    const network = fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('/', copy));
      }
      return res;
    });
    const cachedAfterTimeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS))
      .then(() => caches.match('/'));
    event.respondWith(
      Promise.race([network.catch(() => null), cachedAfterTimeout])
        .then((res) => res || caches.match('/'))
        .then((res) => res || network)
        .catch(() => Response.error()),
    );
    return;
  }

  // Build assets are content-hashed, so a cached copy never goes stale.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })),
    );
    return;
  }

  // Icons, manifest, etc.: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached || Response.error());
      return cached || network;
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
