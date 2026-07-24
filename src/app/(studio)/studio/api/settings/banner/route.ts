import { withAuthor, readJson, apiError, apiOk, findTenantSettings } from '@/app/(studio)/studio/api/_lib'

/**
 * Сохранение текстов баннера «ON AIR» (banner). SiteSettings — одна запись на
 * тенант. Пустые значения допустимы (на чтении сработает фолбэк на дефолт).
 *
 * Body: { tagline?: string, onAirText?: string }
 */

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const tagline = typeof data.tagline === 'string' ? data.tagline : ''
  const onAirText = typeof data.onAirText === 'string' ? data.onAirText : ''

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { banner: { tagline, onAirText } } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
