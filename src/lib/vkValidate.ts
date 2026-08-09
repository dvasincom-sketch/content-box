/**
 * Проверка доступности внешнего (embed) видео.
 *
 * Почему НЕ скрейпим video_ext.php: VK требует сессию и редиректит ЛЮБОЙ
 * серверный запрос на автологин — и рабочие, и битые видео ведут себя
 * одинаково, отличить по HTTP/HTML нельзя (проверено: 193/193 «редиректят»).
 *
 * Надёжно только через VK API `video.get`: он прямо говорит, существует и
 * доступно ли видео. Требует токен (`VK_SERVICE_TOKEN`). Без токена VK-видео
 * возвращаем 'unknown' — НИЧЕГО не флагуем (безопасно, без ложных срабатываний).
 *
 * ВАЖНО: помечаем 'unavailable' только при явном признаке недоступности; при
 * любой неопределённости (нет токена, rate-limit, сеть, неоднозначный ответ) —
 * 'unknown'.
 */
export type EmbedStatus = 'ok' | 'unavailable' | 'unknown'

const VK_TOKEN = (process.env.VK_SERVICE_TOKEN || '').trim()

function parseVkIds(embedSrc: string): { owner: string; id: string } | null {
  try {
    const u = new URL(embedSrc)
    if (!/(^|\.)vkvideo\.ru$|(^|\.)vk\.com$|(^|\.)vk\.ru$/i.test(u.hostname)) return null
    const owner = u.searchParams.get('oid')
    const id = u.searchParams.get('id')
    return owner && id ? { owner, id } : null
  } catch {
    return null
  }
}

async function checkVkApi(owner: string, id: string): Promise<EmbedStatus> {
  try {
    const url =
      `https://api.vk.com/method/video.get?videos=${encodeURIComponent(`${owner}_${id}`)}` +
      `&access_token=${encodeURIComponent(VK_TOKEN)}&v=5.199`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' })
    if (!res.ok) return 'unknown'
    const data = (await res.json()) as {
      response?: { count?: number; items?: unknown[] }
      error?: { error_code?: number }
    }
    if (data.error) {
      const code = data.error.error_code
      // 100 — неверный параметр (битый id), 15 — доступ запрещён, 204 — доступ к видео запрещён.
      if (code === 100 || code === 15 || code === 204) return 'unavailable'
      return 'unknown' // 5 (auth), 6/29 (rate limit) и прочее — не флагуем
    }
    const items = data.response?.items
    if (Array.isArray(items) && items.length > 0) return 'ok'
    if (data.response && (data.response.count === 0 || (Array.isArray(items) && items.length === 0))) {
      return 'unavailable' // видео нет в ответе → удалено/недоступно
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function checkEmbedAvailability(embedSrc: string): Promise<EmbedStatus> {
  const src = (embedSrc || '').trim()
  if (!src) return 'unknown'
  const vk = parseVkIds(src)
  if (vk) {
    if (!VK_TOKEN) return 'unknown' // без токена VK не проверяем и не флагуем
    return checkVkApi(vk.owner, vk.id)
  }
  return 'unknown' // не-VK эмбеды пока не проверяем
}
