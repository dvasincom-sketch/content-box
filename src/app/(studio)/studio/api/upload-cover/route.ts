import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { shrinkForWeb, storageName } from '@/lib/imageIngest'

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

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ing = await shrinkForWeb(buffer, blob.type)

    const doc = await payload.create({
      collection: 'media',
      data: { tenant: tenantId } as any,
      file: {
        data: ing.buffer,
        name: storageName(tenantId, (blob as any).name, ing.ext, 'cover'),
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
