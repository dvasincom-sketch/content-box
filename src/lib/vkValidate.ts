/**
 * Проверка доступности внешнего (embed) видео — VK и др. Платформенный риск:
 * автор вставил битую ссылку или видео удалили на стороне VK, и на публичной
 * странице висит «Видеофайл не найден». Валидатор фетчит embed-src и ищет
 * маркеры недоступности.
 *
 * ВАЖНО: помечаем 'unavailable' только при ЯВНЫХ признаках (404/410/403 или
 * текст-маркер). При любой неопределённости (таймаут, 5xx, сеть) — 'unknown',
 * чтобы не пугать автора ложным флагом.
 */
export type EmbedStatus = 'ok' | 'unavailable' | 'unknown'

const DEAD =
  /Видеозапись\s+(удалена|недоступна|была удалена|заблокирована)|Видеофайл не найден|Видео\s+(удалено|недоступно)|Запись недоступна|This video is (unavailable|no longer available|private)|Video (not found|unavailable|deleted|is unavailable)|content is not available|players?\/error/i

export async function checkEmbedAvailability(embedSrc: string): Promise<EmbedStatus> {
  const src = (embedSrc || '').trim()
  if (!src) return 'unknown'
  try {
    const res = await fetch(src, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; ContentBoxBot/1.0; +https://contentbox.site)',
        'accept-language': 'ru,en;q=0.8',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (res.status === 404 || res.status === 410 || res.status === 403) return 'unavailable'
    if (!res.ok) return 'unknown'
    const html = (await res.text()).slice(0, 200_000)
    if (DEAD.test(html)) return 'unavailable'
    return 'ok'
  } catch {
    return 'unknown'
  }
}
