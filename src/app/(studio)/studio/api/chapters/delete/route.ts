import { withAuthor, readJson, apiError, apiOk, belongsToTenant, ownsForContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/** Удаление главы. Body: { id } */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!(await ownsForContributor(payload, 'chapters' as any, id, author))) return apiError('Нет доступа к чужому контенту', 403)
  if (!id) return apiError('Не указана глава')
  if (!(await belongsToTenant(payload, 'chapters' as any, id, tenantId))) return apiError('Глава не найдена', 404)
  try {
    await payload.delete({ collection: 'chapters' as any, id, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось удалить главу'), 500)
  }
})
