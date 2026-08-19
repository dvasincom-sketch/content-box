import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Выбор источника палитры сайта. Owner / право appearance.
 * Body: { source: 'preset' | 'custom', id? }.
 *  - 'custom' + id — активировать свою тему (её цвета перекроют пресет);
 *  - 'preset'      — вернуться к палитре пресета/шаблона.
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'appearance', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const source = data.source === 'custom' ? 'custom' : 'preset'

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  const patch: Record<string, unknown> = { themeSource: source }
  if (source === 'custom') {
    const id = Number(data.id)
    if (!Number.isFinite(id) || id <= 0) return apiError('Некорректный id темы')
    if (!(await belongsToTenant(payload, 'custom-themes' as any, id, tenantId))) return apiError('Тема не найдена', 404)
    patch.activeCustomTheme = id
  }

  try {
    await payload.update({ collection: 'site-settings', id: settings.id, data: patch as any, overrideAccess: true })
    await logActivity(payload, {
      tenant: tenantId,
      user: author.user.id,
      action: 'update',
      entity: 'оформление',
      title: source === 'custom' ? 'Активирована своя тема' : 'Палитра из пресета',
    })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось применить'))
  }
})
