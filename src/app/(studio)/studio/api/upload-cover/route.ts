import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { shrinkForWeb, storageName } from '@/lib/imageIngest'
import { slugify } from '@/lib/slugify'
import { randomUUID } from 'crypto'

/**
 * Загрузка обложки в коллекцию media. Файл идёт в R2 (s3Storage настроен в
 * payload.config). Тенант проставляется из сессии автора.
 *
 * Принимает multipart/form-data с полем `file`. Возвращает { id, url }.
 */

export const runtime = 'nodejs'

// разумный лимит на обложку
const MAX_BYTES = 12 * 1024 * 1024 // 12 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Ожидается форма с файлом')
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return apiError('Файл не передан')
  }

  const blob = file as File
  if (!ALLOWED.includes(blob.type)) {
    return apiError('Поддерживаются изображения: JPEG, PNG, WebP, GIF, AVIF')
  }
  if (blob.size > MAX_BYTES) {
    return apiError('Файл больше 12 МБ')
  }

  // SEO-имя обложки из заголовка публикации (если клиент прислал seoName).
  const seoNameRaw = form.get('seoName')
  const seoTitle = seoNameRaw && typeof seoNameRaw === 'string' ? seoNameRaw.trim() : ''
  const seoBase = slugify(seoTitle)

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ing = await shrinkForWeb(buffer, blob.type)
    // Имя в хранилище ВСЕГДА уникальное (короткий суффикс), даже если у файла то
    // же исходное имя, что у ранее загруженного. Иначе storageName давал бы тот
    // же ключ R2 → коллизия: показывалась старая картинка вместо новой.
    const rawName = typeof (blob as any).name === 'string' ? (blob as any).name : ''
    const baseNoExt = rawName.replace(/\.[^.]*$/, '') // убираем расширение, чтобы суффикс не срезался
    const storeName = seoBase
      ? storageName(tenantId, `${seoBase}-oblozhka-${randomUUID().slice(0, 5)}`, ing.ext, 'cover')
      : storageName(tenantId, `${baseNoExt || 'cover'}-${randomUUID().slice(0, 5)}`, ing.ext, 'cover')

    const doc = await payload.create({
      collection: 'media',
      data: { tenant: tenantId, ...(seoTitle ? { alt: seoTitle } : {}) } as any,
      file: {
        data: ing.buffer,
        name: storeName,
        mimetype: ing.mime,
        size: ing.buffer.length,
      },
      overrideAccess: true,
    })

    const url = (doc as any)?.url || null
    return apiOk({ id: doc.id, url })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить обложку. Попробуйте другой файл или переименуйте его латиницей.'), 500)
  }
})
