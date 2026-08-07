import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Создание цели сбора (support-goals). Только владелец.
 * Body: { title, description?, targetRub, raisedRub?, weight?, isActive?, slug? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'goals', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const title = String(data.title || '').trim()
  if (!title) return apiError('Укажите название цели')

  const targetRub = Number(data.targetRub)
  if (Number.isNaN(targetRub) || targetRub < 0) return apiError('Цель должна быть числом ≥ 0')

  const raisedRub = data.raisedRub === undefined ? 0 : Number(data.raisedRub)
  if (Number.isNaN(raisedRub) || raisedRub < 0) return apiError('«Собрано» должно быть числом ≥ 0')

  const weight = data.weight === undefined ? 0 : Number(data.weight)
  if (Number.isNaN(weight)) return apiError('Порядок должен быть числом')

  try {
    const doc = await payload.create({
      collection: 'support-goals',
      data: {
        title,
        description: typeof data.description === 'string' ? data.description : undefined,
        targetRub,
        raisedRub,
        weight,
        isActive: data.isActive !== false,
        slug: (typeof data.slug === 'string' && data.slug.trim()) || slugify(title) || `goal-${Date.now()}`,
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'create', entity: 'цель', title: 'Цель сбора' })
    return apiOk({ id: doc.id })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать цель'))
  }
})
