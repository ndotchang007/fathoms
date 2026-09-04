/* Fathoms service worker — enables install; never rewrites the public website */
const CACHE = 'fathoms-shell-v7';
const PRECACHE = [
  '/',
  '/app',
  '/about',
  '/init',
  '/login',
  '/practice',
  '/stats',
  '/profile',
  '/settings',
  '/manifest.webmanifest',
  '/css/base.css',
  '/css/variables.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/css/landing.css',
  '/css/landing-depth.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/nav.js',
  '/js/landing.js',
  '/js/pwa.js',
  '/js/pwa-install.js',
  '/assets/favicon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/base-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // HTML: network-first. Browser users always get the real page they asked for.
  // Homescreen-only signup routing is handled in the page (display-mode: standalone),
  // never by rewriting responses here.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match('/') || caches.match('/init'))
        )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
