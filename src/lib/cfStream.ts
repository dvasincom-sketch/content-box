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
  const isPkcs1 = pem.includes('BEGIN RSA PRIVATE KEY')

  const body = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')

  if (!body) {
    throw new Error('ключ пуст после очистки заголовков')
  }

  let der: Buffer
  try {
    der = Buffer.from(body, 'base64')
  } catch {
    throw new Error('тело ключа не является base64')
  }

  // WebCrypto понимает только PKCS8. Если ключ в PKCS1 (RSA PRIVATE KEY),
  // оборачиваем DER в PKCS8-конверт.
  const finalDer = isPkcs1 ? wrapPkcs1AsPkcs8(der) : der

  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      finalDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  } catch (e: any) {
    // диагностика без утечки ключа: только метаданные
    throw new Error(
      `importKey failed (${e?.message || 'unknown'}); ` +
        `format=${isPkcs1 ? 'PKCS1' : 'PKCS8'}, derBytes=${finalDer.length}`,
    )
  }
}

/**
 * Оборачивает PKCS1 RSA-ключ (DER) в PKCS8-конверт, чтобы WebCrypto его принял.
 * PKCS8 = SEQUENCE { version=0, AlgorithmIdentifier(rsaEncryption), OCTET STRING(pkcs1) }
 */
function wrapPkcs1AsPkcs8(pkcs1: Buffer): Buffer {
  // AlgorithmIdentifier для rsaEncryption + version INTEGER 0
  const rsaOid = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ])
  const version = Buffer.from([0x02, 0x01, 0x00])
  const octetString = derWrap(0x04, pkcs1)
  const inner = Buffer.concat([version, rsaOid, octetString])
  return derWrap(0x30, inner)
}

/** Оборачивает содержимое в DER TLV с заданным тегом и корректной длиной. */
function derWrap(tag: number, content: Buffer): Buffer {
  const len = content.length
  let lenBytes: Buffer
  if (len < 0x80) {
    lenBytes = Buffer.from([len])
  } else {
    const arr: number[] = []
    let n = len
    while (n > 0) {
      arr.unshift(n & 0xff)
      n >>= 8
    }
    lenBytes = Buffer.from([0x80 | arr.length, ...arr])
  }
  return Buffer.concat([Buffer.from([tag]), lenBytes, content])
}

/**
 * Резолв прямой download-ссылки для внешнего URL.
 *
 * Яндекс.Диск (disk.yandex.ru / yadi.sk) отдаёт ссылку на СТРАНИЦУ, а не на
 * файл — Cloudflare Stream по ней скачать не может. Для публичных ресурсов у
 * Яндекса есть официальный API (без токена), который по публичной ссылке
 * возвращает временную прямую ссылку на скачивание. Её и отдаём Stream.
 *
 * Для остальных URL (Object Storage, R2, S3, любые прямые) — возвращаем как есть.
 */
export async function resolveDirectUrl(inputUrl: string): Promise<string> {
  let host = ''
  try {
    host = new URL(inputUrl).hostname.toLowerCase()
  } catch {
    return inputUrl // невалидный URL — пусть дальше отвалится с понятной ошибкой
  }

  const isYandexDisk =
    host === 'disk.yandex.ru' ||
    host === 'disk.yandex.com' ||
    host === 'yadi.sk' ||
    host.endsWith('.yadi.sk')

  if (!isYandexDisk) return inputUrl

  // официальный API: прямая ссылка по публичному ключу (сам URL как public_key)
  const api =
    'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' +
    encodeURIComponent(inputUrl)

  const res = await fetch(api, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Файл на Яндекс.Диске не найден или не расшарен публично')
    }
    throw new Error(`Яндекс.Диск API вернул ${res.status}`)
  }
  const json = await res.json()
  if (!json?.href) {
    throw new Error('Яндекс.Диск не вернул прямую ссылку (возможно, запрещено скачивание)')
  }
  return json.href as string
}
