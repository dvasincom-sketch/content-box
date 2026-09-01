import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { FONT_STACK } from '@/lib/themePresets'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Переопределение шрифтов поверх пресета темы (site-settings.fontHeading/fontBody).
 * Пустое значение = «как в теме». Правит владелец/менеджер оформления.
 * Body: { fontHeading?: string|null, fontBody?: string|null }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const norm = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s) return null
    if (!(s in FONT_STACK)) return null
    return s
  }
  const fontHeading = norm(data.fontHeading)
  const fontBody = norm(data.fontBody)

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { fontHeading, fontBody } as any,
      overrideAccess: true,
    })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'оформление', title: 'Шрифты' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
