import { withAuthor, readJson, apiError, apiOk, findTenantSettings, authorCan } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Быстрые суммы блока «Поддержать разово» (site-settings.donatePresets — json).
 * Body: { presets: [{ amount:number, label:string }] }. Санитайзим суммы/подписи.
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'goals', 'manage') && !authorCan(author, 'tiers', 'manage')) {
    return apiError('Недостаточно прав', 403)
  }
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const raw = Array.isArray((data as { presets?: unknown }).presets) ? (data as { presets: unknown[] }).presets : []
  const donatePresets = raw
    .map((r) => {
      const o = (r ?? {}) as { amount?: unknown; label?: unknown }
      return { amount: Math.max(0, Math.floor(Number(o.amount) || 0)), label: String(o.label ?? '').trim().slice(0, 24) }
    })
    .filter((r) => r.amount > 0)
    .slice(0, 8)

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { donatePresets } as never,
      overrideAccess: true,
    })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'оформление', title: 'Быстрые суммы поддержки' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})
