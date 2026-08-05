import React from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { loadEntitlements, canUse } from '@/lib/studioEntitlements'
import { StudioUpsell } from '../../_ui/StudioUpsell'
import { lexicalToHtml } from '@/lib/lexical'
import { BookEditor } from './BookEditor'

/** Редактор книги: метаданные + менеджер глав. */
export const dynamic = 'force-dynamic'

export default async function BookEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const author = await getCurrentAuthor()
  const payload = await getPayload({ config: await config })
  const ent = await loadEntitlements(payload, author!.tenantId)
  if (!canUse(ent, 'books')) return <StudioUpsell cap="books" />

  const book: any = await payload.findByID({ collection: 'books' as any, id, depth: 2, overrideAccess: true }).catch(() => null)
  if (!book) notFound()
  const bTenant = book.tenant && typeof book.tenant === 'object' ? book.tenant.id : book.tenant
  if (Number(bTenant) !== Number(author!.tenantId)) notFound()

  const chRes = await payload.find({
    collection: 'chapters' as any,
    where: { and: [{ tenant: { equals: author!.tenantId } }, { book: { equals: book.id } }] },
    sort: 'order', limit: 5000, depth: 1, overrideAccess: true,
  })
  const chapters = (chRes.docs as any[]).map((c) => ({
    id: c.id,
    title: c.title || 'Без заголовка',
    order: Number(c.order) || 0,
    isPreview: Boolean(c.isPreview),
    minTierId: c.minTier ? String(typeof c.minTier === 'object' ? c.minTier.id : c.minTier) : '',
    wordCount: typeof c.wordCount === 'number' ? c.wordCount : null,
    bodyHtml: lexicalToHtml(c.body),
  }))

  const tiersRes = await payload.find({
    collection: 'subscription-tiers', where: { tenant: { equals: author!.tenantId } },
    sort: 'weight', limit: 100, depth: 0, overrideAccess: true,
  })
  const tiers = (tiersRes.docs as any[]).map((t) => ({ id: t.id, name: t.name || t.slug || `Уровень ${t.id}` }))

  const catsRes = await payload.find({
    collection: 'categories', where: { tenant: { equals: author!.tenantId } },
    sort: 'title', limit: 1000, depth: 0, overrideAccess: true,
  })
  const categories = (catsRes.docs as any[]).map((c) => ({
    id: c.id, title: c.title || 'Без названия',
    parentId: c.parent ? (typeof c.parent === 'object' ? Number(c.parent.id) : Number(c.parent)) : null,
  }))

  const vidsRes = await payload.find({
    collection: 'videos',
    where: { and: [{ tenant: { equals: author!.tenantId } }, { provider: { not_equals: 'audio' } }] },
    sort: '-createdAt', limit: 500, depth: 0, overrideAccess: true,
  })
  const videos = (vidsRes.docs as any[]).map((v) => ({ id: v.id, title: v.title || 'Без названия' }))

  const cyclesRes = await payload.find({
    collection: 'books' as any,
    where: { and: [{ tenant: { equals: author!.tenantId } }, { type: { equals: 'cycle' } }] },
    sort: 'title', limit: 500, depth: 0, overrideAccess: true,
  })
  const cycles = (cyclesRes.docs as any[])
    .filter((c) => String(c.id) !== String(book.id))
    .map((c) => ({ id: c.id, title: c.title || 'Без названия' }))

  const bookData = {
    id: book.id,
    title: book.title || '',
    slug: book.slug || '',
    status: book.status || 'ongoing',
    type: book.type || 'novel',
    ageRating: String(book.ageRating || '16'),
    allowComments: book.allowComments !== false,
    allowDownload: Boolean(book.allowDownload),
    cycleId: book.cycle ? String(typeof book.cycle === 'object' ? book.cycle.id : book.cycle) : '',
    cycleOrder: book.cycleOrder != null ? String(book.cycleOrder) : '',
    freeChapters: Number(book.freeChapters) || 0,
    categoryId: book.category ? String(typeof book.category === 'object' ? book.category.id : book.category) : '',
    minTierId: book.minTier ? String(typeof book.minTier === 'object' ? book.minTier.id : book.minTier) : '',
    coverId: book.cover ? Number(typeof book.cover === 'object' ? book.cover.id : book.cover) : null,
    coverUrl: book.cover && typeof book.cover === 'object' ? (book.cover.url || null) : null,
    annotationHtml: lexicalToHtml(book.annotation),
    tags: Array.isArray(book.tags) ? (book.tags as any[]).map((t) => t?.label).filter((l): l is string => typeof l === 'string' && l.length > 0) : [],
    genres: book.genres ? String(book.genres).split(',').map((x: string) => x.trim()).filter(Boolean) : [],
    quote1: book.quote1 || '',
    quote2: book.quote2 || '',
    quote3: book.quote3 || '',
    booktrailerVideoId: book.booktrailerVideo ? String(typeof book.booktrailerVideo === 'object' ? book.booktrailerVideo.id : book.booktrailerVideo) : '',
  }

  return <BookEditor book={bookData} chapters={chapters} tiers={tiers} categories={categories} cycles={cycles} videos={videos} />
}
