import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

const MAX_DEPTH = 4

/**
 * Batch-переупорядочивание меню после drag-and-drop.
 *
 * Body: { location, ops: [ { key, order, parentKey } ] }
 *   key/parentKey: 'cat:<categoryId>' | 'item:<menuItemId>' | (parentKey: null → корень)
 *
 * Правила (модель 3a):
 *  - Авто-категория (cat:*): пишем ТОЛЬКО order (материализуя оверрайд при
 *    необходимости). Смену уровня игнорируем — место держит таксономия.
 *  - Ручной пункт (item:*): пишем order И parent. Если новый родитель —
 *    авто-категория без оверрайда, материализуем её (parent ссылается на
 *    menu-items.id). Проверяем тенант, location, цикл, глубину ≤ MAX_DEPTH.
 *
 * Сначала ПОЛНАЯ валидация всех операций, затем запись — чтобы при ошибке
 * не осталось частично применённого состояния.
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
  const ops = Array.isArray(data.ops) ? data.ops : null
  if (!ops) return NextResponse.json({ error: 'Нет операций' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  const parseKey = (key: any): { type: 'cat' | 'item'; id: number } | null => {
    if (typeof key !== 'string') return null
    const [type, raw] = key.split(':')
    const id = Number(raw)
    if ((type !== 'cat' && type !== 'item') || !Number.isFinite(id)) return null
    return { type, id }
  }

  // Кэш загруженных сущностей, чтобы не бить в БД повторно.
  const catCache = new Map<number, any>()
  const itemCache = new Map<number, any>()

  const loadCat = async (id: number) => {
    if (catCache.has(id)) return catCache.get(id)
    const doc = await payload
      .findByID({ collection: 'categories', id, depth: 0, overrideAccess: true })
      .catch(() => null)
    catCache.set(id, doc)
    return doc
  }
  const loadItem = async (id: number) => {
    if (itemCache.has(id)) return itemCache.get(id)
    const doc = await payload
      .findByID({ collection: 'menu-items', id, depth: 0, overrideAccess: true })
      .catch(() => null)
    itemCache.set(id, doc)
    return doc
  }
  const tenantOf = (doc: any): number | null => {
    const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
    return t == null ? null : Number(t)
  }

  // --- Фаза 1: валидация + резолв --------------------------------------------

  type Plan = {
    self: { type: 'cat' | 'item'; id: number }
    order: number
    parentKey: { type: 'cat' | 'item'; id: number } | null
  }
  const plans: Plan[] = []

  for (const op of ops) {
    const self = parseKey(op?.key)
    if (!self) return NextResponse.json({ error: 'Некорректный ключ узла' }, { status: 400 })
    const order = Number(op?.order)
    if (!Number.isFinite(order)) {
      return NextResponse.json({ error: 'Некорректный порядок' }, { status: 400 })
    }

    // Узел принадлежит тенанту?
    if (self.type === 'cat') {
      const cat = await loadCat(self.id)
      if (!cat || tenantOf(cat) !== tenantId) {
        return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
      }
    } else {
      const item = await loadItem(self.id)
      if (!item || tenantOf(item) !== tenantId) {
        return NextResponse.json({ error: 'Пункт не найден' }, { status: 404 })
      }
      if (item.location !== location) {
        return NextResponse.json({ error: 'Пункт из другого меню' }, { status: 400 })
      }
    }

    const parentKey = op?.parentKey == null ? null : parseKey(op.parentKey)
    if (op?.parentKey != null && !parentKey) {
      return NextResponse.json({ error: 'Некорректный ключ родителя' }, { status: 400 })
    }

    // Для ручных пунктов проверяем родителя (тенант, location, цикл, глубина).
    if (self.type === 'item' && parentKey) {
      // Родитель-категория.
      if (parentKey.type === 'cat') {
        const pcat = await loadCat(parentKey.id)
        if (!pcat || tenantOf(pcat) !== tenantId) {
          return NextResponse.json({ error: 'Родитель не найден' }, { status: 400 })
        }
      } else {
        // Родитель — menu-item.
        const pitem = await loadItem(parentKey.id)
        if (!pitem || tenantOf(pitem) !== tenantId) {
          return NextResponse.json({ error: 'Родитель не найден' }, { status: 400 })
        }
        if (pitem.location !== location) {
          return NextResponse.json({ error: 'Родитель из другого меню' }, { status: 400 })
        }
        if (parentKey.id === self.id) {
          return NextResponse.json(
            { error: 'Пункт не может быть родителем самого себя' },
            { status: 400 },
          )
        }
        // Цикл: новый родитель не должен быть потомком перемещаемого пункта.
        const cyc = await isDescendantItem(loadItem, parentKey.id, self.id)
        if (cyc) {
          return NextResponse.json(
            { error: 'Нельзя переместить пункт внутрь его собственного потомка' },
            { status: 400 },
          )
        }
        // Глубина: (глубина родителя) + 1 ≤ MAX_DEPTH.
        const pd = await itemDepth(loadItem, parentKey.id)
        if (pd + 1 > MAX_DEPTH) {
          return NextResponse.json(
            { error: `Превышена максимальная вложенность (${MAX_DEPTH} уровня)` },
            { status: 400 },
          )
        }
      }
    }

    plans.push({ self, order, parentKey })
  }

  // --- Фаза 2: применение ----------------------------------------------------

  // Материализация оверрайда авто-категории → возвращает menu-items id.
  const materializeCat = async (catId: number): Promise<number> => {
    const existing = await payload.find({
      collection: 'menu-items',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { location: { equals: location } },
          { kind: { equals: 'category' } },
          { category: { equals: catId } },
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
        category: catId,
        hidden: false,
        order: 0,
        labelOverride: null,
      },
      overrideAccess: true,
    })
    return (created as any).id
  }

  try {
    for (const plan of plans) {
      if (plan.self.type === 'cat') {
        // Авто-категория: только order, через материализацию оверрайда.
        const ovId = await materializeCat(plan.self.id)
        await payload.update({
          collection: 'menu-items',
          id: ovId,
          data: { order: plan.order },
          overrideAccess: true,
        })
      } else {
        // Ручной пункт: order + parent.
        let parentItemId: number | null = null
        if (plan.parentKey) {
          parentItemId =
            plan.parentKey.type === 'cat'
              ? await materializeCat(plan.parentKey.id)
              : plan.parentKey.id
        }
        await payload.update({
          collection: 'menu-items',
          id: plan.self.id,
          data: { order: plan.order, parent: parentItemId },
          overrideAccess: true,
        })
      }
    }
    return NextResponse.json({ ok: true, count: plans.length })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сохранить порядок' },
      { status: 400 },
    )
  }
}

/** Глубина menu-item: 1 = корень. Идём вверх по parent. */
async function itemDepth(
  loadItem: (id: number) => Promise<any>,
  id: number,
): Promise<number> {
  let depth = 1
  let currentId: number | null = id
  let guard = 0
  while (currentId != null && guard < 1000) {
    const doc = await loadItem(currentId)
    if (!doc) break
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    if (p == null) break
    depth += 1
    currentId = Number(p)
    guard += 1
  }
  return depth
}

/** Является ли candidate потомком ancestor (вверх по parent от candidate). */
async function isDescendantItem(
  loadItem: (id: number) => Promise<any>,
  candidateId: number,
  ancestorId: number,
): Promise<boolean> {
  let currentId: number | null = candidateId
  let guard = 0
  while (currentId != null && guard < 1000) {
    if (currentId === ancestorId) return true
    const doc = await loadItem(currentId)
    if (!doc) break
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    currentId = p != null ? Number(p) : null
    guard += 1
  }
  return false
}
