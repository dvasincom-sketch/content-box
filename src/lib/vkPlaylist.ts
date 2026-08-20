/**
 * Импорт плейлиста VK Видео через официальный VK API (`video.get`).
 *
 * Скрейпить страницу плейлиста бессмысленно (VK редиректит серверные запросы на
 * автологин — см. vkValidate.ts). Надёжно только через API: один запрос с
 * owner_id + album_id возвращает список видео плейлиста с метаданными, превью и
 * готовым `player` (embed-URL с hash). Требует `VK_SERVICE_TOKEN`.
 *
 * Ничего не качаем/не храним — на выходе элементы для создания embed-записей
 * (плеер VK через iframe). Обложки скачиваются отдельно в вызывающем роуте.
 */
const VK_TOKEN = (process.env.VK_SERVICE_TOKEN || '').trim()
const API_V = '5.199'
const PAGE = 200
const MAX_ITEMS = 1000

export type VkPlaylistRef = { ownerId: number; albumId: number }

export type VkVideoItem = {
  ownerId: number
  videoId: number
  title: string
  description: string
  durationSec: number
  dateSec: number
  /** Готовый embed-URL (video_ext.php с hash), если VK его отдал. */
  player: string
  /** Лучшее превью (самое широкое из image[]). */
  imageUrl: string | null
}

export type VkPlaylistResult =
  | { ok: true; items: VkVideoItem[]; total: number }
  | { ok: false; error: string }

export function vkTokenConfigured(): boolean {
  return !!VK_TOKEN
}

/**
 * Разобрать ссылку на плейлист: `-217576166_30` (owner_id_albumId). Понимает
 * vkvideo.ru/playlist/-217576166_30, vk.com/..., и сырой `-217576166_30`.
 */
export function parseVkPlaylistUrl(input: string): VkPlaylistRef | null {
  const raw = (input || '').trim()
  if (!raw) return null
  const m = /(-?\d+)_(\d+)/.exec(raw)
  if (!m) return null
  const ownerId = Number(m[1])
  const albumId = Number(m[2])
  if (!Number.isInteger(ownerId) || !Number.isInteger(albumId)) return null
  return { ownerId, albumId }
}

function bestImage(item: any): string | null {
  const arr = Array.isArray(item?.image) ? item.image : []
  let best: { url: string; width: number } | null = null
  for (const im of arr) {
    const url = typeof im?.url === 'string' ? im.url : ''
    const width = Number(im?.width) || 0
    if (url && (!best || width > best.width)) best = { url, width }
  }
  if (best) return best.url
  // Фолбэки на старые поля превью.
  for (const k of ['photo_800', 'photo_640', 'photo_320']) {
    if (typeof item?.[k] === 'string' && item[k]) return item[k]
  }
  return null
}

async function apiGet(ref: VkPlaylistRef, offset: number): Promise<Response> {
  const qs = new URLSearchParams({
    owner_id: String(ref.ownerId),
    album_id: String(ref.albumId),
    count: String(PAGE),
    offset: String(offset),
    access_token: VK_TOKEN,
    v: API_V,
  })
  return fetch(`https://api.vk.com/method/video.get?${qs.toString()}`, {
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })
}

/** Забрать все видео плейлиста (с пагинацией). */
export async function fetchVkPlaylist(ref: VkPlaylistRef): Promise<VkPlaylistResult> {
  if (!VK_TOKEN) return { ok: false, error: 'На сервере не задан VK_SERVICE_TOKEN — импорт из VK недоступен.' }

  const items: VkVideoItem[] = []
  let total = 0
  let offset = 0

  try {
    for (let guard = 0; guard < 20; guard++) {
      const res = await apiGet(ref, offset)
      if (!res.ok) return { ok: false, error: `VK API вернул HTTP ${res.status}.` }
      const data = (await res.json()) as {
        response?: { count?: number; items?: any[] }
        error?: { error_code?: number; error_msg?: string }
      }
      if (data.error) {
        const code = data.error.error_code
        const msg = data.error.error_msg || 'ошибка VK API'
        // 15/204 — доступ к плейлисту закрыт; 5 — токен; 100 — неверные параметры.
        return { ok: false, error: `VK API: ${msg} (код ${code}). Проверьте, что токен видит этот плейлист.` }
      }
      const batch = Array.isArray(data.response?.items) ? data.response!.items! : []
      total = Number(data.response?.count) || total
      for (const it of batch) {
        const ownerId = Number(it?.owner_id)
        const videoId = Number(it?.id)
        if (!Number.isInteger(ownerId) || !Number.isInteger(videoId)) continue
        items.push({
          ownerId,
          videoId,
          title: String(it?.title || '').trim(),
          description: String(it?.description || '').trim(),
          durationSec: Number(it?.duration) || 0,
          dateSec: Number(it?.date) || 0,
          player: typeof it?.player === 'string' ? it.player : '',
          imageUrl: bestImage(it),
        })
        if (items.length >= MAX_ITEMS) return { ok: true, items, total }
      }
      offset += PAGE
      if (batch.length < PAGE || (total && offset >= total)) break
    }
    return { ok: true, items, total: total || items.length }
  } catch {
    return { ok: false, error: 'Не удалось связаться с VK API (таймаут/сеть).' }
  }
}
