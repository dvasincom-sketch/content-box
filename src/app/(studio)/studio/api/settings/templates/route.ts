import crypto from 'crypto'
import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import {
  normalizeHomeSections,
  isHomeSectionType,
  sanitizeSectionConfig,
  type HomeSectionType,
  type HomeSectionSettings,
} from '@/lib/homeSections'
import type { HomeSavedTemplate } from '@/lib/homePacks'
import { PRESET_IDS } from '@/lib/themePresets'
import { errorMessage } from '@/lib/errorMessage'

/**
 * «Мои шаблоны» главной (пер-тенант). SiteSettings.savedTemplates — jsonb-массив.
 * Только владелец студии. Экшены (body.action):
 *  - save   { name }               — сохранить ТЕКУЩУЮ главную (секции+тема+тексты) как свой шаблон;
 *  - rename { id, name }           — переименовать;
 *  - delete { id }                 — удалить (сбросить appliedTemplate, если он);
 *  - apply  { id, themePreset? }   — применить свой шаблон (перезапись главной).
 */
export const runtime = 'nodejs'

type Row = { type: HomeSectionType; enabled: boolean; config?: HomeSectionSettings }

/** Секции из сырого homeSections → чистый список {type,enabled,config}. */
function cleanSections(raw: unknown): Row[] {
  return normalizeHomeSections(raw)
    .filter((s) => isHomeSectionType(s.type))
    .map((s) => {
      const row: Row = { type: s.type, enabled: s.enabled !== false }
      const cfg = sanitizeSectionConfig(s.config)
      if (cfg) row.config = cfg
      return row
    })
}

function readTemplates(settings: unknown): HomeSavedTemplate[] {
  const raw = (settings as { savedTemplates?: unknown })?.savedTemplates
  return Array.isArray(raw) ? (raw as HomeSavedTemplate[]) : []
}

function pickContent(settings: any) {
  const hero = settings?.hero
    ? { eyebrow: settings.hero.eyebrow ?? undefined, titleLines: settings.hero.titleLines ?? undefined }
    : undefined
  const banner = settings?.banner
    ? { tagline: settings.banner.tagline ?? undefined, onAirText: settings.banner.onAirText ?? undefined }
    : undefined
  return { ...(hero ? { hero } : {}), ...(banner ? { banner } : {}) }
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!(authorCan(author, 'appearance', 'manage') && authorCan(author, 'home', 'manage'))) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const action = String(data.action || '')

  const settings: any = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)
  const templates = readTemplates(settings)

  try {
    if (action === 'save') {
      const name = String(data.name || '').trim()
      if (!name) return apiError('Укажите название шаблона')
      if (templates.length >= 24) return apiError('Достигнут лимит своих шаблонов (24)')
      const tpl: HomeSavedTemplate = {
        id: crypto.randomUUID(),
        name: name.slice(0, 60),
        themePreset: PRESET_IDS.includes(settings.themePreset) ? settings.themePreset : PRESET_IDS[0],
        sections: cleanSections(settings.homeSections),
        content: pickContent(settings),
      }
      await payload.update({
        collection: 'site-settings', id: settings.id, overrideAccess: true,
        data: { savedTemplates: [...templates, tpl], appliedTemplate: tpl.id } as any,
      })
      return apiOk({ id: tpl.id })
    }

    if (action === 'rename') {
      const id = String(data.id || '')
      const name = String(data.name || '').trim()
      if (!id || !name) return apiError('Некорректный запрос')
      const next = templates.map((t) => (t.id === id ? { ...t, name: name.slice(0, 60) } : t))
      await payload.update({
        collection: 'site-settings', id: settings.id, overrideAccess: true,
        data: { savedTemplates: next } as any,
      })
      return apiOk()
    }

    if (action === 'delete') {
      const id = String(data.id || '')
      if (!id) return apiError('Некорректный запрос')
      const next = templates.filter((t) => t.id !== id)
      const patch: Record<string, unknown> = { savedTemplates: next }
      if (settings.appliedTemplate === id) patch.appliedTemplate = null
      await payload.update({
        collection: 'site-settings', id: settings.id, overrideAccess: true, data: patch as any,
      })
      return apiOk()
    }

    if (action === 'apply') {
      const id = String(data.id || '')
      const tpl = templates.find((t) => t.id === id)
      if (!tpl) return apiError('Шаблон не найден', 404)
      const themeOverride = typeof data.themePreset === 'string' ? data.themePreset : null
      const theme = themeOverride && PRESET_IDS.includes(themeOverride)
        ? themeOverride
        : (PRESET_IDS.includes(tpl.themePreset) ? tpl.themePreset : null)
      const patch: Record<string, unknown> = {
        homeSections: cleanSections(tpl.sections),
        appliedTemplate: tpl.id,
        // Применение шаблона возвращает палитру к пресету (снимает свою тему).
        themeSource: 'preset',
      }
      if (theme) patch.themePreset = theme
      if (tpl.content?.hero) patch.hero = { ...(settings.hero ?? {}), ...tpl.content.hero }
      if (tpl.content?.banner) patch.banner = { ...(settings.banner ?? {}), ...tpl.content.banner }
      await payload.update({
        collection: 'site-settings', id: settings.id, overrideAccess: true, data: patch as any,
      })
      return apiOk()
    }

    return apiError('Неизвестное действие')
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось выполнить операцию'))
  }
})
