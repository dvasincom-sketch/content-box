/**
 * Импорт видео с публичной ссылки Яндекс.Диска без скачивания на устройство.
 * Публичный API Яндекс.Диска не требует авторизации для публичных ресурсов:
 *   - метаданные: /v1/disk/public/resources?public_key=<url>
 *   - прямая ссылка: /v1/disk/public/resources/download?public_key=<url>
 * public_key — это сам публичный URL (disk.yandex.ru/i/...), url-энкодед.
 */
const API = 'https://cloud-api.yandex.net/v1/disk/public'

export function isYandexDiskUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return /(^|\.)disk\.yandex\.(ru|com|net|by|kz|ua)$/.test(u.hostname) || u.hostname === 'yadi.sk'
  } catch {
    return false
  }
}

export async function yandexPublicMeta(
  url: string,
): Promise<{ name: string; size: number; mime: string; type: string } | null> {
  try {
    const res = await fetch(`${API}/resources?public_key=${encodeURIComponent(url)}&fields=name,size,mime_type,type`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const j = (await res.json()) as { name?: string; size?: number; mime_type?: string; type?: string }
    return { name: j.name || '', size: Number(j.size || 0), mime: j.mime_type || '', type: j.type || '' }
  } catch {
    return null
  }
}

export async function yandexDownloadHref(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/resources/download?public_key=${encodeURIComponent(url)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const j = (await res.json()) as { href?: string }
    return typeof j.href === 'string' ? j.href : null
  } catch {
    return null
  }
}
