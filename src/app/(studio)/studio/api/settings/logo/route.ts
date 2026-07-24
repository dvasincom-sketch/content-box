import { withAuthor, apiError, apiOk, findTenantSettings } from '@/app/(studio)/studio/api/_lib'

/**
 * Загрузка логотипа: файл → media (R2), затем site-settings.logo = media.id.
 * multipart/form-data, поле `file`. Возвращает { id, url }.
 */

export const runtime = 'nodejs'

const MAX_BYTES = 6 * 1024 * 1024 // 6 MB — логотипу больше не нужно
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/avif']

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
    return apiError('Поддерживаются: JPEG, PNG, WebP, SVG, AVIF')
  }
  if (blob.size > MAX_BYTES) {
    return apiError('Файл больше 6 МБ')
  }

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { tenant: tenantId } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `logo-${Date.now()}`,
        mimetype: blob.type,
        size: blob.size,
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
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось загрузить логотип', 500)
  }
})
