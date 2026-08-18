import { withAuthor, readJson, apiError, apiOk, findTenantSettings, isContributor } from '../../_lib'

/**
 * Депозит тенанта на оплату ИИ (₽). Только владелец. Из него в биллинге списывается
 * стоимость токенов помесячно.
 *  POST { rub } → { ok, deposit }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Недостаточно прав', 403)
  const data = await readJson<{ rub?: number }>(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const rub = Math.max(0, Math.round(Number(data.rub) || 0))

  const settings = await findTenantSettings(payload, tenantId)
  if (!settings) return apiError('Настройки сайта не найдены', 404)

  await payload.update({
    collection: 'site-settings',
    id: settings.id,
    data: { aiDepositRub: rub } as any,
    overrideAccess: true,
  })
  return apiOk({ deposit: rub })
})
