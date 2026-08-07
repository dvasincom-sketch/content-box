import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Редактирование цели сбора (support-goals). Только владелец, только своя цель.
 * Body: { id, title?, description?, targetRub?, raisedRub?, weight?, isActive?, slug? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'goals', 'manage')) return apiError('Недостаточно прав', 403)
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

  const patch: any = {}
  if (typeof data.title === 'string') {
    const title = data.title.trim()
    if (!title) return apiError('Название не может быть пустым')
    patch.title = title
  }
  if (typeof data.description === 'string') patch.description = data.description
  if (data.targetRub !== undefined) {
    const v = Number(data.targetRub)
    if (Number.isNaN(v) || v < 0) return apiError('Цель должна быть числом ≥ 0')
    patch.targetRub = v
  }
  if (data.raisedRub !== undefined) {
    const v = Number(data.raisedRub)
    if (Number.isNaN(v) || v < 0) return apiError('«Собрано» должно быть числом ≥ 0')
    patch.raisedRub = v
  }
  if (data.weight !== undefined) {
    const v = Number(data.weight)
    if (Number.isNaN(v)) return apiError('Порядок должен быть числом')
    patch.weight = v
  }
  if (typeof data.isActive === 'boolean') patch.isActive = data.isActive
  if (typeof data.slug === 'string' && data.slug.trim()) patch.slug = data.slug.trim()

  try {
    await payload.update({ collection: 'support-goals', id, data: patch, overrideAccess: true })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'цель', title: 'Цель сбора' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
