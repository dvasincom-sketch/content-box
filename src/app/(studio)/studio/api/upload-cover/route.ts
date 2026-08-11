import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

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

// Расширение по MIME (когда в имени его нет или оно кривое).
function extFromMime(m: string): string {
  const map: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }
  return map[m] || 'jpg'
}

// Чистим имя файла: убираем эмодзи и спецсимволы — из-за них ключ объекта в
// хранилище ломался, и обложка потом не открывалась (битая картинка). Оставляем
// буквы (в т.ч. кириллицу), цифры, дефис и подчёркивание.
function safeFileName(raw: string, mime: string): string {
  const dot = raw.lastIndexOf('.')
  const rawBase = dot > 0 ? raw.slice(0, dot) : raw
  let base = rawBase
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  if (!base) base = `cover-${Date.now()}`
  const rawExt = dot > 0 ? raw.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const ext = rawExt && rawExt.length <= 5 ? rawExt : extFromMime(mime)
  return `${base}.${ext}`
}

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
        name: safeFileName(String((blob as any).name || ''), blob.type),
        mimetype: blob.type,
        size: blob.size,
      },
      overrideAccess: true,
    })

    const url = (doc as any)?.url || null
    return apiOk({ id: doc.id, url })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить обложку. Попробуйте другой файл или переименуйте его латиницей.'), 500)
  }
})
