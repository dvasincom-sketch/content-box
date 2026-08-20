import { withAuthor, apiError, apiOk, findTenantSettings, isContributor } from '@/app/(studio)/studio/api/_lib'
import { generateApiKey } from '@/lib/externalApiAuth'
import { logActivity } from '@/lib/logActivity'

/**
 * Управление ключом внешнего API (owner-only). Значение ключа наружу отдаётся
 * ТОЛЬКО в момент генерации (POST) — дальше храним лишь хеш и префикс.
 *  GET    → { ok, hasKey, prefix, createdAt, lastUsedAt }
 *  POST   → сгенерировать (заменяет прежний) → { ok, key, prefix }
 *  DELETE → отозвать → { ok, hasKey:false }
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Недостаточно прав', 403)
  const s = (await findTenantSettings(payload, tenantId)) as any
  return apiOk({
    hasKey: !!s?.externalApiKeyHash,
    prefix: s?.externalApiKeyPrefix || null,
    createdAt: s?.externalApiKeyCreatedAt || null,
    lastUsedAt: s?.externalApiKeyLastUsedAt || null,
  })
})

export const POST = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Недостаточно прав', 403)
  const s = await findTenantSettings(payload, tenantId)
  if (!s) return apiError('Настройки сайта не найдены', 404)
  const { key, hash, prefix } = generateApiKey()
  await payload.update({
    collection: 'site-settings',
    id: s.id,
    data: {
      externalApiKeyHash: hash,
      externalApiKeyPrefix: prefix,
      externalApiKeyCreatedAt: new Date().toISOString(),
      externalApiKeyLastUsedAt: null,
    } as any,
    overrideAccess: true,
  })
  await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'настройки', title: 'Сгенерирован ключ внешнего API' })
  return apiOk({ key, prefix })
})

export const DELETE = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Недостаточно прав', 403)
  const s = await findTenantSettings(payload, tenantId)
  if (!s) return apiError('Настройки сайта не найдены', 404)
  await payload.update({
    collection: 'site-settings',
    id: s.id,
    data: {
      externalApiKeyHash: null,
      externalApiKeyPrefix: null,
      externalApiKeyCreatedAt: null,
      externalApiKeyLastUsedAt: null,
    } as any,
    overrideAccess: true,
  })
  await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'update', entity: 'настройки', title: 'Отозван ключ внешнего API' })
  return apiOk({ hasKey: false })
})
