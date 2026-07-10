import { getPayload } from 'payload'
import config from '@/payload.config'

export type MenuNode = {
  id: number
  title: string
  href: string
  children: MenuNode[]
}

/**
 * Дерево меню шапки: корневые категории с showInHeader и все их потомки.
 * Один запрос, сборка в память. ~180 узлов при полном дереве BTS.
 */
export async function getHeaderMenu(tenantID: number): Promise<MenuNode[]> {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Корни меню.
  const rootsRes = await payload.find({
    collection: 'categories',
    where: {
      and: [{ tenant: { equals: tenantID } }, { showInHeader: { equals: true } }],
    },
    sort: 'order',
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  const roots = rootsRes.docs as any[]
  if (roots.length === 0) return []

  // Все категории тенанта разом — дешевле, чем ветка за веткой.
  const allRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: tenantID } },
    sort: 'order',
    limit: 1000,
    depth: 1, // нужны breadcrumbs для href
    overrideAccess: true,
  })
  const all = allRes.docs as any[]

  const hrefOf = (cat: any): string => {
    const crumbs = cat.breadcrumbs
    if (Array.isArray(crumbs) && crumbs.length > 0) {
      const last = crumbs[crumbs.length - 1]?.url
      if (last) return `/category${last}`
    }
    return `/category/${cat.slug}`
  }

  const parentIDOf = (cat: any): number | null => {
    const p = cat.parent
    if (!p) return null
    return typeof p === 'object' ? p.id : p
  }

  // Группируем детей по родителю.
  const childrenByParent = new Map<number | null, any[]>()
  for (const cat of all) {
    const pid = parentIDOf(cat)
    const bucket = childrenByParent.get(pid) ?? []
    bucket.push(cat)
    childrenByParent.set(pid, bucket)
  }

  const build = (cat: any, depth: number): MenuNode => ({
    id: cat.id,
    title: cat.title,
    href: hrefOf(cat),
    children:
      depth >= 4
        ? []
        : (childrenByParent.get(cat.id) ?? []).map((child) => build(child, depth + 1)),
  })

  const rootIDs = new Set(roots.map((r) => r.id))
  return all.filter((c) => rootIDs.has(c.id)).map((c) => build(c, 1))
}
