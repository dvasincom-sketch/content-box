import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

const clip = (x: unknown, max = 60): string => String(x ?? '').trim().slice(0, max)

/**
 * Сохранение счётчиков витрины «Об авторе» (site-settings.authorStats — group).
 * Только владелец. Значения — свободный текст («800+»), подписи — тоже.
 * Пустое значение = на сайте подставится реальное число.
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'authorShowcase', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const authorStats = {
    videosValue: clip((data as any).videosValue),
    videosLabel: clip((data as any).videosLabel),
    membersValue: clip((data as any).membersValue),
    membersLabel: clip((data as any).membersLabel),
  }

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { authorStats } as any,
      overrideAccess: true,
    })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'оформление', title: 'Счётчики «Об авторе»' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
