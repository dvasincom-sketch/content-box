import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { kinescopeUploadFile } from '@/lib/kinescope'

/**
 * Загрузка видео файлом на Kinescope (аналог CF create-from-upload, но иначе:
 * у CF браузер льёт напрямую через TUS и присылает готовый uid; здесь файл
 * идёт multipart через наш сервер и мы проксируем его в Kinescope одним запросом).
 *
 * ВАЖНО (ограничение): файл проходит через сервер Render — большие файлы могут
 * упереться в таймаут/лимит тела. Для больших файлов позже добавим Kinescope Tus
 * (клиент → Kinescope напрямую). Сейчас — прямая загрузка с лимитом.
 *
 * Принимает multipart/form-data:
 *   file       — видеофайл (обязателен)
 *   title      — название (обязательно)
 *   minTierId  — уровень доступа (опц.)
 *   isPreview  — 'true'/'false' (опц.)
 *   categoryId — категория (опц.)
 *
 * Возвращает { id (запись Videos), videoId (Kinescope) }.
 */
export const runtime = 'nodejs'

const MAX_BYTES = 200 * 1024 * 1024 // 200 MB — потолок для загрузки через сервер

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Ожидается форма с файлом')
  }

  const fileField = form.get('file')
  if (!fileField || typeof fileField === 'string') {
    return apiError('Файл не передан')
  }
  const blob = fileField as File

  const title = String(form.get('title') || '').trim()
  if (!title) return apiError('Укажите название')

  if (!blob.type.startsWith('video/')) {
    return apiError('Ожидается видеофайл')
  }
  if (blob.size > MAX_BYTES) {
    return apiError('Файл больше 200 МБ — для крупных видео используйте загрузку по ссылке', 413)
  }

  // 1) Льём файл в Kinescope
  let videoId: string
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const video = await kinescopeUploadFile({
      file: buffer,
      title,
      mimetype: blob.type,
      filename: (blob as any).name || undefined,
    })
    videoId = video.id
    if (!videoId) throw new Error('Kinescope не вернул id видео')
  } catch (e: any) {
    return apiError(`Kinescope: ${e?.message || 'не удалось загрузить файл'}`, 502)
  }

  // 2) Создаём запись Videos
  try {
    const doc = await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: slugify(title) || videoId,
        provider: 'kinescope',
        videoRef: videoId,
        minTier: numOrNull(form.get('minTierId')),
        isPreview: form.get('isPreview') === 'true',
        category: numOrNull(form.get('categoryId')),
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: doc.id, videoId })
  } catch (e: any) {
    return apiError(e?.message || 'Видео ушло в Kinescope, но запись создать не удалось', 500)
  }
})

function numOrNull(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
