import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { CategoriesManager } from './CategoriesManager'

/**
 * Экран «Категории» (студия). Просмотр дерева + создание/редактирование/удаление.
 * Серверная часть грузит все категории тенанта с parent для построения дерева.
 */

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const author = await getCurrentAuthor()
  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'title',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })

  const categories = (res.docs as any[]).map((c) => {
    const rawParent = c.parent
    const parentId =
      rawParent && typeof rawParent === 'object' ? rawParent.id : (rawParent ?? null)
    return {
      id: c.id,
      title: c.title || 'Без названия',
      slug: c.slug || '',
      parentId: parentId ?? null,
    }
  })

  return <CategoriesManager initialCategories={categories} />
}
