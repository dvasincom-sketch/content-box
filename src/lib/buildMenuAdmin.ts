import { getPayload } from 'payload'
import config from '@/payload.config'
import { categoryHref } from '@/lib/categoryHref'
import type { MenuLocation } from '@/lib/buildMenu'

/**
 * Узел дерева ДЛЯ КОНСТРУКТОРА (не для публичного сайта).
 *
 * Отличия от MenuNode (buildMenu):
 *  - скрытые узлы НЕ выкидываются, а несут isHidden (чтобы вернуть галочку);
 *  - у каждого узла метаданные: kind, ссылки на источники, id оверрайда,
 *    оригинальное имя (для «сброса» переименования).
 */
export type AdminMenuNode = {
  key: string // 'cat:12' | 'item:34' — стабильный id для dnd
  kind: 'category' | 'page' | 'url'
  label: string // отображаемое имя (с учётом labelOverride)
  originalLabel: string // имя источника без оверрайда (для сброса)
  href: string
  categoryId: number | null
  pageId: number | null
  overrideId: number | null // id записи menu-items (null = чистый автоген)
  isHidden: boolean
  isManual: boolean // true для page/url
  children: AdminMenuNode[]
}

const MAX_DEPTH = 4

/**
 * buildMenuAdmin — «сырое» дерево меню для конструктора студии.
 * Читает те же источники, что buildMenu (категории + menu-items данного
 * location), но сохраняет скрытые узлы и метаданные. БД не меняет.
 */
export async function buildMenuAdmin(
  tenantID: number,
  location: MenuLocation,
): Promise<AdminMenuNode[]> {
  const payload = await getPayload({ config: await config })

  const rootFlag = location === 'header' ? 'showInHeader' : 'showInFooter'

  const catsRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: tenantID } },
    sort: 'order',
    limit: 1000,
    depth: 1,
    overrideAccess: true,
  })
  const cats = catsRes.docs as any[]

  const itemsRes = await payload.find({
    collection: 'menu-items',
    where: {
      and: [{ tenant: { equals: tenantID } }, { location: { equals: location } }],
    },
    sort: 'order',
    limit: 1000,
    depth: 1,
    overrideAccess: true,
  })
  const items = itemsRes.docs as any[]

  const idOf = (rel: any): number | null =>
    rel == null ? null : typeof rel === 'object' ? rel.id : rel

  // Оверрайды авто-категорий: category.id → override.
  const catOverride = new Map<number, any>()
  // Ручные пункты (page/url) по их menu-items parent id.
  const manualByParent = new Map<number | null, any[]>()

  for (const it of items) {
    if (it.kind === 'category') {
      const cid = idOf(it.category)
      if (cid != null) catOverride.set(cid, it)
    } else {
      const pid = idOf(it.parent)
      const bucket = manualByParent.get(pid) ?? []
      bucket.push(it)
      manualByParent.set(pid, bucket)
    }
  }

  // Категории по родителю (таксономия).
  const catsByParent = new Map<number | null, any[]>()
  for (const cat of cats) {
    const pid = idOf(cat.parent)
    const bucket = catsByParent.get(pid) ?? []
    bucket.push(cat)
    catsByParent.set(pid, bucket)
  }

  const orderOfManual = (it: any): number =>
    typeof it.order === 'number' ? it.order : 0

  const effectiveOrder = (cat: any): number => {
    const ov = catOverride.get(cat.id)
    if (ov && typeof ov.order === 'number') return ov.order
    return typeof cat.order === 'number' ? cat.order : 0
  }

  // --- Ручные пункты (page/url) ----------------------------------------------

  const manualOriginalLabel = (it: any): string => {
    if (it.kind === 'page' && it.page && typeof it.page === 'object') {
      return it.page.title || 'Страница'
    }
    return it.url || 'Ссылка'
  }

  const manualHref = (it: any): string => {
    if (it.kind === 'url') return it.url || '#'
    if (it.kind === 'page' && it.page && typeof it.page === 'object') {
      return `/page/${it.page.slug}`
    }
    return '#'
  }

  const buildManual = (it: any, depth: number): AdminMenuNode => {
    const original = manualOriginalLabel(it)
    return {
      key: `item:${it.id}`,
      kind: it.kind,
      label: it.labelOverride || original,
      originalLabel: original,
      href: manualHref(it),
      categoryId: null,
      pageId: it.kind === 'page' ? idOf(it.page) : null,
      overrideId: it.id,
      isHidden: Boolean(it.hidden),
      isManual: true,
      children:
        depth >= MAX_DEPTH
          ? []
          : (manualByParent.get(it.id) ?? [])
              .slice()
              .sort((a, b) => orderOfManual(a) - orderOfManual(b))
              .map((child) => buildManual(child, depth + 1)),
    }
  }

  // --- Авто-категории --------------------------------------------------------

  const buildCat = (cat: any, depth: number): AdminMenuNode => {
    const ov = catOverride.get(cat.id)
    const childCats = depth >= MAX_DEPTH ? [] : catsByParent.get(cat.id) ?? []

    const childNodes: Array<AdminMenuNode & { _order: number }> = []

    for (const child of childCats) {
      childNodes.push({ ...buildCat(child, depth + 1), _order: effectiveOrder(child) })
    }

    // Ручные дети цепляются к материализованному оверрайду категории.
    if (ov && depth < MAX_DEPTH) {
      for (const m of manualByParent.get(ov.id) ?? []) {
        childNodes.push({ ...buildManual(m, depth + 1), _order: orderOfManual(m) })
      }
    }

    childNodes.sort((a, b) => a._order - b._order)

    return {
      key: `cat:${cat.id}`,
      kind: 'category',
      label: ov?.labelOverride || cat.title,
      originalLabel: cat.title,
      href: categoryHref(cat),
      categoryId: cat.id,
      pageId: null,
      overrideId: ov?.id ?? null,
      isHidden: Boolean(ov?.hidden),
      isManual: false,
      children: childNodes.map(({ _order, ...n }) => n),
    }
  }

  // --- Корневой уровень ------------------------------------------------------

  const rootCats = cats.filter((c) => c[rootFlag] === true)

  const roots: Array<AdminMenuNode & { _order: number }> = []

  for (const cat of rootCats) {
    roots.push({ ...buildCat(cat, 1), _order: effectiveOrder(cat) })
  }

  for (const m of manualByParent.get(null) ?? []) {
    roots.push({ ...buildManual(m, 1), _order: orderOfManual(m) })
  }

  roots.sort((a, b) => a._order - b._order)
  return roots.map(({ _order, ...n }) => n)
}
