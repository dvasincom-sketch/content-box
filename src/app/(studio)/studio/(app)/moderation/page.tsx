import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { redirect } from 'next/navigation'
import { requireAuthor } from '@/lib/currentAuthor'
import { can } from '@/access'
import { ModerationView } from './ModerationView'

/** Модерация UGC: очередь присланных участниками публикаций (Фаза 4). */
export const dynamic = 'force-dynamic'

export default async function ModerationPage() {
  const author = await requireAuthor()
  if (!can(author!.user as any, 'commentsModeration', 'moderate')) redirect('/studio')
  const payload = await getPayload({ config: await config })

  // Очередь на модерацию + история уже обработанных — двумя запросами.
  const [res, histRes] = await Promise.all([
    payload.find({
      collection: 'submissions',
      where: { and: [{ tenant: { equals: author!.tenantId } }, { status: { equals: 'pending' } }] },
      sort: '-createdAt',
      limit: 100,
      depth: 1, // author, category
      overrideAccess: true,
    }),
    payload.find({
      collection: 'submissions',
      where: { and: [{ tenant: { equals: author!.tenantId } }, { status: { in: ['approved', 'rejected'] } }] },
      sort: '-updatedAt',
      limit: 100,
      depth: 1, // author, reviewedBy, publication
      overrideAccess: true,
    }),
  ])

  const authorNameOf = (a: any): string =>
    ((a && typeof a === 'object' ? a.displayName || a.email : '') || 'Участник') as string

  const items = (res.docs as any[]).map((s) => ({
    id: s.id as number,
    title: (s.title || '') as string,
    body: s.body ?? null,
    authorName: authorNameOf(s.author),
    authorPaid: Boolean(s.author && typeof s.author === 'object' && s.author.activeTier),
    categoryName: (s.category && typeof s.category === 'object' ? s.category.title || s.category.slug : null) as string | null,
  }))

  const history = (histRes.docs as any[]).map((s) => {
    const pub = s.publication && typeof s.publication === 'object' ? s.publication : null
    return {
      id: s.id as number,
      title: (s.title || 'Без заголовка') as string,
      authorName: authorNameOf(s.author),
      status: (s.status === 'approved' ? 'approved' : 'rejected') as 'approved' | 'rejected',
      section: (s.section === 'feed' ? 'feed' : s.section === 'community' ? 'community' : null) as
        | 'feed'
        | 'community'
        | null,
      reviewerName: (s.reviewedBy && typeof s.reviewedBy === 'object'
        ? s.reviewedBy.name || s.reviewedBy.email
        : null) as string | null,
      reviewedAt: (s.updatedAt || null) as string | null,
      rejectReason: (typeof s.rejectReason === 'string' && s.rejectReason.trim() ? s.rejectReason : null) as
        | string
        | null,
      publicationSlug: (pub && typeof pub.slug === 'string' ? pub.slug : null) as string | null,
    }
  })

  return <ModerationView items={items} history={history} />
}
