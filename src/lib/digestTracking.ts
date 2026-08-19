/**
 * Собственный трекинг дайджеста (без Listmonk). При рассылке в каждое письмо
 * вшиваем:
 *  - пиксель `/api/n/o/:issueId` (открытие → +1 к opens);
 *  - все http(s)-ссылки на домен тенанта оборачиваем в `/api/n/c/:issueId?u=…`
 *    (клик → +1 к clicks и 302 на исходный адрес).
 * Ссылку «Отписаться» НЕ трекаем и не оборачиваем — чтобы не мешать отписке и
 * не накручивать клики. Чужие домены не трогаем.
 */

// Прозрачный gif 1×1 (base64). Отдаётся пикселем-трекером.
export const TRACKING_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

/** Хост из URL в нижнем регистре; '' если распарсить нельзя. */
export function safeHost(u: string): string {
  try {
    return new URL(u).host.toLowerCase()
  } catch {
    return ''
  }
}

/** true, если оба URL валидны и на одном хосте. */
export function sameHost(a: string, b: string): boolean {
  const ha = safeHost(a)
  return ha !== '' && ha === safeHost(b)
}

/** HTML-тег пикселя открытия. */
export function trackingPixel(siteUrl: string, issueId: number | string): string {
  return `<img src="${siteUrl}/api/n/o/${issueId}" width="1" height="1" alt="" style="display:none" />`
}

/**
 * Инструментируем тело письма: оборачиваем «свои» ссылки в кликовый редирект и
 * добавляем пиксель открытия перед </body> (или в конец, если тега нет).
 */
export function instrumentDigestHtml(
  html: string,
  opts: { siteUrl: string; issueId: number | string },
): string {
  const { siteUrl, issueId } = opts
  const host = safeHost(siteUrl)
  const withLinks = html.replace(/href="([^"]+)"/g, (m, rawUrl: string) => {
    if (!/^https?:\/\//i.test(rawUrl)) return m
    if (/\/unsubscribe/i.test(rawUrl)) return m
    if (host && safeHost(rawUrl) !== host) return m
    return `href="${siteUrl}/api/n/c/${issueId}?u=${encodeURIComponent(rawUrl)}"`
  })
  const pixel = trackingPixel(siteUrl, issueId)
  return withLinks.includes('</body>')
    ? withLinks.replace('</body>', `${pixel}</body>`)
    : withLinks + pixel
}
