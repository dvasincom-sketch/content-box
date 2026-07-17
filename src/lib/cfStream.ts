/**
 * Тонкая обёртка над Cloudflare Stream API. Вся работа с CF в одном месте,
 * чтобы роуты не дублировали URL и заголовки.
 *
 * Секреты — только на сервере (эти функции вызываются из route-хендлеров):
 *   CLOUDFLARE_ACCOUNT_ID   — идентификатор аккаунта (может быть публичным)
 *   CLOUDFLARE_API_TOKEN    — токен с правами Stream (СЕКРЕТ)
 *   CF_STREAM_KEY_ID        — id signing key (для подписанных токенов, СЕКРЕТ)
 *   CF_STREAM_SIGNING_KEY   — приватный ключ PEM в base64 (СЕКРЕТ)
 *
 * На этом шаге используются первые два (загрузка/статус). Ключи подписи
 * понадобятся на шаге гейтинга (signed playback).
 */

const CF_BASE = 'https://api.cloudflare.com/client/v4'

function accountId(): string {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!id) throw new Error('CLOUDFLARE_ACCOUNT_ID не задан')
  return id
}
function apiToken(): string {
  const t = process.env.CLOUDFLARE_API_TOKEN
  if (!t) throw new Error('CLOUDFLARE_API_TOKEN не задан')
  return t
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken()}`,
    'Content-Type': 'application/json',
  }
}

export type StreamVideo = {
  uid: string
  readyToStream: boolean
  status?: { state?: string; errorReasonText?: string; pctComplete?: string }
  duration?: number
  thumbnail?: string
  meta?: Record<string, any>
}

/**
 * Загрузка видео из внешнего URL (copy). Cloudflare сам скачивает файл по
 * ссылке (R2/S3/Яндекс Object Storage/любой прямой download-URL). Ссылка должна
 * быть доступна Cloudflare извне (публичный объект или pre-signed URL).
 *
 * requireSignedURLs=true сразу помечает видео защищённым: публично по uid его
 * не открыть, нужен signed-токен (выдаём подписчику на шаге гейтинга).
 */
export async function streamCopyFromUrl(params: {
  url: string
  name?: string
  requireSignedURLs?: boolean
}): Promise<StreamVideo> {
  const body: Record<string, any> = {
    url: params.url,
    meta: { name: params.name || 'video' },
  }
  if (params.requireSignedURLs) body.requireSignedURLs = true

  const res = await fetch(`${CF_BASE}/accounts/${accountId()}/stream/copy`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    const msg = json?.errors?.[0]?.message || `Stream copy failed (${res.status})`
    throw new Error(msg)
  }
  return normalizeVideo(json.result)
}

/** Статус видео по uid — готово ли к воспроизведению. */
export async function streamGetVideo(uid: string): Promise<StreamVideo> {
  const res = await fetch(`${CF_BASE}/accounts/${accountId()}/stream/${uid}`, {
    method: 'GET',
    headers: authHeaders(),
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    const msg = json?.errors?.[0]?.message || `Stream get failed (${res.status})`
    throw new Error(msg)
  }
  return normalizeVideo(json.result)
}

/** Удаление видео из Stream (при удалении записи Videos). */
export async function streamDeleteVideo(uid: string): Promise<void> {
  const res = await fetch(`${CF_BASE}/accounts/${accountId()}/stream/${uid}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    // не критично — логируем, но не валим удаление записи
    // eslint-disable-next-line no-console
    console.warn(`Stream delete ${uid}: HTTP ${res.status}`)
  }
}

function normalizeVideo(r: any): StreamVideo {
  return {
    uid: r.uid,
    readyToStream: Boolean(r.readyToStream),
    status: r.status,
    duration: typeof r.duration === 'number' ? r.duration : undefined,
    thumbnail: r.thumbnail,
    meta: r.meta,
  }
}
