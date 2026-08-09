import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { presignPut, publicUrl } from '@/lib/s3'

/**
 * Шаг 1 загрузки своего видео (provider='self'): выдаём presigned PUT-URL для
 * прямой заливки оригинала в S3 из браузера (байты не идут через приложение).
 * Затем клиент вызывает create-from-storage с полученным key.
 *
 * Body: { filename, contentType, size }. Ответ: { uploadUrl, key, contentType }.
 */
export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024 * 1024 // 5 ГБ
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

  const contentType = String(data.contentType || 'video/mp4')
  const size = Number(data.size || 0)
  if (contentType && !ALLOWED.includes(contentType)) {
    return apiError('Поддерживаются видеофайлы (MP4, MOV, MKV, WebM и др.)')
  }
  if (!(size > 0)) return apiError('Пустой файл')
  if (size > MAX_BYTES) return apiError('Файл больше 5 ГБ')

  const rand = Math.random().toString(36).slice(2, 10)
  const key = `originals/${tenantId}/${Date.now()}-${rand}.${ext(String(data.filename || ''))}`
  const uploadUrl = await presignPut(key, contentType, 3600)
  return apiOk({ uploadUrl, key, publicUrl: publicUrl(key), contentType })
})
