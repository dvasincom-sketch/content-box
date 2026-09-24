import React from 'react'

/**
 * Яндекс.Метрика (счётчик) + верификация Яндекс.Вебмастера. Рендерится в <head>
 * только на публичных страницах нужного тенанта (см. гейт в layout). Оба тега —
 * статические строки, клиентских хуков нет → это обычный серверный компонент.
 *
 * Счётчик и мета-тег не ставятся, если не переданы counterId/verification,
 * поэтому компонент безопасно держать в layout.
 */
const metrikaSnippet = (id: number) => `(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${id}', 'ym');
ym(${id}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`

export function YandexTags({ counterId, verification }: { counterId?: number; verification?: string }) {
  return (
    <>
      {verification ? <meta name="yandex-verification" content={verification} /> : null}
      {counterId ? (
        <>
          <script type="text/javascript" dangerouslySetInnerHTML={{ __html: metrikaSnippet(counterId) }} />
          <noscript>
            <div>
              <img src={`https://mc.yandex.ru/watch/${counterId}`} style={{ position: 'absolute', left: '-9999px' }} alt="" />
            </div>
          </noscript>
        </>
      ) : null}
    </>
  )
}
