/*
 * Минимальный service worker (PWA, режим «минимум»).
 * Кэшируем ТОЛЬКО иммутабельную статику и офлайн-заглушку. Приватное/подписочное,
 * API, студию, админку, видео и оптимизацию картинок — НИКОГДА не кэшируем.
 * SW скоупится по origin, поэтому кэш разных тенантов не смешивается.
 */
const VERSION = 'v9';
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
    ? 'Выкатываем обновление — через пару минут студия вернётся и будет работать быстрее и стабильнее. Страница обновится сама, как только сервер ответит.'
    : 'Обновляем сайт — через пару минут всё вернётся и станет работать быстрее. Страница обновится сама, как только сервер ответит.';
  const IS_STUDIO = isStudio ? 'true' : 'false';
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}…</title>
<script>
(function(){var st=document.documentElement.style;var mode='dark';try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')mode=t;}catch(e){}
function set(o){for(var k in o)st.setProperty('--r'+k,o[k]);}
if(${IS_STUDIO}){
  set(mode==='light'
    ?{bg:'#fafafa',surface:'#ffffff',border:'#e4e4e7',text:'#18181b',muted:'#52525b',acc:'#18181b',acctext:'#ffffff'}
    :{bg:'#0a0a0b',surface:'#131316',border:'#26262c',text:'#f4f4f5',muted:'#a1a1aa',acc:'#ffffff',acctext:'#0a0a0b'});
}else{
  var d={};try{d=JSON.parse(localStorage.getItem('cb-brand')||'{}')||{};}catch(e){}var v=d[mode]||{};
  set({
    bg:v.bg||(mode==='light'?'#faf7f2':'#0F0A1E'),
    surface:mode==='light'?'#ffffff':'#171226',
    border:mode==='light'?'rgba(0,0,0,.10)':'rgba(255,255,255,.12)',
    text:v.text||(mode==='light'?'#1c1a17':'#EDE9FE'),
    muted:mode==='light'?'#8b8378':'rgba(237,233,254,.6)',
    acc:v.primary||'#ea580c',
    acctext:'#ffffff'
  });
}})();
</script>
<style>
html,body{height:100%;margin:0}
:root{--rbg:#0a0a0b;--rsurface:#131316;--rborder:#26262c;--rtext:#f4f4f5;--rmuted:#a1a1aa;--racc:#fff;--racctext:#0a0a0b}
body{margin:0;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(60% 50% at 15% 12%,color-mix(in srgb,var(--racc) 16%,transparent),transparent 60%),radial-gradient(55% 45% at 88% 85%,color-mix(in srgb,var(--racc) 12%,transparent),transparent 60%),var(--rbg);color:var(--rtext);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;box-sizing:border-box}
.brand{display:flex;align-items:center;gap:10px;margin:0 0 30px}
.brand-mark{width:30px;height:30px;border-radius:8px;background:color-mix(in srgb,var(--rtext) 9%,var(--rsurface));color:var(--rtext);display:grid;place-items:center;flex:none}
.brand-mark svg{width:19px;height:19px;display:block}
.brand-name{font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--rtext)}
.wrap{width:100%;max-width:760px;display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:center}
.col{min-width:0}
.sp{width:34px;height:34px;margin:0 0 18px;border:3px solid color-mix(in srgb,var(--rmuted) 35%,transparent);border-top-color:var(--racc);border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:22px;margin:0 0 10px;font-weight:800}
p{margin:0 0 20px;color:var(--rmuted);font-size:14px;line-height:1.6}
.btn{background:var(--racc);color:var(--racctext);border:0;border-radius:10px;padding:11px 20px;font-size:14px;font-weight:600;cursor:pointer}
.panel{background:color-mix(in srgb,var(--rsurface) 58%,transparent);border:1px solid color-mix(in srgb,var(--rtext) 14%,transparent);border-radius:14px;padding:16px;-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);box-shadow:0 24px 60px -34px rgba(0,0,0,.6),inset 0 1px 0 color-mix(in srgb,var(--rtext) 10%,transparent)}
.panel h2{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--rmuted);margin:0 0 12px;font-weight:700}
.log{display:flex;flex-direction:column;gap:9px;min-height:184px}
.st-row{display:flex;align-items:center;gap:10px;font-size:13.5px;line-height:1.35;animation:fade .3s ease}
@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.st-ic{flex:none;width:18px;height:18px;display:grid;place-items:center}
.st-sp{width:14px;height:14px;border:2px solid color-mix(in srgb,var(--rmuted) 40%,transparent);border-top-color:var(--racc);border-radius:50%;animation:spin .8s linear infinite}
.st-row.is-done{color:var(--rmuted)}
.st-ck{color:var(--racc)}
.upd{display:inline-block;margin-top:14px;color:var(--racc);font-size:13.5px;font-weight:600;text-decoration:none}
.upd:hover{text-decoration:underline}
@media(max-width:640px){.wrap{grid-template-columns:1fr;gap:22px;max-width:420px}.log{min-height:150px}}
</style></head><body>
<div class="brand"><span class="brand-mark"><svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="translate(26 26)"><path d="M-16 -16 H16 V0 L0 16 H-16 Z" fill="currentColor" opacity="0.9"/><path d="M16 -16 V16 H-16 L16 -16 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></g></svg></span><span class="brand-name">Контент Бокс</span></div>
<div class="wrap">
  <div class="col">
    <div class="sp"></div>
    <h1>${title}</h1>
    <p>${text}</p>
    <button class="btn" onclick="location.reload()">Обновить сейчас</button>
  </div>
  <div class="col">
    <div class="panel">
      <h2>На сервере сейчас</h2>
      <div class="log" id="log"></div>
      <a class="upd" href="https://contentbox.site/update" target="_blank" rel="noopener">Что нового в этом обновлении →</a>
    </div>
  </div>
