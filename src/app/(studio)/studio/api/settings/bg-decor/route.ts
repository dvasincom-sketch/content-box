import { withAuthor, readJson, apiError, apiOk, findTenantSettings, isContributor } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { BG_DECOR_SLUGS } from '@/lib/bgDecors'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Сохранение фонового декора фан-сайта (site-settings.bgDecor). Только владелец.
 * Body: { bgDecor: 'none' | <slug из библиотеки> }. Значение валидируется по реестру.
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const raw = String(data.bgDecor ?? 'none')
  if (raw !== 'none' && !BG_DECOR_SLUGS.includes(raw)) return apiError('Неизвестный декор')

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { bgDecor: raw } as any,
      overrideAccess: true,
    })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'оформление', title: 'Фоновый декор' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
