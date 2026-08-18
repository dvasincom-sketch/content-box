import { withAuthor, readJson, apiError, apiOk, findTenantSettings, isContributor } from '../../_lib'

/**
 * Ключ Аси (capability compose) на уровне тенанта — ввод прямо в студии вместо
 * платформенного env. Только владелец. Значение ключа наружу НЕ отдаётся —
 * только факт наличия и источник (студия/env).
 *  GET  → { ok, hasKey, source }
 *  POST { key } → сохранить/очистить → { ok, hasKey }
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Недостаточно прав', 403)
  const settings = await findTenantSettings(payload, tenantId)
  const k = String((settings as { aiComposeKey?: unknown } | null)?.aiComposeKey || '').trim()
  const envK = (process.env.ASYA_COMPOSE_KEY || '').trim()
  return apiOk({ hasKey: k.length > 0, source: k ? 'studio' : envK ? 'env' : 'none' })
})

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Недостаточно прав', 403)
  const data = await readJson<{ key?: string }>(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const key = String(data.key ?? '').trim().slice(0, 200)

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  await payload.update({
    collection: 'site-settings',
    id: settings.id,
    data: { aiComposeKey: key || null } as any,
    overrideAccess: true,
  })
  const envK = (process.env.ASYA_COMPOSE_KEY || '').trim()
  return apiOk({ hasKey: key.length > 0, source: key ? 'studio' : envK ? 'env' : 'none' })
})
