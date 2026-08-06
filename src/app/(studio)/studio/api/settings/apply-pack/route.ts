import { withAuthor, readJson, apiError, apiOk, findTenantSettings, isContributor } from '@/app/(studio)/studio/api/_lib'
import { getHomePack } from '@/lib/homePacks'
import { PRESET_IDS } from '@/lib/themePresets'
import { isHomeSectionType, normalizeHomeSections, sanitizeSectionConfig, type HomeSectionType, type HomeSectionSettings } from '@/lib/homeSections'
import { errorMessage } from '@/lib/errorMessage'
import { logActivity } from '@/lib/logActivity'

/**
 * Применение пака (шаблона) главной. SiteSettings — одна запись на тенант.
 * Body: { packId, mode: 'overwrite' | 'merge' }.
 *  - overwrite: тема + секции + стартовые тексты заменяют текущие;
 *  - merge: к текущим секциям добавляются недостающие из пака (тема/тексты — как есть).
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const pack = getHomePack(String(data.packId || ''))
  if (!pack) return apiError('Неизвестный шаблон')
  const mode: 'overwrite' | 'merge' = data.mode === 'merge' ? 'merge' : 'overwrite'
  // Тема, выбранная в окне шаблона (переопределяет рекомендованную паком).
  const themeOverride = typeof data.themePreset === 'string' ? data.themePreset : null

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  // Секции пака: валидируем типы + дедуп.
  const packSections: { type: HomeSectionType; enabled: boolean; config?: HomeSectionSettings }[] = []
  const seenPack = new Set<HomeSectionType>()
  for (const s of pack.sections) {
    if (!isHomeSectionType(s.type) || seenPack.has(s.type)) continue
    seenPack.add(s.type)
    const row: { type: HomeSectionType; enabled: boolean; config?: HomeSectionSettings } = {
      type: s.type,
      enabled: s.enabled !== false,
    }
    const cfg = sanitizeSectionConfig(s.config)
    if (cfg) row.config = cfg
    packSections.push(row)
  }

  const patch: Record<string, unknown> = {}

  if (mode === 'overwrite') {
    const theme = themeOverride && PRESET_IDS.includes(themeOverride)
      ? themeOverride
      : (PRESET_IDS.includes(pack.themePreset) ? pack.themePreset : null)
    if (theme) patch.themePreset = theme
    patch.appliedTemplate = pack.id
    patch.homeSections = packSections
    if (pack.content?.hero) {
      const cur = ((settings as { hero?: Record<string, unknown> }).hero) ?? {}
      patch.hero = { ...cur, ...pack.content.hero }
    }
    if (pack.content?.banner) {
      const cur = ((settings as { banner?: Record<string, unknown> }).banner) ?? {}
      patch.banner = { ...cur, ...pack.content.banner }
    }
  } else {
    // merge: за базу берём ЭФФЕКТИВНЫЙ текущий набор (пусто → дефолт), добавляем
    // недостающие секции пака в конец. Тему и тексты не трогаем.
    const current = normalizeHomeSections((settings as { homeSections?: unknown }).homeSections)
    const seen = new Set<HomeSectionType>(current.map((s) => s.type))
    const merged = [...current]
    for (const s of packSections) {
      if (!seen.has(s.type)) {
        merged.push(s)
        seen.add(s.type)
      }
    }
    patch.homeSections = merged
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: patch as any,
      overrideAccess: true,
    })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'homepage', title: `Шаблон: ${pack.name}` })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось применить шаблон'))
  }
})
