import { withAuthor, readJson, apiError, apiOk, findTenantSettings, isContributor } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { PRESET_IDS } from '@/lib/themePresets'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Сохранение выбранного пресета оформления. SiteSettings — одна запись на тенант.
 * Body: { preset: <id пресета> }. Валидируем id по реестру THEME_PRESETS.
 * Пресет задаёт сразу палитру (свет+тьма) и шрифты — отдельного выбора нет.
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
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
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'оформление', title: 'Тема сайта' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
