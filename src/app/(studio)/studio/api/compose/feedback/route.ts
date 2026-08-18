import { withAuthor, readJson, apiError, apiOk, findTenantSettings } from '../../_lib'
import { sendComposeFeedback } from '@/lib/asyaCompose'

/**
 * Обучение Аси на правках автора: клиент присылает «было → стало» (структура
 * разбора). Резолвим ключ тенанта и отправляем как few-shot в Асю. Best-effort.
 *  POST { before?, after } → { ok }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson<{ before?: string; after?: string }>(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const after = String(data.after || '').trim()
  if (!after) return apiOk({ skipped: true })

  let key = ''
  try {
    const s = await findTenantSettings(payload, tenantId)
    key = String((s as { aiComposeKey?: unknown } | null)?.aiComposeKey || '').trim()
  } catch { /* ignore */ }
  if (!key) key = (process.env.ASYA_COMPOSE_KEY || '').trim()
  if (key) void sendComposeFeedback(key, { before: String(data.before || ''), after })
  return apiOk({})
})
