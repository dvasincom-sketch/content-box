import {
  withAuthor,
  readJson,
  apiError,
  apiOk,
  findTenantSettings,
} from '@/app/(studio)/studio/api/_lib'
import { PRESET_IDS } from '@/lib/themePresets'

/**
 * Сохранение выбранного пресета оформления. SiteSettings — одна запись на тенант.
 * Body: { preset: <id пресета> }. Валидируем id по реестру THEME_PRESETS.
 * Пресет задаёт сразу палитру (свет+тьма) и шрифты — отдельного выбора нет.
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const preset = String(data.preset || '').trim()
  if (!PRESET_IDS.includes(preset)) {
    return apiError(`Неизвестный пресет: ${preset}`)
  }

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) {
    return apiError('Настройки сайта не найдены', 404)
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { themePreset: preset } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
