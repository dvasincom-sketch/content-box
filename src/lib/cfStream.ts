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

/**
 * Запрос одноразового TUS upload-URL (Direct Creator Upload).
 * POST на /stream?direct_user=true с TUS-заголовками. Cloudflare возвращает
 * в заголовке Location одноразовую ссылку, которую безопасно отдать браузеру:
 * по ней tus-js-client льёт файл кусками, наш API-токен НЕ участвует.
 *
 * uploadLength — размер файла в байтах.
 * uploadMetadata — уже собранная строка Upload-Metadata (base64-пары),
 *   формируется на сервере, включает requiresignedurls для защиты.
 *
 * Возвращает { uploadURL, uid }. uid берём из заголовка stream-media-id.
 */
export async function streamCreateTusUpload(params: {
  uploadLength: number
  uploadMetadata: string
}): Promise<{ uploadURL: string; uid: string }> {
  const res = await fetch(
    `${CF_BASE}/accounts/${accountId()}/stream?direct_user=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken()}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(params.uploadLength),
        'Upload-Metadata': params.uploadMetadata,
      },
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`TUS upload init failed (${res.status}) ${text.slice(0, 200)}`)
  }

  const uploadURL = res.headers.get('Location')
  const uid = res.headers.get('stream-media-id') || ''
  if (!uploadURL) throw new Error('Cloudflare не вернул Location для загрузки')

  return { uploadURL, uid }
}

/**
 * Собирает строку Upload-Metadata по TUS-спецификации:
 * пары "ключ base64(значение)", разделённые запятыми. Булевы флаги без значения.
 * Пример: "name <b64>,requiresignedurls"
 */
export function buildUploadMetadata(fields: {
  name?: string
  requireSignedURLs?: boolean
}): string {
  const parts: string[] = []
  if (fields.name) {
    const b64 = Buffer.from(fields.name, 'utf-8').toString('base64')
    parts.push(`name ${b64}`)
  }
  if (fields.requireSignedURLs) {
    // булев флаг передаётся как ключ без значения
    parts.push('requiresignedurls')
  }
  return parts.join(',')
}

/**
 * Генерация подписанного токена (signed URL) для защищённого видео — локально,
 * без вызова Cloudflare. Токен = JWT (RS256), подписанный приватным ключом.
 *
 * Ключи из окружения:
 *   CF_STREAM_KEY_ID       — id signing key (kid)
 *   CF_STREAM_SIGNING_KEY  — приватный ключ PEM, base64-кодированный (как отдал CF)
 *
 * Используем нативный WebCrypto (без внешних JWT-библиотек).
 *
 * @param videoUid — uid видео (поле sub)
 * @param ttlSeconds — время жизни токена в секундах (по умолчанию 2 часа)
 */
export async function streamSignToken(
  videoUid: string,
  ttlSeconds = 2 * 60 * 60,
): Promise<string> {
  const keyId = process.env.CF_STREAM_KEY_ID
  const pemB64 = process.env.CF_STREAM_SIGNING_KEY
  if (!keyId) throw new Error('CF_STREAM_KEY_ID не задан')
  if (!pemB64) throw new Error('CF_STREAM_SIGNING_KEY не задан')

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds

  const header = { alg: 'RS256', kid: keyId }
  const payload = { sub: videoUid, kid: keyId, exp }

  const encHeader = b64url(JSON.stringify(header))
  const encPayload = b64url(JSON.stringify(payload))
  const signingInput = `${encHeader}.${encPayload}`

  // Ключ может лежать в двух видах:
  //  - чистый PEM ("-----BEGIN PRIVATE KEY-----\n...")
  //  - base64 от PEM (как отдаёт CF в некоторых случаях)
  // Определяем и приводим к чистому PEM.
  const pem = resolvePem(pemB64)

  const key = await importPkcs8(pem)
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput),
  )
  const encSig = b64urlBytes(new Uint8Array(sig))

  return `${signingInput}.${encSig}`
}

/**
 * Приводит значение ключа к чистому PEM.
 * Если это уже PEM (содержит "BEGIN") — возвращаем как есть.
 * Если base64 от PEM — раскодируем. Если base64 «голого» DER без заголовков —
 * оборачиваем в PEM-конверт.
 */
function resolvePem(raw: string): string {
  const val = (raw || '').trim()
  if (val.includes('BEGIN') && val.includes('PRIVATE KEY')) {
    // уже чистый PEM (возможно с \n или буквальными \n)
    return val.replace(/\\n/g, '\n')
  }
  // пробуем раскодировать base64 → вдруг там PEM-текст
  try {
    const decoded = Buffer.from(val, 'base64').toString('utf-8')
    if (decoded.includes('BEGIN') && decoded.includes('PRIVATE KEY')) {
      return decoded.replace(/\\n/g, '\n')
    }
  } catch {
    /* ignore */
  }
  // считаем, что это base64 от DER без обёртки — оборачиваем в PEM
  const lines = val.replace(/\s+/g, '').match(/.{1,64}/g) || [val]
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`
}

/** base64url из строки */
function b64url(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
/** base64url из байтов */
function b64urlBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Импорт PKCS8 PEM в CryptoKey для RS256-подписи */
async function importPkcs8(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Buffer.from(body, 'base64')
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}
