import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { ModerationView } from './ModerationView'

/** Модерация UGC: очередь присланных участниками публикаций (Фаза 4). */
export const dynamic = 'force-dynamic'

export default async function ModerationPage() {
  const author = await getCurrentAuthor()
  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'submissions',
    where: { and: [{ tenant: { equals: author!.tenantId } }, { status: { equals: 'pending' } }] },
    sort: '-createdAt',
    limit: 100,
    depth: 1, // author, category
    overrideAccess: true,
  })

  const items = (res.docs as any[]).map((s) => ({
    id: s.id as number,
    title: (s.title || '') as string,
    body: s.body ?? null,
    authorName: ((s.author && typeof s.author === 'object' ? s.author.displayName || s.author.email : '') || 'Участник') as string,
    authorPaid: Boolean(s.author && typeof s.author === 'object' && s.author.activeTier),
    categoryName: (s.category && typeof s.category === 'object' ? s.category.title || s.category.slug : null) as string | null,
  }))

  return <ModerationView items={items} />
}
