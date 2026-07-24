import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Чтение текстов баннера «ON AIR» (banner) для редактора в студии.
 * SiteSettings — одна запись на тенант. Тексты отдаём как есть; пустые значения
 * на фронте заменяются дефолтом (мягкий фолбэк в page.tsx).
 *
 * Ответ: { ok, banner: { tagline, onAirText } } | { error }
 */

export const GET = withAuthor(async ({ payload, tenantId }) => {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const settings = res.docs[0] as any
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  const banner = settings.banner || {}

  return apiOk({
    banner: {
      tagline: banner.tagline ?? '',
      onAirText: banner.onAirText ?? '',
    },
  })
})
