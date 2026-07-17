import React from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { lexicalToHtml } from '@/lib/lexical'
import { Composer, type PostInitial } from '../new/Composer'

/**
 * Редактирование публикации. Грузит пост тенанта автора, категории, уровни и
 * видео, разворачивает Lexical-описание обратно в текст, передаёт в Composer (edit).
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
    .findByID({ collection: 'publications', id, depth: 2, overrideAccess: true })
    .catch(() => null)

  if (!post) notFound()
  const postTenant = post.tenant && typeof post.tenant === 'object' ? post.tenant.id : post.tenant
  if (Number(postTenant) !== Number(author!.tenantId)) notFound()

  // Категории, уровни и видео (как в композере создания)
  const [catsRes, tiersRes, videosRes, galFoldersRes] = await Promise.all([
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
    payload.find({
      collection: 'videos',
      where: { tenant: { equals: author!.tenantId } },
      sort: '-createdAt',
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'gallery-folders',
      where: { tenant: { equals: author!.tenantId } },
      sort: 'title',
      limit: 1000,
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

  const videos = (videosRes.docs as any[]).map((v) => ({
    id: v.id,
    title: v.title || 'Без названия',
    addedAt: v.publishedAt || v.createdAt || null,
  }))

  // Разворачиваем текущие значения поста
  const cover = post.cover
  const coverId = cover ? (typeof cover === 'object' ? cover.id : cover) : null
  const coverUrl = cover && typeof cover === 'object' ? cover.url : null

  const category = post.category
  const categoryId = category ? String(typeof category === 'object' ? category.id : category) : ''

  const minTier = post.minTier
  const minTierId = minTier ? String(typeof minTier === 'object' ? minTier.id : minTier) : ''

  // relatedVideos (hasMany) → массив id в текущем порядке.
  // depth:1 → элементы могут быть объектами; нормализуем к id.
  // Галерея: array {image, caption} → {imageId, url, width, height, caption}.
  // depth:2 → image populate'ится как объект с url/width/height.
  const gallery = Array.isArray(post.gallery)
    ? post.gallery
        .map((row: any) => {
          const img = row?.image
          if (!img) return null
          const imageId = typeof img === 'object' ? img.id : img
          return {
            imageId,
            url: typeof img === 'object' ? img.url || null : null,
            width: typeof img === 'object' ? img.width || null : null,
            height: typeof img === 'object' ? img.height || null : null,
            caption: row?.caption || '',
          }
        })
        .filter((x: any) => x != null)
    : []

  const relatedVideoIds: (number | string)[] = Array.isArray(post.relatedVideos)
    ? post.relatedVideos
        .map((r: any) => (r && typeof r === 'object' ? r.id : r))
        .filter((x: any) => x != null)
    : []

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
    relatedVideoIds,
    gallery,
  }

  const galleryFolders = (galFoldersRes.docs as any[]).map((f) => {
    const rawParent = f.parent
    const parentId =
      rawParent && typeof rawParent === 'object' ? rawParent.id : (rawParent ?? null)
    return { id: f.id, title: f.title || 'Без названия', parentId: parentId ?? null }
  })

  return (
    <Composer
      categories={categories}
      tiers={tiers}
      videos={videos}
      galleryFolders={galleryFolders}
      initial={initial}
    />
  )
}
