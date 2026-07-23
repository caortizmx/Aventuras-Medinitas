const APP_CACHE = 'adventures-app-v1';
const RUNTIME_CACHE = 'adventures-runtime-v1';
const OFFLINE_FALLBACK_URL = './offline.html';

const PRECACHE_URLS = [
    './',
    './index.html',
    './style.css',
    './manifest.webmanifest',
    './offline.html',
    './favicon.png',
    './apple-touch-icon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-512-maskable.png',
    './assets/bg.png',
    './assets/logo.png',
    './assets/maps/level-one.json',
    './assets/tiles/level-one-tiles.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(APP_CACHE);
        await cache.addAll(PRECACHE_URLS);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key !== APP_CACHE && key !== RUNTIME_CACHE)
                .map((key) => caches.delete(key)),
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Keep cache writes same-origin and successful to avoid storing opaque/cross-origin failures.
const isCacheableResponse = (response) => response.ok && response.type === 'basic';

const fetchAndCache = async (request, cacheName) => {
    const response = await fetch(request);

    if (isCacheableResponse(response)) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
    }

    return response;
};

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                return await fetchAndCache(request, RUNTIME_CACHE);
            } catch {
                const cache = await caches.open(APP_CACHE);
                return (await cache.match('./index.html'))
                    ?? (await cache.match(OFFLINE_FALLBACK_URL))
                    ?? Response.error();
            }
        })());
        return;
    }

    const isStaticAssetRequest = request.destination === 'script'
        || request.destination === 'style'
        || request.destination === 'image'
        || request.destination === 'font'
        || request.destination === 'audio'
        || request.destination === 'worker'
        || requestUrl.pathname.includes('/assets/');

    if (!isStaticAssetRequest) return;

    event.respondWith((async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        try {
            return await fetchAndCache(request, RUNTIME_CACHE);
        } catch {
            return Response.error();
        }
    })());
});
