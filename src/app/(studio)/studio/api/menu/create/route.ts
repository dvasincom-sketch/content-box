import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

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
export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const location = data.location === 'footer' ? 'footer' : 'header'
  const kind = data.kind
  if (kind !== 'page' && kind !== 'url') {
    return NextResponse.json({ error: 'Некорректный тип пункта' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

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
      return NextResponse.json({ error: 'Не указана страница' }, { status: 400 })
    }
    const pageOk = await belongsToTenant(payload, 'pages', data.pageId, tenantId)
    if (!pageOk) return NextResponse.json({ error: 'Страница не найдена' }, { status: 404 })
    newData.page = Number(data.pageId)
    if (typeof data.labelOverride === 'string' && data.labelOverride.trim()) {
      newData.labelOverride = data.labelOverride.trim()
    }
  } else {
    const url = typeof data.url === 'string' ? data.url.trim() : ''
    if (!url) return NextResponse.json({ error: 'Не указан URL' }, { status: 400 })
    const label = typeof data.labelOverride === 'string' ? data.labelOverride.trim() : ''
    if (!label) {
      return NextResponse.json(
        { error: 'Для внешней ссылки укажите название' },
        { status: 400 },
      )
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
      return NextResponse.json({ error: 'Родитель не найден' }, { status: 400 })
    }
    if (parent.location !== location) {
      return NextResponse.json(
        { error: 'Родитель принадлежит другому меню' },
        { status: 400 },
      )
    }
    parentItemId = Number(data.parentId)
  } else if (data.parentCategoryId != null) {
    // Родитель — категория: материализуем её оверрайд, если нужно.
    const catOk = await belongsToTenant(payload, 'categories', data.parentCategoryId, tenantId)
    if (!catOk) {
      return NextResponse.json({ error: 'Категория-родитель не найдена' }, { status: 400 })
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
      return NextResponse.json(
        { error: `Превышена максимальная вложенность (${MAX_DEPTH} уровня)` },
        { status: 400 },
      )
    }
    newData.parent = parentItemId
  }

  try {
    const created = await payload.create({
      collection: 'menu-items',
      data: newData,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: (created as any).id })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось создать пункт' },
      { status: 400 },
    )
  }
}

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

async function belongsToTenant(
  payload: any,
  collection: string,
  id: string | number,
  tenantId: number,
): Promise<boolean> {
  try {
    const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
    return Number(t) === Number(tenantId)
  } catch {
    return false
  }
}
