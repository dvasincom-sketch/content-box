import { withAuthor, apiError, apiOk, findTenantSettings, belongsToTenant, authorCan } from '../../_lib'
import type { Payload } from 'payload'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'
import { generateImageSeo, type SeoImageIn, type SeoContext } from '@/lib/asyaImageSeo'
import { logAiUsage, estimateTokens } from '@/lib/logAiUsage'
import { costRub } from '@/lib/aiPricing'

/**
 * SEO для фото галереи: по контексту публикации Ася придумывает уникальные alt
 * и slug для выбранных изображений. НЕ сохраняет — возвращает предложения, автор
 * правит и сохраняет через set-alt. Файлы существующих фото не переименовываем.
 *  POST { ids:[...], publicationId?, section? } → { ok, items:[{id,alt,slug}] }
 */
export const runtime = 'nodejs'
export const maxDuration = 120

async function tenantComposeKey(payload: Payload, tenantId: number): Promise<string> {
  try {
    const s = await findTenantSettings(payload, tenantId)
    const k = String((s as { aiComposeKey?: unknown } | null)?.aiComposeKey || '').trim()
    if (k) return k
  } catch { /* ignore */ }
  return (process.env.ASYA_COMPOSE_KEY || '').trim()
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'gallery', 'edit')) return apiError('Недостаточно прав', 403)
  const key = await tenantComposeKey(payload, tenantId)
  if (!key) return apiError('AI-ассистент не подключён', 503)

  const rl = rateLimit(`imgseo:${clientIp(req.headers)}`, 20, 60_000)
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Слишком часто. Подождите немного.')

  let data: { ids?: unknown; publicationId?: unknown; section?: unknown } | undefined
  try { data = await req.json() } catch { data = undefined }
  if (data === undefined) return apiError('Некорректный запрос')

  const ids = (Array.isArray(data.ids) ? data.ids : []).map((x) => String(x)).filter(Boolean).slice(0, 40)
  if (!ids.length) return apiError('Не выбраны изображения')

  // Собираем изображения тенанта: id, имя файла, текущий alt.
  const images: SeoImageIn[] = []
  let pubFromImg: number | null = null
  for (const id of ids) {
    try {
      const doc = await payload.findByID({ collection: 'gallery-images', id, depth: 0, overrideAccess: true }) as {
        tenant?: unknown; filename?: unknown; alt?: unknown; sourcePublication?: unknown
      }
      const t = doc?.tenant && typeof doc.tenant === 'object' ? (doc.tenant as { id?: unknown }).id : doc?.tenant
      if (Number(t) !== Number(tenantId)) continue
      images.push({ id, filename: String(doc.filename || ''), alt: String(doc.alt || '') })
      if (pubFromImg == null && doc.sourcePublication != null) {
        const sp = typeof doc.sourcePublication === 'object' ? (doc.sourcePublication as { id?: unknown }).id : doc.sourcePublication
        if (sp != null) pubFromImg = Number(sp)
      }
    } catch { /* пропускаем недоступные */ }
  }
  if (!images.length) return apiError('Изображения не найдены')

  // Контекст: из явной публикации или из sourcePublication изображений.
  const context: SeoContext = { lang: 'ru' }
  const pubId = data.publicationId != null && String(data.publicationId) !== '' ? Number(data.publicationId) : pubFromImg
  if (pubId && await belongsToTenant(payload, 'publications', pubId, tenantId)) {
    try {
      const pub = await payload.findByID({ collection: 'publications', id: pubId, depth: 1, overrideAccess: true }) as {
        title?: unknown; category?: unknown; categories?: unknown
      }
      context.title = String(pub.title || '')
      const tags: string[] = []
      const catTitle = (c: unknown) => (c && typeof c === 'object' ? String((c as { title?: unknown }).title || '') : '')
      const main = catTitle(pub.category)
      if (main) tags.push(main)
      if (Array.isArray(pub.categories)) for (const c of pub.categories) { const t = catTitle(c); if (t) tags.push(t) }
      if (tags.length) context.tags = Array.from(new Set(tags)).slice(0, 8)
    } catch { /* ignore */ }
  }
  if (typeof data.section === 'string' && data.section.trim()) context.section = data.section.trim().slice(0, 120)

  try {
    const r = await generateImageSeo(key, { context, images })
    const tokensIn = estimateTokens(JSON.stringify(context), JSON.stringify(images))
    const tokensOut = estimateTokens(JSON.stringify(r.items))
    void logAiUsage(payload, {
      tenant: tenantId, surface: 'compose', action: 'image-seo',
      tokensIn, tokensOut, actorType: 'author', meta: `${r.items.length} alt`,
    })
    return apiOk({ items: r.items, tokensIn, tokensOut, costRub: costRub(tokensIn, tokensOut) })
  } catch (e) {
    return apiError('Не удалось сгенерировать: ' + (e instanceof Error ? e.message : String(e)), 502)
  }
})
