const APP_VERSION = 'v1.0.3';
const CACHE_NAME = `app-cache-${APP_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
    console.log(`[SW] Fetching: ${event.request.url}`);
    if (event.request.url.includes('/api/')) {
        console.log('[SW] Skipping API request');
        return fetch(event.request);
    }
  // Excluir solicitudes a la API y WebSockets
  if (event.request.url.includes('/api/') || 
      event.request.url.startsWith('ws:') || 
      event.request.url.startsWith('wss:')) {
    return fetch(event.request);
  }

  // Excluir solicitudes que no son HTTP (como extensiones)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .then(fetchResponse => {
            // Solo cacheamos respuestas exitosas para recursos estáticos
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }

            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));

            return fetchResponse;
          });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});