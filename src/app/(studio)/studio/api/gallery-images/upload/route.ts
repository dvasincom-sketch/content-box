import { withAuthor, apiError, apiOk, belongsToTenant, hasCapability, authorCan } from '@/app/(studio)/studio/api/_lib'
import { shrinkForWeb, storageName } from '@/lib/imageIngest'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Загрузка одного изображения в коллекцию gallery-images. Файл идёт в R2
 * (s3Storage). Клиент шлёт файлы очередью (по одному запросу на файл,
 * параллельность 3-4) — здесь принимаем ровно один файл.
 *
 * Принимает multipart/form-data:
 *   file      — сам файл (обязателен)
 *   folderId  — id папки библиотеки (опционально)
 *   publicationId — id публикации-источника (опционально, автотег)
 *   alt       — подпись/alt (опционально)
 *
 * Возвращает { id, url, width, height } — размеры нужны фронту для justified-grid.
 */

export const runtime = 'nodejs'

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB — фото галереи крупнее обложек
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'gallery', 'create')) return apiError('Недостаточно прав', 403)
  if (!(await hasCapability(payload, tenantId, 'media'))) return apiError('Раздел медиа недоступен на текущем тарифе. Оформите пакет в студии.', 403)
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
    return apiError('Файл больше 25 МБ')
  }

  // Папка (если задана) — проверяем принадлежность тенанту
  let folderId: number | null = null
  const rawFolder = form.get('folderId')
  if (rawFolder && typeof rawFolder === 'string' && rawFolder !== '') {
    const ok = await belongsToTenant(payload, 'gallery-folders', rawFolder, tenantId)
    if (ok) folderId = Number(rawFolder)
  }

  // Публикация-источник (если задана) — фиксируем происхождение картинки для
  // автоматической организации библиотеки «по публикациям».
  let sourcePublication: number | null = null
  const rawPub = form.get('publicationId')
  if (rawPub && typeof rawPub === 'string' && rawPub !== '') {
    const okPub = await belongsToTenant(payload, 'publications', rawPub, tenantId)
    if (okPub) sourcePublication = Number(rawPub)
  }

  const alt = (form.get('alt') as string) || (blob as any).name || ''

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ing = await shrinkForWeb(buffer, blob.type)

    const doc = await payload.create({
      collection: 'gallery-images',
      data: {
        tenant: tenantId,
        owner: author.user.id,
        alt: alt || undefined,
        ...(folderId ? { folder: folderId } : {}),
        ...(sourcePublication ? { sourcePublication } : {}),
      } as any,
      file: {
        data: ing.buffer,
        name: storageName(tenantId, (blob as any).name, ing.ext, 'img'),
        mimetype: ing.mime,
        size: ing.buffer.length,
      },
      overrideAccess: true,
    })

    const d = doc as any
    return apiOk({
      id: d.id,
      url: d.url || null,
      width: d.width || null,
      height: d.height || null,
      alt: d.alt || '',
    })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить изображение'), 500)
  }
})
