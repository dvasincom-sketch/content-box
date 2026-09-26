import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/** Скрыть/показать комментарий (модерация). Body: { id, hidden?=true }. */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'commentsModeration', 'moderate')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = (data as any).id
  if (!id) return apiError('Не указан комментарий')
  const hidden = (data as any).hidden !== false

  const c: any = await payload.findByID({ collection: 'comments', id, depth: 0, overrideAccess: true }).catch(() => null)
  const ct = c && (typeof c.tenant === 'object' ? c.tenant?.id : c.tenant)
  if (!c || Number(ct) !== Number(tenantId)) return apiError('Комментарий не найден', 404)

  try {
    await payload.update({ collection: 'comments', id, data: { status: hidden ? 'hidden' : 'published' } as any, overrideAccess: true })
    return apiOk({ id, hidden })
  } catch (e) {
    return apiError(errorMessage(e, 'Не удалось'), 500)
  }
})
