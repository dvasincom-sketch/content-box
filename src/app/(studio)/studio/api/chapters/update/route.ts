import { withAuthor, readJson, apiError, apiOk, belongsToTenant, ownsForContributor } from '@/app/(studio)/studio/api/_lib'
import { htmlToLexical } from '@/lib/lexical'
import { errorMessage } from '@/lib/errorMessage'
import { wordCountFromHtml } from '../_wordcount'

/**
 * Обновление главы.
 * Body: { id, title?, body(html)?, isPreview?, minTierId?, order? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const id = data.id
  if (!(await ownsForContributor(payload, 'chapters' as any, id, author))) return apiError('Нет доступа к чужому контенту', 403)
  if (!id) return apiError('Не указана глава')
  if (!(await belongsToTenant(payload, 'chapters' as any, id, tenantId))) return apiError('Глава не найдена', 404)

  const patch: any = {}
  if (typeof data.title === 'string') {
    if (!data.title.trim()) return apiError('Укажите заголовок главы')
    patch.title = data.title.trim()
  }
  if ('body' in data) {
    const html = String(data.body || '')
    patch.body = htmlToLexical(html)
    patch.wordCount = wordCountFromHtml(html)
  }
  if ('isPreview' in data) patch.isPreview = data.isPreview === true || data.isPreview === '1' || data.isPreview === 'true'
  if ('order' in data) {
    const n = Number(data.order)
    if (Number.isFinite(n) && n > 0) patch.order = n
  }
  if ('minTierId' in data) {
    patch.minTier = data.minTierId && (await belongsToTenant(payload, 'subscription-tiers', data.minTierId, tenantId))
      ? Number(data.minTierId) : null
  }

  try {
    await payload.update({ collection: 'chapters' as any, id, data: patch as any, overrideAccess: true })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить главу'))
  }
})
