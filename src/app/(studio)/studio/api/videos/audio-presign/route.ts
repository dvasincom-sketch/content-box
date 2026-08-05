import { withAuthor, readJson, apiError, apiOk, hasCapability } from '@/app/(studio)/studio/api/_lib'
import { presignPut, publicUrl } from '@/lib/s3'

/**
 * Шаг 1 presigned-загрузки аудио: выдаём подписанный PUT-URL для прямой заливки
 * файла в S3 из браузера (минуя приложение). Байты через сервер не идут.
 * Body: { filename, contentType, size }. Ответ: { uploadUrl, key, publicUrl, contentType }.
 */
export const runtime = 'nodejs'

const MAX_BYTES = 200 * 1024 * 1024 // 200 МБ
const ALLOWED = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav']

function ext(name: string): string {
  const i = name.lastIndexOf('.')
  const e = i >= 0 ? name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return e || 'mp3'
}

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  if (!(await hasCapability(payload, tenantId, 'media'))) return apiError('Раздел медиа недоступен на текущем тарифе. Оформите пакет в студии.', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const contentType = String(data.contentType || 'audio/mpeg')
  const size = Number(data.size || 0)
  if (contentType && !ALLOWED.includes(contentType)) return apiError('Поддерживаются аудиофайлы (MP3 и другие)')
  if (!(size > 0)) return apiError('Пустой файл')
  if (size > MAX_BYTES) return apiError('Файл больше 200 МБ')

  const rand = Math.random().toString(36).slice(2, 10)
  const key = `audio/${tenantId}/${Date.now()}-${rand}.${ext(String(data.filename || ''))}`
  const uploadUrl = await presignPut(key, contentType)
  return apiOk({ uploadUrl, key, publicUrl: publicUrl(key), contentType })
})
