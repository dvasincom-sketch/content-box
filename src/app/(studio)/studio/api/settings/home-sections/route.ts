import { withAuthor, readJson, apiError, apiOk, findTenantSettings } from '@/app/(studio)/studio/api/_lib'
import { isHomeSectionType, type HomeSectionType } from '@/lib/homeSections'

/**
 * Сохранение конфигурации секций главной. SiteSettings — одна запись на тенант
 * (isGlobal через multi-tenant плагин). Находим её по tenant, обновляем массив
 * homeSections (порядок + видимость секций главной страницы).
 *
 * Body: { homeSections: [{ type, enabled }] }
 * type ∈ HOME_SECTION_TYPES (валидируем через isHomeSectionType).
 * Пустой массив допустим — на чтении он означает «дефолт» (все секции в
 * стандартном порядке, см. normalizeHomeSections), т.е. это способ сброса.
 */

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const rawSections = Array.isArray(data.homeSections) ? data.homeSections : []
  // валидация и очистка
  const homeSections: { type: HomeSectionType; enabled: boolean }[] = []
  const seen = new Set<HomeSectionType>()
  for (const s of rawSections) {
    const type = s?.type
    if (!isHomeSectionType(type)) {
      return apiError(`Неизвестная секция: ${String(type)}`)
    }
    if (seen.has(type)) {
      return apiError(`Дубликат секции: ${type}`)
    }
    seen.add(type)
    homeSections.push({ type, enabled: Boolean(s?.enabled) })
  }

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { homeSections } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
