/**
 * Тонкая обёртка над Kinescope API (российский видеохостинг). Аналог cfStream.ts:
 * вся работа с Kinescope в одном месте, чтобы роуты не дублировали URL/заголовки.
 *
 * Kinescope не блокируется российскими провайдерами через DPI (в отличие от
 * Cloudflare Stream) — поэтому используется как провайдер для РФ-аудитории.
 *
 * Секреты — только на сервере (эти функции вызываются из route-хендлеров):
 *   KINESCOPE_API_TOKEN  — API-токен в формате UUID (СЕКРЕТ)
 *   KINESCOPE_PARENT_ID  — id проекта/папки, куда льются видео
 *
 * Базовые факты API (docs.kinescope.ru):
 *   - Base URL:     https://api.kinescope.io  (версия /v1)
 *   - Upload URL:   https://uploader.kinescope.io/v2/video
 *   - Авторизация:  Authorization: Bearer <UUID>
 *   - Ответы обёрнуты в { data: {...} }
 *   - Плеер:        https://kinescope.io/embed/<video_id>
 */

const KINESCOPE_API = 'https://api.kinescope.io/v1'
const KINESCOPE_UPLOADER = 'https://uploader.kinescope.io/v2'

function apiToken(): string {
  const t = process.env.KINESCOPE_API_TOKEN
  if (!t) throw new Error('KINESCOPE_API_TOKEN не задан')
  return t
}

function parentId(): string {
  const p = process.env.KINESCOPE_PARENT_ID
  if (!p) throw new Error('KINESCOPE_PARENT_ID не задан')
  return p
}

export type KinescopeVideo = {
  id: string
  title?: string
  /** статус обработки: 'done' — готово к воспроизведению */
  status?: string
  /** готово ли к воспроизведению (status === 'done') */
  ready: boolean
  duration?: number
  /** прогресс обработки в процентах, если доступен */
  progress?: number | null
}

/**
 * Нормализует ответ Kinescope (поле data) в наш тип.
 * Kinescope-статусы обработки: 'uploading' | 'processing' | 'done' | 'error' и т.п.
 */
function normalizeVideo(d: any): KinescopeVideo {
  const status = d?.status as string | undefined
  return {
    id: d?.id,
    title: d?.title,
    status,
    ready: status === 'done',
    duration: typeof d?.duration === 'number' ? d.duration : undefined,
    progress:
      typeof d?.progress === 'number'
        ? d.progress
        : typeof d?.processing_progress === 'number'
          ? d.processing_progress
          : null,
  }
}

/**
 * Загрузка видео из внешнего URL. Kinescope сам скачивает файл по ссылке
 * (прямой download-URL или YouTube). Заголовки: X-Parent-ID, X-Video-Title,
 * X-Video-URL. Возвращает созданное видео с id.
 *
 * Для Яндекс.Диска ссылку нужно предварительно резолвить в прямую (см.
 * resolveDirectUrl в cfStream.ts — переиспользуем её в роуте).
 */
export async function kinescopeUploadFromUrl(params: {
  url: string
  title: string
  description?: string
}): Promise<KinescopeVideo> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken()}`,
    'X-Parent-ID': parentId(),
    'X-Video-Title': encodeHeader(params.title),
    'X-Video-URL': params.url,
  }
  if (params.description) headers['X-Video-Description'] = encodeHeader(params.description)

  const res = await fetch(`${KINESCOPE_UPLOADER}/video`, {
    method: 'POST',
    headers,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || `Kinescope upload-from-url failed (${res.status})`
    throw new Error(msg)
  }
  return normalizeVideo(json.data || json)
}

/**
 * Загрузка видео файлом одним запросом. Метаданные — в заголовках, файл — в теле.
 * Подходит для не слишком больших файлов; для очень больших Kinescope
 * поддерживает Tus (отдельный поток, добавим позже при необходимости).
 *
 * @param file — бинарные данные файла (Buffer/Uint8Array)
 * @param mimetype — Content-Type файла
 */
export async function kinescopeUploadFile(params: {
  file: Buffer | Uint8Array
  title: string
  mimetype: string
  filename?: string
  description?: string
}): Promise<KinescopeVideo> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken()}`,
    'X-Parent-ID': parentId(),
    'X-Video-Title': encodeHeader(params.title),
    'Content-Type': params.mimetype || 'application/octet-stream',
  }
  if (params.filename) headers['X-File-Name'] = encodeHeader(params.filename)
  if (params.description) headers['X-Video-Description'] = encodeHeader(params.description)

  const res = await fetch(`${KINESCOPE_UPLOADER}/video`, {
    method: 'POST',
    headers,
    body: params.file as any,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || `Kinescope upload-file failed (${res.status})`
    throw new Error(msg)
  }
  return normalizeVideo(json.data || json)
}

/** Статус/метаданные видео по id — готово ли к воспроизведению. */
export async function kinescopeGetVideo(id: string): Promise<KinescopeVideo> {
  const res = await fetch(`${KINESCOPE_API}/videos/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiToken()}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || `Kinescope get video failed (${res.status})`
    throw new Error(msg)
  }
  return normalizeVideo(json.data || json)
}

/** Удаление видео из Kinescope (при удалении записи Videos). Не критично. */
export async function kinescopeDeleteVideo(id: string): Promise<void> {
  try {
    const res = await fetch(`${KINESCOPE_API}/videos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiToken()}` },
    })
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`Kinescope delete ${id}: HTTP ${res.status}`)
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn(`Kinescope delete ${id}: ${e?.message || 'error'}`)
  }
}

/**
 * URL для встраивания плеера Kinescope (iframe).
 * Базовая приватность: видео играется по этому URL без signed-токена.
 * Гейтинг по подписке обеспечивается на нашей стороне (плеер не рендерится
 * без доступа). Signed-доступ — отдельная задача на будущее.
 */
export function kinescopeEmbedUrl(videoId: string): string {
  return `https://kinescope.io/embed/${videoId}`
}

/**
 * Кодирует значение для HTTP-заголовка: заголовки должны быть ASCII, а название
 * видео может содержать кириллицу. Kinescope принимает percent-encoding.
 */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value // чистый ASCII — как есть
  return encodeURIComponent(value)
}
