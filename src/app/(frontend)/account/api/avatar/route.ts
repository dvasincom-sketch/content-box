import { withSubscriber, apiError, apiOk } from '../_lib'

/**
 * Загрузка аватара участника: файл → media (R2), затем subscribers.avatar = media.id.
 * multipart/form-data, поле `file`. Скоуп — текущий подписчик.
 */
export const runtime = 'nodejs'

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export const POST = withSubscriber(async ({ req, payload, subscriber, tenantId }) => {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Ожидается форма с файлом')
  }
  const file = form.get('file')
  if (!file || typeof file === 'string') return apiError('Файл не передан')
  const blob = file as File
  if (!ALLOWED.includes(blob.type)) return apiError('Поддерживаются: JPEG, PNG, WebP, AVIF')
  if (blob.size > MAX_BYTES) return apiError('Файл больше 4 МБ')

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { tenant: tenantId } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `avatar-${subscriber.id}`,
        mimetype: blob.type,
        size: blob.size,
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'subscribers',
      id: subscriber.id,
      data: { avatar: media.id } as any,
      overrideAccess: true,
    })
    return apiOk({ id: media.id, url: (media as any).url || null })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось загрузить аватар', 500)
  }
})
