const CACHE_NAME = 'warhuttv-v2'; // 版本号更新，强制清理旧缓存
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB 最大缓存

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
];

// 需要缓存的静态资源扩展名（白名单）
const CACHEABLE_EXTENSIONS = [
  '.js', '.css', '.html', '.json',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
];

function isCacheable(url) {
  // 只缓存 http/https 请求
  if (!url.startsWith('http')) return false;
  
  const pathname = new URL(url).pathname;
  
  // 排除 API 请求
  if (pathname.includes('/api/')) return false;
  
  // 排除视频相关文件（.ts 片段, .m3u8 播放列表）
  if (pathname.endsWith('.ts') || pathname.endsWith('.m3u8')) return false;
  if (pathname.includes('.ts?') || pathname.includes('.m3u8?')) return false;
  
  // 只缓存白名单中的扩展名
  return CACHEABLE_EXTENSIONS.some(ext => pathname.endsWith(ext)) || pathname === '/';
}

// 清理缓存，确保不超过最大大小
async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let totalSize = 0;
  const entries = [];
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const size = parseInt(response.headers.get('content-length') || '0');
      totalSize += size;
      entries.push({ request, size, timestamp: Date.now() });
    }
  }
  
  // 如果超过最大大小，删除最旧的条目
  if (totalSize > MAX_CACHE_SIZE) {
    entries.sort((a, b) => a.timestamp - b.timestamp);
    for (const entry of entries) {
      if (totalSize <= MAX_CACHE_SIZE) break;
      await cache.delete(entry.request);
      totalSize -= entry.size;
    }
  }
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

// Activate - clean all old caches
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
        // 检查响应是否有效
        if (!response || response.status !== 200) {
          return response;
        }
        
        // 只缓存成功的响应
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
          // 定期清理缓存
          trimCache(CACHE_NAME).catch(() => {});
        });
        
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
