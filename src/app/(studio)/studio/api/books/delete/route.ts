import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Удаление книги вместе с её главами.
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!id) return apiError('Не указана книга')
  if (!(await belongsToTenant(payload, 'books' as any, id, tenantId))) return apiError('Книга не найдена', 404)

  try {
    // Сначала главы книги, затем сама книга.
    await payload.delete({ collection: 'chapters' as any, where: { and: [{ tenant: { equals: tenantId } }, { book: { equals: id } }] }, overrideAccess: true }).catch(() => {})
    await payload.delete({ collection: 'books' as any, id, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось удалить книгу'), 500)
  }
})
