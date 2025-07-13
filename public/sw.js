const CACHE_NAME = 'app-cache-v2';
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

self.addEventListener('fetch', event => {
    // Excluir solicitudes de chrome-extension y otros protocolos
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request)
                    .then(fetchResponse => {
                        // Solo cacheamos respuestas exitosas
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