import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { htmlToLexical } from '@/lib/lexical'
import { errorMessage } from '@/lib/errorMessage'
import type { Payload, CollectionSlug } from 'payload'

/**
 * Обновление публикации. Проверяем, что пост принадлежит тенанту автора.
 * Статус меняется через publish:
 *   - publish=true  → publishedAt = now (если ещё не был опубликован)
 *   - publish=false → publishedAt = null (снять с публикации → черновик)
 *   - publish не передан → publishedAt не трогаем
 *
 * Body: { id, title, body, coverId?, categoryId?, minTierId?, relatedVideoIds?, publish? }
 * Значения coverId/categoryId/minTierId:
 *   - число  → установить
 *   - null   → очистить поле
 *   - undefined/отсутствует → не трогать
 * relatedVideoIds:
 *   - массив → заменить набор прикреплённых видео (порядок значим; фильтр по тенанту)
 *   - отсутствует → не трогать
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана публикация')

  // Пост принадлежит тенанту?
  const existing: any = await payload
    .findByID({ collection: 'publications', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!existing) return apiError('Публикация не найдена', 404)
  const postTenant =
    existing.tenant && typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant
  if (Number(postTenant) !== Number(tenantId)) {
    return apiError('Публикация не найдена', 404)
  }

  const patch: any = {}

  if (typeof data.title === 'string') {
    const title = data.title.trim()
    if (!title) return apiError('Укажите заголовок')
    patch.title = title
    // slug не трогаем автоматически при редактировании — он уже есть и может быть в ссылках
  }

  if (typeof data.body === 'string') {
    patch.description = htmlToLexical(data.body)
  }

  // Связи: null очищает, число ставит (с проверкой тенанта), undefined пропускает
  if ('categoryId' in data) {
    patch.category = await resolveRel(payload, 'categories', data.categoryId, tenantId)
  }
  if ('minTierId' in data) {
    patch.minTier = await resolveRel(payload, 'subscription-tiers', data.minTierId, tenantId)
  }
  if ('coverId' in data) {
    patch.cover = await resolveRel(payload, 'media', data.coverId, tenantId)
  }

  // Дополнительные категории: если ключ передан — заменяем набор целиком
  // (пустой = очистить). Исключаем основную, чтобы не дублировалась.
  if ('extraCategoryIds' in data) {
    const primaryId =
      'categoryId' in data
        ? (patch.category ?? undefined)
        : existing.category && typeof existing.category === 'object'
          ? existing.category.id
          : existing.category ?? undefined
    patch.extraCategories = await filterTenantCategories(
      payload,
      data.extraCategoryIds,
      tenantId,
      primaryId != null ? Number(primaryId) : undefined,
    )
  }

  // Прикреплённые видео: если ключ передан — заменяем набор целиком (пустой = открепить все)
  if ('relatedVideoIds' in data) {
    patch.relatedVideos = await filterTenantVideos(payload, data.relatedVideoIds, tenantId)
  }

  // Галерея: если ключ передан — заменяем целиком (пустой массив = очистить)
  if ('gallery' in data) {
    patch.gallery = await buildGallery(payload, data.gallery, tenantId)
  }

  // Признак «Новость»
  if ('isNews' in data) {
    patch.isNews = Boolean(data.isNews)
  }

  // Признак «Новинка». Окно newUntil проставит/снимет хук коллекции.
  if ('isNew' in data) {
    patch.isNew = Boolean(data.isNew)
  }

  // Свободные теги: если ключ передан — заменяем набор (пустой = очистить).
  // slug и дедуп посчитает хук normalizeTags коллекции.
  if ('tags' in data) {
    patch.tags = Array.isArray(data.tags)
      ? (data.tags as unknown[])
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => ({ label: t.trim() }))
      : []
  }

  // Статус
  if (data.publish === true) {
    // публикуем: ставим дату, если её не было
    if (!existing.publishedAt) patch.publishedAt = new Date().toISOString()
  } else if (data.publish === false) {
    // снимаем с публикации → черновик
    patch.publishedAt = null
  }

  try {
    await payload.update({
      collection: 'publications',
      id,
      data: patch,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить'))
  }
})

/**
 * null → null (очистить); число → проверить тенант, вернуть число или null;
 * прочее → null.
 */
async function resolveRel(
  payload: Payload,
  collection: CollectionSlug,
  value: unknown,
  tenantId: number,
): Promise<number | null> {
  if (value == null) return null
  try {
    const doc = await payload.findByID({ collection, id: value as number, depth: 0, overrideAccess: true })
    // `tenant` есть не у всех коллекций объединения, поэтому читаем структурно.
    const rel = (doc as { tenant?: unknown })?.tenant
    const t = rel && typeof rel === 'object' ? (rel as { id?: unknown }).id : rel
    return Number(t) === Number(tenantId) ? Number(value) : null
  } catch {
    return null
  }
}

/**
 * Из массива id категорий оставляет только принадлежащие тенанту, в исходном
 * порядке, без дублей и без основной (excludeId). Для extraCategories.
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
    try {
      const doc = await payload.findByID({
        collection: 'categories',
        id: cid,
        depth: 0,
        overrideAccess: true,
      })
      const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
      if (Number(t) === Number(tenantId)) {
        seen.add(cid)
        out.push(cid)
      }
    } catch {
      // категория не найдена — пропускаем
    }
  }
  return out
}

/**
 * Из массива id видео оставляет только принадлежащие тенанту, в исходном
 * порядке, без дублей. Возвращает массив number для relatedVideos.
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
    try {
      const doc = await payload.findByID({
        collection: 'videos',
        id: vid,
        depth: 0,
        overrideAccess: true,
      })
      const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
      if (Number(t) === Number(tenantId)) {
        seen.add(vid)
        out.push(vid)
      }
    } catch {
      // видео не найдено — пропускаем
    }
  }
  return out
}

/**
 * Из массива {imageId, caption} строит строки галереи {image, caption},
 * оставляя только изображения тенанта, в исходном порядке.
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
