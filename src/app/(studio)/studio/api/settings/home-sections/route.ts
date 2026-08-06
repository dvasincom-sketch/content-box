import { withAuthor, readJson, apiError, apiOk, findTenantSettings, isContributor } from '@/app/(studio)/studio/api/_lib'
import { isHomeSectionType, sanitizeSectionConfig } from '@/lib/homeSections'
import { errorMessage } from '@/lib/errorMessage'
import { logActivity } from '@/lib/logActivity'

/**
 * Сохранение конфигурации секций главной. SiteSettings — одна запись на тенант
 * (isGlobal через multi-tenant плагин). Находим её по tenant, обновляем массив
 * homeSections (порядок + видимость + пер-секционные настройки главной).
 *
 * Body: { homeSections: [{ id?, type, enabled, config? }] }
 *  - type ∈ HOME_SECTION_TYPES (валидируем через isHomeSectionType);
 *  - ДУБЛИ разрешены (несколько секций одного типа с разными источниками);
 *  - id (если пришёл) прокидываем, чтобы Payload сопоставил существующую строку
 *    массива и сохранил её стабильный идентификатор (ключ рендера/редактирования);
 *  - config санитизируется через sanitizeSectionConfig (heading/variant/
 *    sectionTheme/source), мусор отбрасывается.
 *
 * Пустой массив допустим — на чтении он означает «дефолт» (все секции в
 * стандартном порядке, см. normalizeHomeSections), т.е. это способ сброса.
 */

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const rawSections = Array.isArray(data.homeSections) ? data.homeSections : []
  // валидация и очистка (дубли типов допускаются)
  const homeSections: Array<{ id?: string | number; type: string; enabled: boolean; config?: unknown }> = []
  for (const s of rawSections) {
    const type = s?.type
    if (!isHomeSectionType(type)) {
      return apiError(`Неизвестная секция: ${String(type)}`)
    }
    const row: { id?: string | number; type: string; enabled: boolean; config?: unknown } = {
      type,
      enabled: Boolean(s?.enabled),
    }
    const id = s?.id
    if (typeof id === 'string' || typeof id === 'number') row.id = id
    const config = sanitizeSectionConfig(s?.config)
    if (config) row.config = config
    homeSections.push(row)
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
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'homepage', title: 'Секции главной' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
