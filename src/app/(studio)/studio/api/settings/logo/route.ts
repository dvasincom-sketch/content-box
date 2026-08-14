import { withAuthor, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { shrinkForWeb, storageName } from '@/lib/imageIngest'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Загрузка логотипа: файл → media (R2), затем site-settings.logo = media.id.
 * multipart/form-data, поле `file`. Возвращает { id, url }.
 */

export const runtime = 'nodejs'

const MAX_BYTES = 6 * 1024 * 1024 // 6 MB — логотипу больше не нужно
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/avif']

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
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
    return apiError('Поддерживаются: JPEG, PNG, WebP, SVG, AVIF')
  }
  if (blob.size > MAX_BYTES) {
    return apiError('Файл больше 6 МБ')
  }

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const ing = await shrinkForWeb(buffer, blob.type)

    const media = await payload.create({
      collection: 'media',
      data: { tenant: tenantId } as any,
      file: {
        data: ing.buffer,
        name: storageName(tenantId, (blob as any).name, ing.ext, 'logo'),
        mimetype: ing.mime,
        size: ing.buffer.length,
      },
      overrideAccess: true,
    })

    // привязать к настройкам
    const settings = await findTenantSettings(payload, tenantId)
    if (settings) {
      await payload.update({
        collection: 'site-settings',
        id: settings.id,
        data: { logo: media.id } as any,
        overrideAccess: true,
      })
    }

    return apiOk({ id: media.id, url: (media as any).url || null })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить логотип'), 500)
  }
})
