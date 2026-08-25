import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/** Отклонить заявку UGC (Фаза 4): status=rejected + причина. */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'commentsModeration', 'moderate')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = Number(data.id)
  if (!id) return apiError('Не указана заявка')

  const sub = (await payload
    .findByID({ collection: 'submissions', id, depth: 0, overrideAccess: true })
    .catch(() => null)) as any
  const sTenant = sub && (typeof sub.tenant === 'object' ? sub.tenant?.id : sub.tenant)
  if (!sub || Number(sTenant) !== Number(tenantId)) return apiError('Заявка не найдена', 404)

  try {
    await payload.update({
      collection: 'submissions',
      id,
      data: { status: 'rejected', rejectReason: String(data.reason || '').slice(0, 500), reviewedBy: author.user.id } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось отклонить'), 500)
  }
})
