/*
 * Минимальный service worker (PWA, режим «минимум»).
 * Кэшируем ТОЛЬКО иммутабельную статику и офлайн-заглушку. Приватное/подписочное,
 * API, студию, админку, видео и оптимизацию картинок — НИКОГДА не кэшируем.
 * SW скоупится по origin, поэтому кэш разных тенантов не смешивается.
 */
const VERSION = 'v3';
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

  const bypass = ['/api', '/studio', '/admin', '/account', '/video', '/_next/image', '/manifest.webmanifest', '/pwa-icon'];
  if (bypass.some((pfx) => url.pathname === pfx || url.pathname.startsWith(pfx + '/'))) {
    return;
  }

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

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(req));
  }
});

/*
 * Навигации. fetch() НЕ реджектится на 5xx (502/503 — валидные ответы), поэтому
 * осечку апстрима ловим И по throw (нет сети), И по res.status >= 500.
 * Короткий блип апстрима (подмена/рестарт контейнера) проглатываем ретраями.
 * Если апстрим отдаёт 5xx дольше — НЕ врём «нет соединения» (ты онлайн!), а
 * показываем самовосстанавливающийся экран: он опрашивает /api/health и сам
 * перезагрузит страницу, когда сервер вернётся. Настоящий офлайн (fetch throw
 * на всех попытках) — офлайн-заглушка.
 */
async function handleNavigate(req) {
  const delays = [0, 500, 1200];
  let sawServerError = false;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const res = await fetch(req);
      if (res.status < 500) return res; // 2xx/3xx или честный 4xx — как есть
      sawServerError = true; // 5xx — транзиентная осечка, ретраим
    } catch {
      /* сетевой сбой — ретраим */
    }
  }
  if (sawServerError) return reconnecting();
  const offline = await caches.match(OFFLINE_URL);
  return offline || reconnecting();
}

function reconnecting() {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Переподключаемся…</title><style>
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;background:#0F0A1E;color:#EDE9FE;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
.box{max-width:360px;text-align:center;padding:24px}
.sp{width:34px;height:34px;margin:0 auto 18px;border:3px solid rgba(255,255,255,.15);border-top-color:#7C3AED;border-radius:50%;animation:s 1s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}
h1{font-size:18px;margin:0 0 8px;font-weight:700}
p{margin:0 0 18px;color:#B5A9D6;font-size:14px;line-height:1.5}
button{background:#7C3AED;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-size:14px;cursor:pointer}
</style></head><body><div class="box">
<div class="sp"></div>
<h1>Переподключаемся к серверу</h1>
<p>Секундочку — восстанавливаем соединение. Страница обновится сама, как только сервер ответит.</p>
<button onclick="location.reload()">Обновить сейчас</button>
</div><script>
function ping(){fetch('/api/health?cb='+Math.random(),{cache:'no-store'}).then(function(r){if(r.ok){location.reload();}else{setTimeout(ping,2000);}}).catch(function(){setTimeout(ping,2000);});}
setTimeout(ping,1500);
</script></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
