import { withAuthor, apiError, apiOk, findTenantSettings, isContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Универсальная загрузка изображения в «Оформление»: файл → media, затем
 * привязка к нужному полю SiteSettings. multipart/form-data: `file` + `field`.
 *  - logo     → шапка сайта;
 *  - appIcon  → квадратная иконка (favicon/apple-touch/PWA генерятся из неё);
 *  - ogImage  → картинка для соцсетей (лежит в группе seoDefaults).
 * Возвращает { id, url }.
 */
export const runtime = 'nodejs'

const MAX_BYTES = 6 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/avif']
const FIELDS = new Set(['logo', 'appIcon', 'ogImage'])

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Ожидается форма с файлом')
  }

  const field = String(form.get('field') || '')
  if (!FIELDS.has(field)) return apiError('Неизвестное поле изображения')

  const file = form.get('file')
  if (!file || typeof file === 'string') return apiError('Файл не передан')
  const blob = file as File
  if (!ALLOWED.includes(blob.type)) return apiError('Поддерживаются: JPEG, PNG, WebP, SVG, AVIF')
  if (blob.size > MAX_BYTES) return apiError('Файл больше 6 МБ')

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { tenant: tenantId } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `${field}-${Date.now()}`,
        mimetype: blob.type,
        size: blob.size,
      },
      overrideAccess: true,
    })

    const settings: any = await findTenantSettings(payload, tenantId)
    if (settings) {
      let patch: Record<string, unknown>
      if (field === 'ogImage') {
        // ogImage живёт в группе seoDefaults — мержим, чтобы не потерять остальное.
        patch = { seoDefaults: { ...(settings.seoDefaults ?? {}), ogImage: media.id } }
      } else {
        patch = { [field]: media.id }
      }
      await payload.update({
        collection: 'site-settings',
        id: settings.id,
        data: patch as any,
        overrideAccess: true,
      })
    }

    return apiOk({ id: media.id, url: (media as any).url || null })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить изображение'), 500)
  }
})
