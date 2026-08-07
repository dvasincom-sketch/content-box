import { withAuthor, apiError, apiOk, belongsToTenant, hasCapability, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Загрузка одного файла в раздел «Файлы» (downloads). Файл идёт в S3
 * (коллекция downloads), гейтинг задаём тут же (уровень / бесплатно / категория).
 *
 * multipart/form-data: file (обяз.), title, description?, minTierId?, isPreview?, categoryId?
 */
export const runtime = 'nodejs'

const MAX_BYTES = 300 * 1024 * 1024 // 300 МБ — книги/архивы/пресеты
// Широкий allowlist цифровых товаров. Пустой тип у некоторых форматов
// (epub/mobi) браузер шлёт как octet-stream — его тоже пропускаем.
const ALLOWED = [
  'application/pdf',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/rtf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'application/octet-stream',
  '',
]

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'downloads', 'create')) return apiError('Недостаточно прав', 403)
  if (!(await hasCapability(payload, tenantId, 'media'))) return apiError('Раздел медиа недоступен на текущем тарифе. Оформите пакет в студии.', 403)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Ожидается форма с файлом')
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') return apiError('Файл не передан')
  const blob = file as File
  if (blob.type && !ALLOWED.includes(blob.type)) return apiError('Такой тип файла не поддерживается')
  if (blob.size > MAX_BYTES) return apiError('Файл больше 300 МБ')

  const title = String(form.get('title') || '').trim() || (blob as any).name || 'Файл'
  const description = String(form.get('description') || '').trim() || undefined

  const categoryId = numOrNull(form.get('categoryId'))
  if (categoryId != null && !(await belongsToTenant(payload, 'categories', categoryId, tenantId))) {
    return apiError('Категория не найдена')
  }
  const minTierId = numOrNull(form.get('minTierId'))
  if (minTierId != null && !(await belongsToTenant(payload, 'subscription-tiers', minTierId, tenantId))) {
    return apiError('Уровень подписки не найден')
  }

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const doc = (await payload.create({
      collection: 'downloads' as any,
      data: {
        title,
        description,
        minTier: minTierId,
        isPreview: form.get('isPreview') === 'true' || form.get('isPreview') === '1',
        category: categoryId,
        publishedAt: new Date().toISOString(),
        tenant: tenantId,
        owner: author.user.id,
      } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `file-${Date.now()}`,
        mimetype: blob.type || 'application/octet-stream',
        size: blob.size,
      },
      overrideAccess: true,
    })) as any

    return apiOk({ id: doc.id })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить файл'), 500)
  }
})
