import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Включение/выключение сквозного виджета Аси (site-settings.asyaWidgetEnabled).
 * Body: { enabled: boolean }. Правит владелец/менеджер оформления.
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const enabled = Boolean(data.enabled)

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { asyaWidgetEnabled: enabled } as any,
      overrideAccess: true,
    })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'оформление', title: enabled ? 'Виджет Аси включён' : 'Виджет Аси выключен' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
