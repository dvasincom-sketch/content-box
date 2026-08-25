import { withAuthor, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { stopBoost } from '@/lib/boost'
import { logActivity } from '@/lib/logActivity'

/** Остановить активный boost-прогон (гасит сервер + финализирует стоимость). */
export const POST = withAuthor(async ({ payload, tenantId, author }) => {
  if (!authorCan(author, 'tiers', 'manage')) return apiError('Недостаточно прав', 403)

  const res = await stopBoost(payload, tenantId)
  if (!res.ok) return apiError(res.error || 'Не удалось остановить')

  try {
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'delete', entity: 'boost', title: 'Boost-сервер остановлен' })
  } catch { /* лог не критичен */ }

  return apiOk()
})
