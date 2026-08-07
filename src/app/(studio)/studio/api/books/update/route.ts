import { withAuthor, readJson, apiError, apiOk, belongsToTenant, canMutateDoc } from '@/app/(studio)/studio/api/_lib'
import { htmlToLexical } from '@/lib/lexical'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Обновление метаданных книги.
 * Body: { id, title, slug?, annotation(html)?, status?, type?, ageRating?, categoryId?,
 *         minTierId?, freeChapters?, coverId?, tags?, cycleId?, cycleOrder?,
 *         allowComments?, allowDownload? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!(await canMutateDoc(payload, 'books' as any, id, author, 'books', 'edit'))) return apiError('Недостаточно прав', 403)
  if (!id) return apiError('Не указана книга')
  const title = String(data.title || '').trim()
  if (!title) return apiError('Укажите название')

  if (!(await belongsToTenant(payload, 'books' as any, id, tenantId))) return apiError('Книга не найдена', 404)

  const patch: any = { title }
  if (typeof data.slug === 'string' && data.slug.trim()) patch.slug = slugify(data.slug) || undefined
  if ('annotation' in data) patch.annotation = htmlToLexical(String(data.annotation || ''))
  if (['ongoing', 'finished', 'frozen'].includes(data.status)) patch.status = data.status
  if (['novel', 'story', 'mini', 'cycle'].includes(data.type)) patch.type = data.type
  if (['12', '16', '18'].includes(String(data.ageRating))) patch.ageRating = String(data.ageRating)
  patch.allowComments = data.allowComments !== false && data.allowComments !== '0' && data.allowComments !== 'false'
  patch.allowDownload = data.allowDownload === true || data.allowDownload === '1' || data.allowDownload === 'true'
  if ('cycleOrder' in data) {
    const n = Number(data.cycleOrder)
    patch.cycleOrder = Number.isFinite(n) && n >= 0 ? n : null
  }
  if ('cycleId' in data) {
    patch.cycle = data.cycleId && Number(data.cycleId) !== Number(id) && (await belongsToTenant(payload, 'books' as any, data.cycleId, tenantId))
      ? Number(data.cycleId) : null
  }
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

  const strField = (k: string) => {
    if (k in data) patch[k] = typeof data[k] === 'string' && data[k].trim() ? data[k].trim() : null
  }
  ;['quote1', 'quote2', 'quote3'].forEach(strField)
  if ('genres' in data) {
    patch.genres = Array.isArray(data.genres)
      ? (data.genres as unknown[]).filter((g): g is string => typeof g === 'string' && g.trim().length > 0).join(', ') || null
      : (typeof data.genres === 'string' && data.genres.trim() ? data.genres.trim() : null)
  }
  if ('booktrailerVideoId' in data) {
    patch.booktrailerVideo = data.booktrailerVideoId && (await belongsToTenant(payload, 'videos', data.booktrailerVideoId, tenantId))
      ? Number(data.booktrailerVideoId) : null
  }

  try {
    await payload.update({ collection: 'books' as any, id, data: patch as any, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить книгу'))
  }
})
