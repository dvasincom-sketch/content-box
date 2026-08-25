import { withAuthor, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { startBoost } from '@/lib/boost'
import { logActivity } from '@/lib/logActivity'

/**
 * Запустить boost-прогон очереди (owner/финансовое право). Арендует сервер
 * Timeweb по API из пребейкнутого образа; списание — после завершения (tick).
 */
export const POST = withAuthor(async ({ payload, tenantId, author }) => {
  if (!authorCan(author, 'tiers', 'manage')) return apiError('Недостаточно прав', 403)

  const res = await startBoost(payload, tenantId)
  if (!res.ok) return apiError(res.error)

  try {
    await logActivity(payload, {
      tenant: tenantId,
      user: author.user.id,
      action: 'create',
      entity: 'boost',
      title: `Boost-сервер запущен (#${res.run.id})`,
    })
  } catch { /* лог не критичен */ }

  return apiOk({ run: { id: res.run.id, status: res.run.status, estRub: res.run.est_rub } })
})
