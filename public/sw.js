const CACHE_NAME = 'ironflow-v4';
const OFFLINE_URL = 'index.html';

// Only cache same-origin assets that are guaranteed CORS-safe.
// External CDN URLs must NOT be included — if any URL in this list fails
// (e.g. due to missing CORS headers), cache.addAll() rejects entirely and
// the service worker enters a broken state that intercepts and kills all
// subsequent fetches, including Google Drive API calls.
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use individual cache.put() with no-cors requests for robustness —
      // a single failed asset will not abort the entire install.
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          fetch(url).then(res => {
            if (res.ok) cache.put(url, res);
          }).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Navigation: Network First, Fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Strategy: Cache First, then Network with Dynamic Caching
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Cache valid responses for scripts, styles, and images
        const isSuccessful = networkResponse && networkResponse.status === 200;
        const isCacheable = event.request.method === 'GET' && 
                           (event.request.destination === 'script' || 
                            event.request.destination === 'style' || 
                            event.request.destination === 'image' ||
                            event.request.destination === 'font');

        if (isSuccessful && isCacheable) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkResponse;
      }).catch(() => {
        // Silently fail if network and cache both unavailable
        return new Response('', { status: 404 });
      });
    })
  );
});