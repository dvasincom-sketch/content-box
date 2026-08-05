import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { htmlToLexical } from '@/lib/lexical'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Обновление метаданных книги.
 * Body: { id, title, slug?, annotation(html)?, status?, isAdult?, categoryId?,
 *         minTierId?, freeChapters?, coverId?, tags?: string[] }
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!id) return apiError('Не указана книга')
  const title = String(data.title || '').trim()
  if (!title) return apiError('Укажите название')

  if (!(await belongsToTenant(payload, 'books' as any, id, tenantId))) return apiError('Книга не найдена', 404)

  const patch: any = { title }
  if (typeof data.slug === 'string' && data.slug.trim()) patch.slug = slugify(data.slug) || undefined
  if ('annotation' in data) patch.annotation = htmlToLexical(String(data.annotation || ''))
  if (['ongoing', 'finished', 'frozen'].includes(data.status)) patch.status = data.status
  patch.isAdult = data.isAdult === true || data.isAdult === '1' || data.isAdult === 'true'
  if ('freeChapters' in data) {
    const n = Number(data.freeChapters)
    patch.freeChapters = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  }
  if ('categoryId' in data) {
    patch.category = data.categoryId && (await belongsToTenant(payload, 'categories', data.categoryId, tenantId))
      ? Number(data.categoryId) : null
  }
  if ('minTierId' in data) {
    patch.minTier = data.minTierId && (await belongsToTenant(payload, 'subscription-tiers', data.minTierId, tenantId))
      ? Number(data.minTierId) : null
  }
  if ('coverId' in data) {
    patch.cover = data.coverId && (await belongsToTenant(payload, 'media', data.coverId, tenantId))
      ? Number(data.coverId) : null
  }
  if ('tags' in data) {
    patch.tags = Array.isArray(data.tags)
      ? (data.tags as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => ({ label: t.trim() }))
      : []
  }

  try {
    await payload.update({ collection: 'books' as any, id, data: patch as any, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить книгу'))
  }
})
