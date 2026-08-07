import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'

/**
 * Удаление цели сбора (support-goals). Только владелец, только своя цель.
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана цель')

  const doc: any = await payload
    .findByID({ collection: 'support-goals', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return apiError('Цель не найдена', 404)
  const t = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(t) !== Number(tenantId)) return apiError('Цель не найдена', 404)

  try {
    await payload.delete({ collection: 'support-goals', id, overrideAccess: true })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'delete', entity: 'цель', title: 'Цель сбора' })
    return apiOk()
  } catch {
    return apiError('Не удалось удалить цель')
  }
})
