import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

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

    const doc = await payload.create({
      collection: 'media',
      data: { tenant: tenantId } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `cover-${Date.now()}`,
        mimetype: blob.type,
        size: blob.size,
      },
      overrideAccess: true,
    })

    const url = (doc as any)?.url || null
    return apiOk({ id: doc.id, url })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось загрузить файл', 500)
  }
})
