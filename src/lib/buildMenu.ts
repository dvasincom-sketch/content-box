import { getPayload } from 'payload'
import config from '@/payload.config'
import { categoryHref } from '@/lib/categoryHref'

/**
 * Узел меню — форма совместима с прежним lib/headerMenu, чтобы SiteHeader /
 * DesktopMenu / MobileMenu работали без правок.
 */
export type MenuNode = {
  id: number
  title: string
  href: string
  children: MenuNode[]
}

export type MenuLocation = 'header' | 'footer'

const MAX_DEPTH = 4

/**
 * buildMenu — единый сборщик меню для шапки и футера.
 *
 * Модель «ленивой материализации»:
 *  1. База — автоген из категорий (корни: showInHeader/showInFooter; потомки
 *     по parent; глубина ≤ MAX_DEPTH). Порядок — по Category.order.
 *  2. Поверх накладываются оверрайды из коллекции menu-items (location-scoped):
 *      - kind='category' — правка авто-узла по его category.id:
 *          hidden        → узел выкидывается ВМЕСТЕ с поддеревом;
 *          labelOverride → меняет отображаемое имя;
 *          order         → переопределяет Category.order на своём уровне.
 *        (3a) parent авто-категорий НЕ применяется — место в дереве держит
 *        таксономия. Кросс-уровневое перетаскивание — только для ручных пунктов.
 *      - kind='page' / kind='url' — ручные пункты, которых нет в автогене.
 *        Вставляются по своим parent (ссылка на menu-items.id) и order.
 *
 * Один проход по категориям + один по menu-items, сборка в память.
 */
export async function buildMenu(
  tenantID: number,
  location: MenuLocation,
): Promise<MenuNode[]> {
  const payload = await getPayload({ config: await config })

  // Флаг корня зависит от места: шапка — showInHeader, футер — showInFooter.
  const rootFlag = location === 'header' ? 'showInHeader' : 'showInFooter'

  // Все категории тенанта разом (depth:1 — нужны breadcrumbs для href).
  const catsRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: tenantID } },
    sort: 'order',
    limit: 1000,
    depth: 1,
    overrideAccess: true,
  })
  const cats = catsRes.docs as any[]

  // Все оверрайды/ручные пункты этого location.
  const itemsRes = await payload.find({
    collection: 'menu-items',
    where: {
      and: [{ tenant: { equals: tenantID } }, { location: { equals: location } }],
    },
    sort: 'order',
    limit: 1000,
    depth: 1, // подтянуть page (slug) и category у ручных пунктов
    overrideAccess: true,
  })
  const items = itemsRes.docs as any[]

  // --- Индексы ---------------------------------------------------------------

  const idOf = (rel: any): number | null =>
    rel == null ? null : typeof rel === 'object' ? rel.id : rel

  // Оверрайды авто-категорий: category.id → override.
  const catOverride = new Map<number, any>()
  // Ручные пункты (page/url), сгруппированные по их menu-items parent id.
  const manualByParent = new Map<number | null, any[]>()

  for (const it of items) {
    if (it.kind === 'category') {
      const cid = idOf(it.category)
      if (cid != null) catOverride.set(cid, it)
    } else {
      // page | url — ручной пункт
      const pid = idOf(it.parent)
      const bucket = manualByParent.get(pid) ?? []
      bucket.push(it)
      manualByParent.set(pid, bucket)
    }
  }

  // Категории, сгруппированные по родителю (таксономия).
  const catParentOf = (cat: any): number | null => idOf(cat.parent)
  const catsByParent = new Map<number | null, any[]>()
  for (const cat of cats) {
    const pid = catParentOf(cat)
    const bucket = catsByParent.get(pid) ?? []
    bucket.push(cat)
    catsByParent.set(pid, bucket)
  }

  // --- Хелперы отображения ---------------------------------------------------

  const manualLabel = (it: any): string => {
    if (it.labelOverride) return it.labelOverride
    if (it.kind === 'page' && it.page && typeof it.page === 'object') {
      return it.page.title || 'Страница'
    }
    return 'Ссылка'
  }

  const manualHref = (it: any): string => {
    if (it.kind === 'url') return it.url || '#'
    if (it.kind === 'page' && it.page && typeof it.page === 'object') {
      return `/page/${it.page.slug}`
    }
    return '#'
  }

  // Эффективный порядок ручного пункта / авто-узла — для сортировки уровня.
  const orderOfManual = (it: any): number =>
    typeof it.order === 'number' ? it.order : 0

  // --- Сборка ручной ветки (page/url) ---------------------------------------

  const buildManual = (it: any, depth: number): MenuNode => ({
    id: it.id,
    title: manualLabel(it),
    href: manualHref(it),
    children:
      depth >= MAX_DEPTH
        ? []
        : (manualByParent.get(it.id) ?? [])
            .slice()
            .sort((a, b) => orderOfManual(a) - orderOfManual(b))
            .map((child) => buildManual(child, depth + 1)),
  })

  // --- Сборка авто-узла категории (с оверрайдом) ----------------------------

  const buildCat = (cat: any, depth: number): MenuNode | null => {
    const ov = catOverride.get(cat.id)
    if (ov?.hidden) return null // скрыл раздел — скрылось всё под ним

    const title = ov?.labelOverride || cat.title
    const childCats = depth >= MAX_DEPTH ? [] : catsByParent.get(cat.id) ?? []

    // Дети-категории (с их оверрайдами), затем ручные пункты, подвешенные
    // под ОВЕРРАЙД этой категории (если он материализован).
    const childNodes: MenuNode[] = []

    for (const child of childCats) {
      const node = buildCat(child, depth + 1)
      if (node) childNodes.push({ ...node, _order: effectiveOrder(child) } as any)
    }

    // Ручные пункты цепляются к menu-items id. Для авто-категории таким id
    // служит её материализованный оверрайд (ov.id), если он есть.
    if (ov && depth < MAX_DEPTH) {
      const manualChildren = manualByParent.get(ov.id) ?? []
      for (const m of manualChildren) {
        childNodes.push({ ...buildManual(m, depth + 1), _order: orderOfManual(m) } as any)
      }
    }

    childNodes.sort((a: any, b: any) => (a._order ?? 0) - (b._order ?? 0))
    for (const n of childNodes) delete (n as any)._order

    return {
      id: cat.id,
      title,
      href: categoryHref(cat),
      children: childNodes,
    }
  }

  // Эффективный порядок авто-узла: оверрайд.order приоритетнее Category.order.
  const effectiveOrder = (cat: any): number => {
    const ov = catOverride.get(cat.id)
    if (ov && typeof ov.order === 'number') return ov.order
    return typeof cat.order === 'number' ? cat.order : 0
  }

  // --- Корневой уровень ------------------------------------------------------

  // Корни-категории: флаг showInHeader/showInFooter.
  const rootCats = cats.filter((c) => c[rootFlag] === true)

  const roots: Array<MenuNode & { _order: number }> = []

  for (const cat of rootCats) {
    const node = buildCat(cat, 1)
    if (node) roots.push({ ...node, _order: effectiveOrder(cat) })
  }

  // Ручные пункты верхнего уровня (parent пуст).
  for (const m of manualByParent.get(null) ?? []) {
    roots.push({ ...buildManual(m, 1), _order: orderOfManual(m) })
  }

  roots.sort((a, b) => a._order - b._order)
  return roots.map(({ _order, ...node }) => node)
}
