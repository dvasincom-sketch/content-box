/**
 * Проверка доступности внешнего (embed) видео — VK и др. Платформенный риск:
 * автор вставил битую ссылку или видео удалили/скрыли на стороне VK, и на
 * публичной странице висит «Видеофайл не найден».
 *
 * Как VK ведёт себя (проверено на реальном битом видео):
 *   - рабочий ПУБЛИЧНЫЙ эмбед `video_ext.php` → 200 + HTML плеера;
 *   - битый/удалённый/приватный → 302 в цепочку автологина
 *     (`login.vk…/act=autologin` → `errorCode=…&errorText=invalid+user` → петля).
 * Текста «удалено» в теле НЕТ — поэтому сигнал = сам факт редиректа эмбеда.
 *
 * Поэтому идём `redirect: 'manual'`: любой редирект эмбеда (opaqueredirect / 3xx)
 * или явный 404/410/403 → 'unavailable'. 200 → сверяем тело (на всякий случай) и
 * 'ok'. Таймаут/сеть/5xx → 'unknown' (не пугаем ложным флагом).
 */
export type EmbedStatus = 'ok' | 'unavailable' | 'unknown'

const DEAD =
  /Видеозапись\s+(удалена|недоступна|была удалена|заблокирована)|Видеофайл не найден|Видео\s+(удалено|недоступно)|Запись недоступна|invalid\s+user|errorCode=|This video is (unavailable|no longer available|private)|Video (not found|unavailable|deleted|is unavailable)|content is not available/i

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
      redirect: 'manual', // не идём по редиректам — сам редирект и есть сигнал
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })

    // Явные коды недоступности.
    if (res.status === 404 || res.status === 410 || res.status === 403) return 'unavailable'

    // Редирект эмбеда (у VK — уход в автологин на битом/приватном/удалённом).
    // `redirect: 'manual'` даёт opaqueredirect (status 0). Плюс подстрахуемся 3xx.
    if (res.type === 'opaqueredirect' || res.status === 0 || (res.status >= 300 && res.status < 400)) {
      return 'unavailable'
    }

    if (!res.ok) return 'unknown'

    // Рабочий эмбед — 200. На всякий случай сверяем тело с маркерами.
    const html = (await res.text()).slice(0, 200_000)
    if (DEAD.test(html)) return 'unavailable'
    return 'ok'
  } catch {
    return 'unknown'
  }
}
