// Bump this whenever the caching strategy or the precache list changes: the
// activate handler deletes every cache whose name differs from this one.
const CACHE_NAME = 'warhuttv-v3';
const MAX_CACHE_ENTRIES = 120;

// Only files that are guaranteed to exist in dist/. The old list included
// `/manifest.json`, which is generated at runtime as a Blob URL — cache.addAll
// rejects the whole install if a single URL 404s, so the service worker never
// finished installing and offline mode silently never worked.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
];

const CACHEABLE_EXTENSIONS = [
  '.js', '.css', '.html', '.json',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.otf',
];

function isCacheable(url) {
  if (!url.startsWith('http')) return false;

  const pathname = new URL(url).pathname;

  // Never cache API responses: they are user-specific and must stay fresh.
  if (pathname === '/api' || pathname.startsWith('/api/')) return false;

  // HLS segments and playlists are streamed through the player, not the SW.
  if (pathname.endsWith('.ts') || pathname.endsWith('.m3u8')) return false;

  return CACHEABLE_EXTENSIONS.some((ext) => pathname.endsWith(ext)) || pathname === '/';
}

// Bound the cache by entry count. The previous version summed `content-length`
// (usually absent) and ordered by `Date.now()` captured in the same loop tick,
// so it never evicted anything.
async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHE_ENTRIES) return;
  // keys() returns requests in insertion order, so the oldest entries are first.
  const excess = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
  await Promise.all(excess.map((request) => cache.delete(request)));
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  // Add one by one and tolerate individual failures: a single 404 must not
  // abort the whole install (that was the old addAll behaviour).
  await Promise.all(
    STATIC_ASSETS.map(async (asset) => {
      try {
        await cache.add(new Request(asset, { cache: 'reload' }));
      } catch (error) {
        console.warn('[sw] failed to precache', asset, error);
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Network-first for navigations (always try to pick up a new deployment), with
// the cached shell as the offline fallback.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!isCacheable(event.request.url)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        const responseClone = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, responseClone))
          .then(() => trimCache(CACHE_NAME))
          .catch(() => {});

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Fall back to the app shell so a hard navigation while offline still
        // renders the SPA instead of the browser's error page. The old code
        // returned `caches.match(...)` directly, which could resolve to
        // undefined and make respondWith throw.
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return new Response('离线且无缓存', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});
