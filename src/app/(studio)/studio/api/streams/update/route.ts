import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { validateStreamInput, toPayloadData } from '../_helpers'

/** Обновить трансляцию. Body: { id, ...поля как в create }. Только владелец. */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана трансляция')

  const doc: any = await payload
    .findByID({ collection: 'streams' as any, id, depth: 0, overrideAccess: true })
    .catch(() => null)
  const dt = doc && (typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant)
  if (!doc || Number(dt) !== Number(tenantId)) return apiError('Трансляция не найдена', 404)

  const v = await validateStreamInput(data, payload, tenantId)
  if ('error' in v) return apiError(v.error)

  try {
    await payload.update({ collection: 'streams' as any, id, data: toPayloadData(v.data) as any, overrideAccess: true })
    return apiOk({ id })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'), 500)
  }
})
