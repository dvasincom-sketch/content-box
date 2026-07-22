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

export type KinescopeListItem = {
  id: string
  title: string
  status?: string
  ready: boolean
  duration?: number
  /** URL превью (постера) — маленький размер для сетки, null если ещё нет */
  posterUrl: string | null
}

export type KinescopeList = {
  items: KinescopeListItem[]
  page: number
  perPage: number
  total: number
}

/**
 * Список видео из Kinescope (GET /v1/videos) — для импорта уже загруженных
 * через интерфейс Kinescope роликов в студию.
 *
 * По умолчанию НЕ фильтруем по project_id: пользователь мог загрузить видео в
 * любой проект/папку через app.kinescope.io, и все они должны быть видны.
 * Пагинация — meta.pagination.{page,per_page,total}. Превью берём из poster
 * (sm → md → original). Поиск — параметр q (по названию/описанию).
 */
export async function kinescopeListVideos(params?: {
  page?: number
  perPage?: number
  query?: string
}): Promise<KinescopeList> {
  const page = Math.max(1, Math.floor(params?.page ?? 1))
  const perPage = Math.min(100, Math.max(1, Math.floor(params?.perPage ?? 24)))

  const qs = new URLSearchParams()
  qs.set('page', String(page))
  qs.set('per_page', String(perPage))
  const q = (params?.query || '').trim()
  if (q) qs.set('q', q)

  const res = await fetch(`${KINESCOPE_API}/videos?${qs.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiToken()}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || `Kinescope list videos failed (${res.status})`
    throw new Error(msg)
  }

  const data = Array.isArray(json?.data) ? json.data : []
  const items: KinescopeListItem[] = data.map((d: any) => {
    const base = normalizeVideo(d)
    const poster = d?.poster
    const posterUrl =
      (poster && (poster.sm || poster.md || poster.original)) || null
    return {
      id: base.id,
      title: base.title || 'Без названия',
      status: base.status,
      ready: base.ready,
      duration: base.duration,
      posterUrl,
    }
  })

  const pg = json?.meta?.pagination || {}
  return {
    items,
    page: typeof pg.page === 'number' ? pg.page : page,
    perPage: typeof pg.per_page === 'number' ? pg.per_page : perPage,
    total: typeof pg.total === 'number' ? pg.total : items.length,
  }
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
