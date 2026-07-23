const APP_CACHE = 'adventures-app-v2';
const RUNTIME_CACHE = 'adventures-runtime-v2';
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
    './assets/game/atlases/characters/emma/emma_atlas.png',
    './assets/game/atlases/characters/emma/emma_atlas.json',
    './assets/game/atlases/characters/orel/orel_atlas.png',
    './assets/game/atlases/characters/orel/orel_atlas.json',
    './assets/game/atlases/characters/israel/israel_atlas.png',
    './assets/game/atlases/characters/israel/israel_atlas.json',
    './assets/game/atlases/gameplay/gameplay_assets_atlas.png',
    './assets/game/atlases/gameplay/gameplay_assets_atlas.json',
    './assets/game/atlases/environment/environment_atlas.png',
    './assets/game/atlases/environment/environment_atlas.json',
    './assets/game/manifests/atlas_manifest.json',
    './assets/game/manifests/animations_manifest.json',
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

/**
 * Cache only same-origin successful ("basic") responses.
 * Ignore opaque/cors responses so third-party resources never get pinned in runtime cache.
 */
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
    // Do not cache cross-origin traffic to avoid stale third-party content and opaque response pitfalls.
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
        if (cachedResponse) {
            if (requestUrl.pathname.includes('/assets/game/')) {
                event.waitUntil(fetchAndCache(request, RUNTIME_CACHE).catch(() => undefined));
            }
            return cachedResponse;
        }

        try {
            return await fetchAndCache(request, RUNTIME_CACHE);
        } catch {
            return Response.error();
        }
    })());
});
