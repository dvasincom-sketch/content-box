import { withAuthor, readJson, apiError, apiOk, belongsToTenant, ownsForContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Переупорядочивание глав книги: order = позиция в списке (с 1).
 * Body: { bookId, orderedIds: (number|string)[] }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const bookId = data.bookId
  if (!(await ownsForContributor(payload, 'books' as any, bookId, author))) return apiError('Нет доступа к чужому контенту', 403)
  if (!bookId) return apiError('Не указана книга')
  if (!(await belongsToTenant(payload, 'books' as any, bookId, tenantId))) return apiError('Книга не найдена', 404)
  const ids = Array.isArray(data.orderedIds) ? data.orderedIds : []
  if (ids.length === 0) return apiError('Пустой порядок')

  try {
    let pos = 1
    for (const rawId of ids) {
      // Обновляем только главы этой книги/тенанта.
      const ch: any = await payload.findByID({ collection: 'chapters' as any, id: rawId, depth: 0, overrideAccess: true }).catch(() => null)
      if (!ch) continue
      const chTenant = ch.tenant && typeof ch.tenant === 'object' ? ch.tenant.id : ch.tenant
      const chBook = ch.book && typeof ch.book === 'object' ? ch.book.id : ch.book
      if (Number(chTenant) !== Number(tenantId) || Number(chBook) !== Number(bookId)) continue
      await payload.update({ collection: 'chapters' as any, id: rawId, data: { order: pos } as any, overrideAccess: true })
      pos++
    }
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось изменить порядок'), 500)
  }
})
