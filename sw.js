/* প্রশান্তি — Service Worker
   Caches the app shell (HTML/manifest/icons/fonts) so the app still
   opens offline. Firebase Auth/Firestore calls still need internet —
   this only keeps the interface itself loadable without a connection.
   Local health data (mood/water/cycle) already lives in localStorage,
   so it's available offline regardless of this file. */

const CACHE_NAME = 'prashanti-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept Firebase/Google API calls — those must always hit
  // the network directly (auth, Firestore reads/writes).
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('gstatic.com') && url.pathname.includes('firebasejs')) {
    return;
  }

  // App shell + same-origin assets: cache-first, fall back to network,
  // and quietly update the cache in the background when online.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
