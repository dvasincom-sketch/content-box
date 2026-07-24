import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Удаление публикации. Проверяем принадлежность тенанту автора.
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана публикация')

  const doc: any = await payload
    .findByID({ collection: 'publications', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return apiError('Публикация не найдена', 404)
  const postTenant = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(postTenant) !== Number(tenantId)) {
    return apiError('Публикация не найдена', 404)
  }

  try {
    await payload.delete({ collection: 'publications', id, overrideAccess: true })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось удалить')
  }
})
