/*
 * Минимальный service worker (PWA, режим «минимум»).
 * Кэшируем ТОЛЬКО иммутабельную статику и офлайн-заглушку. Приватное/подписочное,
 * API, студию, админку, видео и оптимизацию картинок — НИКОГДА не кэшируем.
 * SW скоупится по origin, поэтому кэш разных тенантов не смешивается.
 */
const VERSION = 'v5';
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

  // Навигации ЛЮБОЙ страницы (в т.ч. /studio, /admin, /account, /video):
  // во время деплоя апстрим отдаёт 5xx/недоступен — вместо белого экрана
  // показываем самовосстанавливающийся экран «идёт обновление». Обрабатываем
  // ДО bypass, иначе студия/админка белеют при рестарте контейнера.
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(req));
    return;
  }

  // Не-навигационные запросы к приватным/динамическим префиксам не трогаем
  // (никогда не кэшируем API/студию/админку/аккаунт/видео/оптимизацию картинок).
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
  let isStudio = false;
  try { const p = new URL(req.url).pathname; isStudio = p.startsWith('/studio') || p.startsWith('/admin'); } catch (e) {}
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
  if (sawServerError) return reconnecting(isStudio);
  const offline = await caches.match(OFFLINE_URL);
  return offline || reconnecting(isStudio);
}

function reconnecting(isStudio) {
  const title = 'Идёт обновление';
  const text = isStudio
    ? 'Выкатываем обновление — через пару минут студия вернётся и будет работать быстрее и стабильнее. И появились новые функции. Страница обновится сама, как только сервер ответит.'
    : 'Обновляем сайт — через пару минут всё вернётся и станет работать быстрее. Страница обновится сама, как только сервер ответит.';
  const updateLink = isStudio
    ? '<a class="upd" href="https://contentbox.site/update" target="_blank" rel="noopener">Что нового в этом обновлении →</a>'
    : '';
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}…</title>
<script>
(function(){try{var m=localStorage.getItem('theme');if(m!=='light'&&m!=='dark')m='dark';var d={};try{d=JSON.parse(localStorage.getItem('cb-brand')||'{}')||{};}catch(e){}var v=d[m]||{};var st=document.documentElement.style;if(v.bg)st.setProperty('--rbg',v.bg);if(v.text)st.setProperty('--rtext',v.text);if(v.primary)st.setProperty('--racc',v.primary);}catch(e){}})();
</script>
<style>
html,body{height:100%;margin:0}
:root{--rbg:#0F0A1E;--rtext:#EDE9FE;--racc:#7C3AED}
body{display:flex;align-items:center;justify-content:center;background:var(--rbg);color:var(--rtext);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
.box{max-width:380px;text-align:center;padding:24px}
.sp{width:34px;height:34px;margin:0 auto 18px;border:3px solid rgba(128,128,128,.28);border-top-color:var(--racc);border-radius:50%;animation:s 1s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}
h1{font-size:19px;margin:0 0 8px;font-weight:700}
p{margin:0 0 16px;color:var(--rtext);opacity:.7;font-size:14px;line-height:1.55}
.upd{display:inline-block;margin:0 0 18px;color:var(--racc);font-size:14px;font-weight:600;text-decoration:none}
.upd:hover{text-decoration:underline}
button{background:var(--racc);color:#fff;border:0;border-radius:10px;padding:10px 18px;font-size:14px;cursor:pointer}
</style></head><body><div class="box">
<div class="sp"></div>
<h1>${title}</h1>
<p>${text}</p>
${updateLink}
<div><button onclick="location.reload()">Обновить сейчас</button></div>
</div><script>
function ping(){fetch('/api/health?cb='+Math.random(),{cache:'no-store'}).then(function(r){if(r.ok){location.reload();}else{setTimeout(ping,2000);}}).catch(function(){setTimeout(ping,2000);});}
setTimeout(ping,1500);
</script></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
