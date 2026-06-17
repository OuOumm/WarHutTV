const CACHE_NAME = 'warhuttv-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
];

// 需要缓存的静态资源扩展名
const CACHEABLE_EXTENSIONS = [
  '.js', '.css', '.html', '.json',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
];

function isCacheable(url) {
  // 只缓存 http/https 请求
  if (!url.startsWith('http')) return false;
  
  const pathname = new URL(url).pathname;
  
  // 不缓存 API 请求
  if (pathname.includes('/api/')) return false;
  
  // 不缓存视频片段
  if (pathname.endsWith('.ts') || pathname.endsWith('.m3u8')) return false;
  
  // 只缓存静态资源
  return CACHEABLE_EXTENSIONS.some(ext => pathname.endsWith(ext)) || pathname === '/';
}

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!isCacheable(event.request.url)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
