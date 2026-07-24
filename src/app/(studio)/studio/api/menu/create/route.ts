import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'

const MAX_DEPTH = 4

/**
 * Создание ручного пункта меню (страница или внешний URL).
 *
 * Body:
 *   { location, kind: 'page', pageId, labelOverride?, parentId?, parentCategoryId?, order? }
 *   { location, kind: 'url', url, labelOverride (обязателен), parentId?, parentCategoryId?, order? }
 *
 * Родитель:
 *   - parentId — ссылка на menu-items (ручной пункт-родитель ИЛИ уже
 *     материализованный оверрайд категории).
 *   - parentCategoryId — id категории-родителя. Если её оверрайд ещё не
 *     материализован, создаём его (ленивая материализация) и вешаем пункт под
 *     него. Приоритет у parentId, если заданы оба.
 *   - оба пусты → корневой уровень.
 * Родитель обязан принадлежать тому же тенанту и тому же location.
 * Глубина ограничена MAX_DEPTH.
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const location = data.location === 'footer' ? 'footer' : 'header'
  const kind = data.kind
  if (kind !== 'page' && kind !== 'url') {
    return apiError('Некорректный тип пункта')
  }

  const newData: any = {
    tenant: tenantId,
    location,
    kind,
    hidden: false,
    order: 'order' in data && data.order != null ? Number(data.order) : 0,
  }

  // --- Источник пункта -------------------------------------------------------
  if (kind === 'page') {
    if (!data.pageId) {
      return apiError('Не указана страница')
    }
    const pageOk = await belongsToTenant(payload, 'pages', data.pageId, tenantId)
    if (!pageOk) return apiError('Страница не найдена', 404)
    newData.page = Number(data.pageId)
    if (typeof data.labelOverride === 'string' && data.labelOverride.trim()) {
      newData.labelOverride = data.labelOverride.trim()
    }
  } else {
    const url = typeof data.url === 'string' ? data.url.trim() : ''
    if (!url) return apiError('Не указан URL')
    const label = typeof data.labelOverride === 'string' ? data.labelOverride.trim() : ''
    if (!label) {
      return apiError('Для внешней ссылки укажите название')
    }
    newData.url = url
    newData.labelOverride = label
  }

  // --- Родитель --------------------------------------------------------------
  // Определяем итоговый parent (menu-items id) из parentId ИЛИ parentCategoryId.
  let parentItemId: number | null = null

  if (data.parentId != null) {
    // Явный parent — ручной пункт или уже материализованный оверрайд.
    const parent = await getMenuItem(payload, data.parentId, tenantId)
    if (!parent) {
      return apiError('Родитель не найден')
    }
    if (parent.location !== location) {
      return apiError('Родитель принадлежит другому меню')
    }
    parentItemId = Number(data.parentId)
  } else if (data.parentCategoryId != null) {
    // Родитель — категория: материализуем её оверрайд, если нужно.
    const catOk = await belongsToTenant(payload, 'categories', data.parentCategoryId, tenantId)
    if (!catOk) {
      return apiError('Категория-родитель не найдена')
    }
    parentItemId = await materializeCategory(
      payload,
      tenantId,
      location,
      Number(data.parentCategoryId),
    )
  }

  if (parentItemId != null) {
    const parentDepth = await depthOf(payload, parentItemId, tenantId)
    if (parentDepth + 1 > MAX_DEPTH) {
      return apiError(`Превышена максимальная вложенность (${MAX_DEPTH} уровня)`)
    }
    newData.parent = parentItemId
  }

  try {
    const created = await payload.create({
      collection: 'menu-items',
      data: newData,
      overrideAccess: true,
    })
    return apiOk({ id: (created as any).id })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось создать пункт')
  }
})

/** Материализует оверрайд авто-категории (или возвращает id существующего). */
async function materializeCategory(
  payload: any,
  tenantId: number,
  location: string,
  categoryId: number,
): Promise<number> {
  const existing = await payload.find({
    collection: 'menu-items',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { location: { equals: location } },
        { kind: { equals: 'category' } },
        { category: { equals: categoryId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const found = existing.docs[0] as any
  if (found) return found.id
  const created = await payload.create({
    collection: 'menu-items',
    data: {
      tenant: tenantId,
      location,
      kind: 'category',
      category: categoryId,
      hidden: false,
      order: 0,
      labelOverride: null,
    },
    overrideAccess: true,
  })
  return (created as any).id
}

/** Глубина узла menu-items: 1 = корень. Идём вверх по parent. */
async function depthOf(
  payload: any,
  id: number,
  tenantId: number,
): Promise<number> {
  let depth = 1
  let currentId: number | null = id
  let guard = 0
  while (currentId != null && guard < 1000) {
    const doc = await getMenuItem(payload, currentId, tenantId)
    if (!doc) break
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    if (p == null) break
    depth += 1
    currentId = Number(p)
    guard += 1
  }
  return depth
}

/** menu-item по id с проверкой принадлежности тенанту. */
async function getMenuItem(
  payload: any,
  id: string | number,
  tenantId: number,
): Promise<any | null> {
  try {
    const doc = await payload.findByID({
      collection: 'menu-items',
      id,
      depth: 0,
      overrideAccess: true,
    })
    const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
    if (Number(t) !== Number(tenantId)) return null
    return doc
  } catch {
    return null
  }
}