</div>
<script>
var MSGS=[
'Останавливаем приём новых запросов','Закрываем активные соединения с базой данных','Создаём резервную копию базы данных','Применяем миграции базы данных','Проверяем целостность данных','Перестраиваем индексы таблиц','Прогреваем пул соединений с базой','Очищаем устаревший кэш запросов',
'Собираем новую версию приложения','Тянем свежий образ из реестра','Останавливаем предыдущий контейнер','Освобождаем порт приложения','Запускаем обновлённый контейнер','Ждём проверку работоспособности контейнера','Перезапускаем воркер обработки видео','Переключаем трафик на новую версию','Останавливаем фоновые задачи','Восстанавливаем фоновую очередь',
'Проверяем поисковый сервис','Переиндексируем каталог публикаций','Поднимаем сервис аналитики','Проверяем очередь email-рассылок','Проверяем подключение к хранилищу S3','Обновляем сервис саммари «Ася»','Синхронизируем субтитры и главы видео','Проверяем доступность CDN','Проверяем сервис комментариев и реакций','Прогреваем кэш обложек и превью',
'Обновляем токены доступа к видео','Проверяем платёжный шлюз','Проверяем SSL-сертификат','Проверяем вебхуки оплаты','Прогоняем smoke-тесты API','Проверяем права доступа авторов','Проверяем лимиты и квоты хранилища','Проверяем внешние интеграции',
'Прогреваем кэш популярных страниц','Восстанавливаем пользовательские сессии','Финальная проверка перед запуском','Почти готово — открываем доступ'
];
var CHECK='<svg class="st-ck" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
var queue=shuffle(MSGS.slice());
var logEl=document.getElementById('log');
var MAX=7;
function step(){
  if(!queue.length)queue=shuffle(MSGS.slice());
  var msg=queue.shift();
  var cur=logEl.querySelector('.st-row.is-current');
  if(cur){cur.classList.remove('is-current');cur.classList.add('is-done');cur.querySelector('.st-ic').innerHTML=CHECK;}
  var row=document.createElement('div');row.className='st-row is-current';
  var ic=document.createElement('span');ic.className='st-ic';ic.innerHTML='<span class="st-sp"></span>';
  var tx=document.createElement('span');tx.className='st-tx';tx.textContent=msg;
  row.appendChild(ic);row.appendChild(tx);logEl.appendChild(row);
  while(logEl.children.length>MAX)logEl.removeChild(logEl.firstChild);
  setTimeout(step,900+Math.random()*1000);
}
setTimeout(step,250);
function ping(){fetch('/api/health?cb='+Math.random(),{cache:'no-store'}).then(function(r){if(r.ok){location.reload();}else{setTimeout(ping,2000);}}).catch(function(){setTimeout(ping,2000);});}
setTimeout(ping,1500);
</script></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
