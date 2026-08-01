/*
 * Минимальный service worker (PWA, режим «минимум»).
 * Кэшируем ТОЛЬКО иммутабельную статику и офлайн-заглушку. Приватное/подписочное,
 * API, студию, админку, видео и оптимизацию картинок — НИКОГДА не кэшируем.
 * SW скоупится по origin, поэтому кэш разных тенантов не смешивается.
 */
const VERSION = 'v2';
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
        } catch {
          return hit || Response.error();
        }
      }),
    );
    return;
  }

  // Навигации (HTML) — network-first с ретраями и мягкой офлайн-заглушкой.
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(req));
  }
});

/*
 * ВАЖНО: fetch() НЕ реджектится на 5xx — 502/503 это валидные HTTP-ответы,
 * промис резолвится. Поэтому осечку апстрима ловим И по throw (сетевой сбой),
 * И по res.status >= 500. Один транзиентный 502 от прокси (короткое окно
 * недоступности апстрима при рестарте/подмене контейнера) НЕ должен становиться
 * жёсткой страницей «HTTP ERROR 502»: делаем несколько коротких ретраев —
 * блип обычно проглатывается и пользователь просто видит чуть более долгую
 * загрузку, — и лишь если всё глухо, отдаём офлайн-заглушку.
 */
async function handleNavigate(req) {
  const delays = [0, 500, 1200]; // до 3 попыток, ~1.7с суммарной задержки только при осечке
  let lastResp = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const res = await fetch(req);
      if (res.status < 500) return res; // 2xx/3xx или честный 4xx (404 и т.п.) — отдаём как есть
      lastResp = res; // 5xx — транзиентная осечка, пробуем ещё раз
    } catch {
      lastResp = null; // сетевой сбой — тоже ретрай
    }
  }
  // Все попытки — 5xx/сеть: мягкая офлайн-заглушка вместо «HTTP ERROR 502».
  const offline = await caches.match(OFFLINE_URL);
  return (
    offline ||
    lastResp ||
    new Response('Сервис временно недоступен. Обновите страницу.', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  );
}
