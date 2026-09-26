import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Заблокировать/разблокировать подписчика в комментариях (модерация).
 * Ставит subscribers.commentsBanned. Доступ к контенту НЕ трогаем.
 * Body: { subscriber, banned?=true }.
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'commentsModeration', 'moderate')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const subId = (data as any).subscriber
  if (subId == null || subId === '') return apiError('Не указан пользователь')
  const banned = (data as any).banned !== false

  const sub: any = await payload.findByID({ collection: 'subscribers', id: subId, depth: 0, overrideAccess: true }).catch(() => null)
  const st = sub && (typeof sub.tenant === 'object' ? sub.tenant?.id : sub.tenant)
  if (!sub || String(st) !== String(tenantId)) return apiError('Пользователь не найден', 404)

  try {
    await payload.update({ collection: 'subscribers', id: subId, data: { commentsBanned: banned } as any, overrideAccess: true })
    return apiOk({ subscriber: subId, banned })
  } catch (e) {
    return apiError(errorMessage(e, 'Не удалось'), 500)
  }
})
