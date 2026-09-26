import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { normModIds } from '@/app/api/stream/chat/_mod'
import { errorMessage } from '@/lib/errorMessage'
import { sqlRows } from '@/lib/sql'

/**
 * Сквозные настройки трансляций (владелец студии). Пока — общий список
 * модераторов чата (id подписчиков), применяемый ко всем трансляциям.
 *
 * Читаем/пишем колонку site_settings.stream_moderator_ids напрямую (node-pg
 * pool), а не через payload.update: так не зависим от валидации всей большой
 * коллекции и от того, успела ли примениться миграция (колонку создаём на лету).
 * GET → { moderatorIds }. POST { moderatorIds:number[] } → сохранить.
 */
export const runtime = 'nodejs'

async function ensureColumn(payload: any) {
  try {
    await sqlRows(payload, 'ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "stream_moderator_ids" jsonb')
  } catch {
    /* колонка уже есть или нет прав — не критично для чтения */
  }
}

export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  await ensureColumn(payload)
  const rows = await sqlRows<{ stream_moderator_ids: unknown }>(
    payload,
    'SELECT stream_moderator_ids FROM site_settings WHERE tenant_id = $1 LIMIT 1',
    [Number(tenantId)],
  ).catch(() => [] as { stream_moderator_ids: unknown }[])
  return apiOk({ moderatorIds: normModIds(rows[0]?.stream_moderator_ids) })
})

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const wanted = normModIds((data as any).moderatorIds)
  // Оставляем только реальных подписчиков этого тенанта.
  let moderatorIds: number[] = []
  if (wanted.length) {
    const res = await payload.find({
      collection: 'subscribers',
      where: { and: [{ tenant: { equals: tenantId } }, { id: { in: wanted } }] },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const valid = new Set((res.docs as any[]).map((s) => Number(s.id)))
    moderatorIds = wanted.filter((id) => valid.has(id))
  }

  await ensureColumn(payload)
  try {
    const updated = await sqlRows(
      payload,
      'UPDATE site_settings SET stream_moderator_ids = $1::jsonb WHERE tenant_id = $2 RETURNING id',
      [JSON.stringify(moderatorIds), Number(tenantId)],
    )
    if (!updated.length) return apiError('Настройки сайта не найдены', 404)
    return apiOk({ moderatorIds })
  } catch (e) {
    return apiError(errorMessage(e, 'Не удалось сохранить'), 500)
  }
})
