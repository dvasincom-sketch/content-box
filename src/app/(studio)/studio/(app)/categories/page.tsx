import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { lexicalToHtml } from '@/lib/lexical'
import { CategoriesManager } from './CategoriesManager'

/**
 * Экран «Категории» (студия). Просмотр дерева + создание/редактирование/удаление.
 * Теперь грузит также description (→ HTML для редактора) и cover (url) для панели
 * редактирования категории.
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
    depth: 1, // подтянуть cover (media) для url
    overrideAccess: true,
  })

  const categories = (res.docs as any[]).map((c) => {
    const rawParent = c.parent
    const parentId =
      rawParent && typeof rawParent === 'object' ? rawParent.id : (rawParent ?? null)
    const cover = c.cover
    const coverId = cover ? (typeof cover === 'object' ? cover.id : cover) : null
    const coverUrl = cover && typeof cover === 'object' ? cover.url : null
    return {
      id: c.id,
      title: c.title || 'Без названия',
      slug: c.slug || '',
      parentId: parentId ?? null,
      descriptionHtml: lexicalToHtml(c.description),
      coverId: coverId != null ? Number(coverId) : null,
      coverUrl: coverUrl ?? null,
    }
  })

  return <CategoriesManager initialCategories={categories} />
}
