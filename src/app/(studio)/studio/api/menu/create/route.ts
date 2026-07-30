import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import type { Payload } from 'payload'

/** Где живёт пункт меню. Совпадает с enum поля `location` в коллекции. */
type MenuLocation = 'header' | 'footer'

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

  // Явный order из тела — если задан. Иначе посчитаем «в конец уровня» ПОСЛЕ
  // резолва родителя (порядок зависит от того, на каком уровне окажется пункт).
  const explicitOrder = 'order' in data && data.order != null ? Number(data.order) : null

  const newData: any = {
    tenant: tenantId,
    location,
    kind,
    hidden: false,
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

  // По умолчанию — в конец своего уровня (не в середину). При равных порядках
  // стабильная сортировка роняла новый пункт вверх; теперь берём max+1.
  newData.order =
    explicitOrder != null
      ? explicitOrder
      : await nextOrderForLevel(payload, tenantId, location, parentItemId)

  try {
    const created = await payload.create({
      collection: 'menu-items',
      data: newData,
      overrideAccess: true,
    })
    return apiOk({ id: (created as any).id })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать пункт'))
  }
})

/** Материализует оверрайд авто-категории (или возвращает id существующего). */
async function materializeCategory(
  payload: Payload,
  tenantId: number,
  location: MenuLocation,
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
  // Порядок оверрайда = текущий порядок самой категории, иначе материализация
  // родителя (при добавлении под него дочернего пункта) сбрасывала бы позицию
  // категории в 0 и утаскивала её в начало своего уровня.
  const cat = await payload
    .findByID({ collection: 'categories', id: categoryId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const created = await payload.create({
    collection: 'menu-items',
    data: {
      tenant: tenantId,
      location,
      kind: 'category',
      category: categoryId,
      hidden: false,
      order: typeof (cat as any)?.order === 'number' ? (cat as any).order : 0,
      labelOverride: null,
    },
    overrideAccess: true,
  })
  return (created as any).id
}

/**
 * Порядок нового пункта — В КОНЕЦ своего уровня (max соседей + 1).
 * Соседи уровня — это и menu-items (ручные пункты + материализованные
 * оверрайды категорий) с тем же parent, и авто-категории уровня (их порядок
 * живёт в Category.order). Берём максимум по всем, чтобы новый пункт встал
 * гарантированно после последнего, а не в середину.
 */
async function nextOrderForLevel(
  payload: Payload,
  tenantId: number,
  location: MenuLocation,
  parentItemId: number | null,
): Promise<number> {
  const orders: number[] = []

  const items = await payload.find({
    collection: 'menu-items',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { location: { equals: location } },
        parentItemId == null
          ? { parent: { exists: false } }
          : { parent: { equals: parentItemId } },
      ],
    },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  for (const it of items.docs as any[]) {
    if (typeof it.order === 'number') orders.push(it.order)
  }

  if (parentItemId == null) {
    // Корневой уровень: авто-категории с флагом шапки/футера.
    const rootFlag = location === 'header' ? 'showInHeader' : 'showInFooter'
    const cats = await payload.find({
      collection: 'categories',
      where: { and: [{ tenant: { equals: tenantId } }, { [rootFlag]: { equals: true } }] },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    for (const c of cats.docs as any[]) orders.push(typeof c.order === 'number' ? c.order : 0)
  } else {
    // Под оверрайдом категории соседи — её дочерние категории. Под ручным
    // пунктом (page/url) авто-категорий не бывает.
    const parentItem = await getMenuItem(payload, parentItemId, tenantId)
    const parentCatId =
      parentItem?.kind === 'category'
        ? parentItem.category && typeof parentItem.category === 'object'
          ? parentItem.category.id
          : parentItem?.category
        : null
    if (parentCatId != null) {
      const cats = await payload.find({
        collection: 'categories',
        where: { and: [{ tenant: { equals: tenantId } }, { parent: { equals: parentCatId } }] },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      for (const c of cats.docs as any[]) orders.push(typeof c.order === 'number' ? c.order : 0)
    }
  }

  return orders.length ? Math.max(...orders) + 1 : 0
}

/** Глубина узла menu-items: 1 = корень. Идём вверх по parent. */
async function depthOf(
  payload: Payload,
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
  payload: Payload,
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
