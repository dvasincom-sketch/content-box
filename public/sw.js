/*
 * Минимальный service worker (PWA, режим «минимум»).
 * Кэшируем ТОЛЬКО иммутабельную статику и офлайн-заглушку. Приватное/подписочное,
 * API, студию, админку, видео и оптимизацию картинок — НИКОГДА не кэшируем.
 * SW скоупится по origin, поэтому кэш разных тенантов не смешивается.
 */
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Приватное/динамическое — всегда сеть, никакого кэша.
  const bypass = ['/api', '/studio', '/admin', '/account', '/video', '/_next/image', '/manifest.webmanifest', '/pwa-icon'];
  if (bypass.some((pfx) => url.pathname === pfx || url.pathname.startsWith(pfx + '/'))) {
    return;
  }

  // Иммутабельная статика — cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (e) {
          return hit || Response.error();
        }
      }),
    );
    return;
  }

  // Навигации (HTML) — network-first с офлайн-заглушкой.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || new Response('Офлайн', { status: 503 })),
      ),
    );
  }
});
