import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { createMultipart, presignUploadPart, completeMultipartFromListing, abortMultipart, publicUrl } from '@/lib/s3'

/**
 * Multipart-загрузка большого оригинала своего видео (provider='self'). Один
 * presigned PUT не годится для файлов больше 5 ГиБ (лимит S3 на одну часть),
 * поэтому концерты 6–10 ГБ идут частями:
 *   phase='create'  → инициируем загрузку, отдаём { key, uploadId }
 *   phase='sign'    → presigned PUT на каждую часть { urls: [{partNumber,url}] }
 *   phase='complete'→ собираем части на сервере (ListParts) и завершаем
 *   phase='abort'   → отменяем незавершённую загрузку
 * Затем клиент, как и при обычной загрузке, зовёт create-from-storage с key.
 *
 * Байты идут браузер → S3 напрямую (минуя приложение и лимит тела на прокси).
 */
export const runtime = 'nodejs'

const MAX_BYTES = 10 * 1024 * 1024 * 1024 // 10 ГБ
const ALLOWED = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
  'video/mpeg',
  'video/x-msvideo',
  'video/x-m4v',
  'video/3gpp',
]

function ext(name: string): string {
  const i = name.lastIndexOf('.')
  const e = i >= 0 ? name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return e || 'mp4'
}

export const POST = withAuthor(async ({ req, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const phase = String(data.phase || '')

  // Начало: проверяем размер/тип, генерируем ключ и инициируем multipart.
  if (phase === 'create') {
    const contentType = String(data.contentType || 'video/mp4')
    const size = Number(data.size || 0)
    if (contentType && !ALLOWED.includes(contentType)) {
      return apiError('Поддерживаются видеофайлы (MP4, MOV, MKV, WebM и др.)')
    }
    if (!(size > 0)) return apiError('Пустой файл')
    if (size > MAX_BYTES) return apiError('Файл больше 10 ГБ')
    const rand = Math.random().toString(36).slice(2, 10)
    const key = `originals/${tenantId}/${Date.now()}-${rand}.${ext(String(data.filename || ''))}`
    const uploadId = await createMultipart(key, contentType)
    return apiOk({ key, uploadId, publicUrl: publicUrl(key) })
  }

  // Ключ всегда должен принадлежать текущему тенанту — защита от подписи чужих
  // объектов (uploadId сам по себе случаен, но префикс проверяем явно).
  const key = String(data.key || '')
  const uploadId = String(data.uploadId || '')
  const ownKey = key.startsWith(`originals/${tenantId}/`)

  if (phase === 'sign') {
    if (!ownKey || !uploadId) return apiError('Некорректный запрос')
    const partNumbers: number[] = Array.isArray(data.partNumbers)
      ? data.partNumbers
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 10000)
      : []
    if (partNumbers.length === 0) return apiError('Нет номеров частей')
    const urls = await Promise.all(
      partNumbers.map(async (pn) => ({ partNumber: pn, url: await presignUploadPart(key, uploadId, pn) })),
    )
    return apiOk({ urls })
  }

  if (phase === 'complete') {
    if (!ownKey || !uploadId) return apiError('Некорректный запрос')
    await completeMultipartFromListing(key, uploadId)
    return apiOk({ ok: true, key })
  }

  if (phase === 'abort') {
    if (ownKey && uploadId) await abortMultipart(key, uploadId)
    return apiOk({ ok: true })
  }

  return apiError('Неизвестная фаза загрузки')
})
