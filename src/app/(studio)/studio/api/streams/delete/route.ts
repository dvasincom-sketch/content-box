import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/** Удалить трансляцию. Body: { id }. Только владелец. */
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

  try {
    await payload.delete({ collection: 'streams' as any, id, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось удалить'), 500)
  }
})
