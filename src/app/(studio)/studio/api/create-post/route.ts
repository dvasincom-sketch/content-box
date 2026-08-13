import { withAuthor, readJson, apiError, apiOk, belongsToTenant, authorCan } from '@/app/(studio)/studio/api/_lib'
import { htmlToLexical } from '@/lib/lexical'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'
import type { Payload } from 'payload'

/**
 * Создание публикации. Паттерн как у register-subscriber: серверный роут +
 * Local API, БЕЗ прямого доступа к БД.
 *
 * Безопасность:
 *  - автор берётся из сессии (getCurrentAuthor) — не из тела запроса;
 *  - tenant проставляется из author.tenantId, клиент не может его подделать;
 *  - категория/уровень/видео проверяются на принадлежность тому же тенанту.
 *
 * Body (JSON):
 *  { title, body, slug?, coverId?, categoryId?, minTierId?, relatedVideoIds?, publish }
 *  publish=true → publishedAt=now (опубликовано); false → черновик (без даты).
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'posts', 'create')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const title = (data.title || '').trim()
  if (!title) {
    return apiError('Укажите заголовок')
  }

  // slug: из тела или авто из заголовка; гарантируем уникальность в тенанте
  const baseSlug = slugify(data.slug || title) || 'post'
  const slug = await ensureUniqueSlug(payload, tenantId, baseSlug)

  // Проверка, что категория принадлежит тенанту автора
  let categoryId: number | undefined
  if (data.categoryId) {
    const ok = await belongsToTenant(payload, 'categories', data.categoryId, tenantId)
    if (ok) categoryId = Number(data.categoryId)
  }

  // Дополнительные категории: только принадлежащие тенанту, без дублей и без
  // основной (её роль отдельная). Порядок сохраняем.
  const extraCategoryIds = await filterTenantCategories(
    payload,
    data.extraCategoryIds,
    tenantId,
    categoryId,
  )

  // Проверка, что уровень принадлежит тенанту автора
  let minTierId: number | undefined
  if (data.minTierId) {
    const ok = await belongsToTenant(payload, 'subscription-tiers', data.minTierId, tenantId)
    if (ok) minTierId = Number(data.minTierId)
  }

  // Проверка обложки (media тоже tenant-scoped)
  let coverId: number | undefined
  if (data.coverId) {
    const ok = await belongsToTenant(payload, 'media', data.coverId, tenantId)
    if (ok) coverId = Number(data.coverId)
  }

  // Прикреплённые видео: фильтруем по тенанту, сохраняем порядок, убираем дубли
  const relatedVideos = await filterTenantVideos(payload, data.relatedVideoIds, tenantId)

  // Галерея: массив {imageId, caption} → строки {image, caption} с проверкой тенанта
  const gallery = await buildGallery(payload, data.gallery, tenantId)

  const publish = data.publish === true

  try {
    const doc = await payload.create({
      collection: 'publications',
      data: {
        title,
        slug,
        tenant: tenantId,
        owner: author.user.id,
        description: htmlToLexical(data.body || ''),
        ...(categoryId ? { category: categoryId } : {}),
        ...(extraCategoryIds.length ? { extraCategories: extraCategoryIds } : {}),
        ...(minTierId ? { minTier: minTierId } : {}),
        ...(coverId ? { cover: coverId } : {}),
        ...(relatedVideos.length ? { relatedVideos } : {}),
        ...(gallery.length ? { gallery } : {}),
        ...(data.isNews ? { isNews: true } : {}),
        ...(data.isNew ? { isNew: true } : {}),
        template: data.template === 'profile' ? 'profile' : 'article',
        ...((data.profile && typeof data.profile === 'object' && !Array.isArray(data.profile)) ? { profile: data.profile } : {}),
        ...(Array.isArray(data.tags) && data.tags.length
          ? {
              tags: (data.tags as unknown[])
                .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
                .map((t) => ({ label: t.trim() })),
            }
          : {}),
        ...(data.eventDate && !Number.isNaN(Date.parse(data.eventDate)) ? { eventDate: new Date(data.eventDate).toISOString() } : {}),
        ...(publish ? { publishedAt: new Date().toISOString() } : {}),
      } as any,
      overrideAccess: true,
    })

    return apiOk({ id: doc.id, slug })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить публикацию'), 500)
  }
})

/**
 * Из массива id видео оставляет только принадлежащие тенанту, в исходном
 * порядке, без дублей. Возвращает массив number, готовый для relatedVideos.
 */
async function filterTenantVideos(
  payload: Payload,
  ids: any,
  tenantId: number,
): Promise<number[]> {
  if (!Array.isArray(ids) || ids.length === 0) return []
  const seen = new Set<number>()
  const out: number[] = []
  for (const raw of ids) {
    const vid = Number(raw)
    if (!Number.isFinite(vid) || seen.has(vid)) continue
    const ok = await belongsToTenant(payload, 'videos', vid, tenantId)
    if (ok) {
      seen.add(vid)
      out.push(vid)
    }
  }
  return out
}

/**
 * Из массива id категорий оставляет только принадлежащие тенанту, в исходном
 * порядке, без дублей и без основной категории (excludeId). Для extraCategories.
 */
async function filterTenantCategories(
  payload: Payload,
  ids: any,
  tenantId: number,
  excludeId?: number,
): Promise<number[]> {
  if (!Array.isArray(ids) || ids.length === 0) return []
  const seen = new Set<number>()
  const out: number[] = []
  for (const raw of ids) {
    const cid = Number(raw)
    if (!Number.isFinite(cid) || seen.has(cid) || cid === excludeId) continue
    const ok = await belongsToTenant(payload, 'categories', cid, tenantId)
    if (ok) {
      seen.add(cid)
      out.push(cid)
    }
  }
  return out
}

/**
 * Из массива {imageId, caption} строит строки галереи {image, caption},
 * оставляя только изображения тенанта, в исходном порядке. Дубли допускаются
 * (одно фото может встречаться дважды намеренно — но обычно нет; не режем).
 */
async function buildGallery(
  payload: Payload,
  rows: any,
  tenantId: number,
): Promise<{ image: number; caption?: string }[]> {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const out: { image: number; caption?: string }[] = []
  for (const r of rows) {
    const imageId = Number(r?.imageId)
    if (!Number.isFinite(imageId)) continue
    try {
      const doc = await payload.findByID({
        collection: 'gallery-images',
        id: imageId,
        depth: 0,
        overrideAccess: true,
      })
      const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
      if (Number(t) === Number(tenantId)) {
        const caption = typeof r?.caption === 'string' ? r.caption.trim() : ''
        out.push({ image: imageId, ...(caption ? { caption } : {}) })
      }
    } catch {
      // изображение не найдено — пропускаем
    }
  }
  return out
}

/** Делает slug уникальным в пределах тенанта: post, post-2, post-3... */
async function ensureUniqueSlug(
  payload: Payload,
  tenantId: number,
  base: string,
): Promise<string> {
  let candidate = base
  let n = 1
  // предохранитель от бесконечного цикла
  while (n < 100) {
    const res = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: candidate } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (res.totalDocs === 0) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
  return `${base}-${Date.now()}`
}
