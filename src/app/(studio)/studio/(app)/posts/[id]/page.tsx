import React from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { lexicalToHtml } from '@/lib/lexical'
import { Composer, type PostInitial } from '../new/Composer'

/**
 * Редактирование публикации. Грузит пост тенанта автора, категории и уровни,
 * разворачивает Lexical-описание обратно в текст, передаёт в Composer (edit).
 */

export const dynamic = 'force-dynamic'

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const author = await getCurrentAuthor()
  const payload = await getPayload({ config: await config })

  // Пост
  const post: any = await payload
    .findByID({ collection: 'publications', id, depth: 1, overrideAccess: true })
    .catch(() => null)

  if (!post) notFound()
  const postTenant = post.tenant && typeof post.tenant === 'object' ? post.tenant.id : post.tenant
  if (Number(postTenant) !== Number(author!.tenantId)) notFound()

  // Категории и уровни (как в композере создания)
  const [catsRes, tiersRes] = await Promise.all([
    payload.find({
      collection: 'categories',
      where: { tenant: { equals: author!.tenantId } },
      sort: 'title',
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'subscription-tiers',
      where: {
        and: [{ tenant: { equals: author!.tenantId } }, { isActive: { equals: true } }],
      },
      sort: 'weight',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const categories = (catsRes.docs as any[]).map((c) => {
    const rawParent = c.parent
    const parentId = rawParent && typeof rawParent === 'object' ? rawParent.id : (rawParent ?? null)
    return { id: c.id, title: c.title || 'Без названия', parentId: parentId ?? null }
  })

  const tiers = (tiersRes.docs as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    weight: t.weight,
    priceRub: t.priceRub,
  }))

  // Разворачиваем текущие значения поста
  const cover = post.cover
  const coverId = cover ? (typeof cover === 'object' ? cover.id : cover) : null
  const coverUrl = cover && typeof cover === 'object' ? cover.url : null

  const category = post.category
  const categoryId = category ? String(typeof category === 'object' ? category.id : category) : ''

  const minTier = post.minTier
  const minTierId = minTier ? String(typeof minTier === 'object' ? minTier.id : minTier) : ''

  const isPublished =
    !!post.publishedAt && new Date(post.publishedAt).getTime() <= Date.now()

  const initial: PostInitial = {
    id: post.id,
    title: post.title || '',
    body: lexicalToHtml(post.description),
    slug: post.slug || '',
    categoryId,
    minTierId,
    coverId: coverId != null ? Number(coverId) : null,
    coverUrl,
    isPublished,
  }

  return <Composer categories={categories} tiers={tiers} initial={initial} />
}
