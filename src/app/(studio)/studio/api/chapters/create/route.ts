import { withAuthor, readJson, apiError, apiOk, belongsToTenant, hasCapability, authorCan } from '@/app/(studio)/studio/api/_lib'
import { htmlToLexical } from '@/lib/lexical'
import { errorMessage } from '@/lib/errorMessage'
import { wordCountFromHtml } from '../_wordcount'

/**
 * Создание главы книги. Порядок — авто (макс+1), если не задан.
 * Body: { bookId, title, body(html)?, isPreview?, minTierId?, order? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'books', 'create')) return apiError('Недостаточно прав', 403)
  if (!(await hasCapability(payload, tenantId, 'books'))) return apiError('Раздел книг недоступен на текущем тарифе. Оформите пакет в студии.', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const bookId = data.bookId
  if (!bookId) return apiError('Не указана книга')
  if (!(await belongsToTenant(payload, 'books' as any, bookId, tenantId))) return apiError('Книга не найдена', 404)
  const title = String(data.title || '').trim()
  if (!title) return apiError('Укажите заголовок главы')

  let order = Number(data.order)
  if (!Number.isFinite(order) || order <= 0) {
    const last = await payload.find({
      collection: 'chapters' as any,
      where: { and: [{ tenant: { equals: tenantId } }, { book: { equals: bookId } }] },
      sort: '-order', limit: 1, depth: 0, overrideAccess: true,
    })
    order = (Number((last.docs[0] as any)?.order) || 0) + 1
  }

  let minTier: number | null = null
  if (data.minTierId && (await belongsToTenant(payload, 'subscription-tiers', data.minTierId, tenantId))) {
    minTier = Number(data.minTierId)
  }
  const html = String(data.body || '')

  try {
    const doc = await payload.create({
      collection: 'chapters' as any,
      data: {
        tenant: tenantId,
        owner: author.user.id,
        book: Number(bookId),
        title,
        order,
        body: htmlToLexical(html),
        isPreview: data.isPreview === true || data.isPreview === '1' || data.isPreview === 'true',
        minTier,
        wordCount: wordCountFromHtml(html),
        publishedAt: new Date().toISOString(),
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: (doc as any).id, order })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать главу'), 500)
  }
})
