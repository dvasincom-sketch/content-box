import { withAuthor, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { shrinkForWeb, storageName } from '@/lib/imageIngest'
import { errorMessage } from '@/lib/errorMessage'
import { logActivity } from '@/lib/logActivity'

/**
 * Загрузка своей обложки для видео в media (R2). Возвращает { id, url }.
 * Привязка к видео делается отдельно (create/update с coverId), либо здесь сразу,
 * если передан videoId. Нужна для внешних вставок (VK/Дзен): у площадки своя
 * превьюшка, но автор может поставить собственную.
 *
 * multipart/form-data: file (обязательно), videoId (опц. — сразу привязать).
 */
export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create') && !authorCan(author, 'videos', 'editAny')) return apiError('Недостаточно прав', 403)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Ожидается форма с файлом')
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') return apiError('Файл не передан')

  const blob = file as File
  if (!ALLOWED.includes(blob.type)) return apiError('Поддерживаются JPEG, PNG, WebP, AVIF, GIF')
  if (blob.size > MAX_BYTES) return apiError('Файл больше 8 МБ')

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const ing = await shrinkForWeb(buffer, blob.type)

    const media = await payload.create({
      collection: 'media',
      data: { tenant: tenantId } as any,
      file: {
        data: ing.buffer,
        name: storageName(tenantId, (blob as any).name, ing.ext, 'video-cover'),
        mimetype: ing.mime,
        size: ing.buffer.length,
      },
      overrideAccess: true,
    })

    // Опционально сразу привязать к видео (если оно уже существует и наше).
    const videoId = form.get('videoId')
    if (videoId && typeof videoId === 'string') {
      const v: any = await payload
        .findByID({ collection: 'videos', id: videoId, depth: 0, overrideAccess: true })
        .catch(() => null)
      const vTenant = v?.tenant && typeof v.tenant === 'object' ? v.tenant.id : v?.tenant
      if (v && Number(vTenant) === Number(tenantId)) {
        await payload.update({ collection: 'videos', id: videoId, data: { cover: media.id } as any, overrideAccess: true })
      }
    }

    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'видео', title: 'обложка' })
    return apiOk({ id: media.id, url: (media as any).url || null })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить'), 500)
  }
})
