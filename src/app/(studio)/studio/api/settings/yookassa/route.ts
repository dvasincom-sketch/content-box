import { withAuthor, readJson, apiError, apiOk, findTenantSettings, isContributor } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Креды ЮKassa магазина автора (Вариант 1). Только владелец. Секрет наружу НЕ
 * отдаём — только факт наличия. GET → статус; POST → сохранить.
 *  GET  → { ok, configured, shopId, mode, taxSystem, vatCode, hasSecret }
 *  POST { shopId, secret?, mode, taxSystem, vatCode, clearSecret? } → сохранить
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Недостаточно прав', 403)
  const s = (await findTenantSettings(payload, tenantId)) as any
  const shopId = String(s?.yookassaShopId || '').trim()
  const hasSecret = !!String(s?.yookassaSecret || '').trim()
  return apiOk({
    configured: !!shopId && hasSecret,
    shopId,
    hasSecret,
    mode: s?.yookassaMode === 'live' ? 'live' : 'test',
    taxSystem: s?.yookassaTaxSystem ?? null,
    vatCode: s?.yookassaVatCode ?? 1,
  })
})

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  const patch: Record<string, unknown> = {
    yookassaShopId: String(data.shopId || '').trim().slice(0, 64) || null,
    yookassaMode: data.mode === 'live' ? 'live' : 'test',
    yookassaTaxSystem: numOrNull(data.taxSystem),
    yookassaVatCode: numOrNull(data.vatCode) ?? 1,
  }
  // Секрет обновляем только если прислан новый; можно явно очистить.
  if (data.clearSecret === true) patch.yookassaSecret = null
  else if (typeof data.secret === 'string' && data.secret.trim()) patch.yookassaSecret = data.secret.trim()

  try {
    await payload.update({ collection: 'site-settings', id: settings.id, data: patch as any, overrideAccess: true })
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'оплата', title: 'Настройки ЮKassa' })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
