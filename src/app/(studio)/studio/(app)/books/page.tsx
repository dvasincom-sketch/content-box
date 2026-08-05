import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { BooksManager } from './BooksManager'

/** Раздел «Книги» студии — авторские текстовые произведения. */
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = { ongoing: 'В процессе', finished: 'Завершено', frozen: 'Заморожено' }

export default async function BooksPage() {
  const author = await getCurrentAuthor()
  const payload = await getPayload({ config: await config })

  const booksRes = await payload.find({
    collection: 'books' as any,
    where: { tenant: { equals: author!.tenantId } },
    sort: '-updatedAt', limit: 500, depth: 1, overrideAccess: true,
  })

  // Кол-во глав по книгам одним запросом.
  const chRes = await payload.find({
    collection: 'chapters' as any,
    where: { tenant: { equals: author!.tenantId } },
    limit: 5000, depth: 0, overrideAccess: true,
  })
  const counts = new Map<string, number>()
  for (const c of chRes.docs as any[]) {
    const b = String(typeof c.book === 'object' ? c.book?.id : c.book)
    counts.set(b, (counts.get(b) || 0) + 1)
  }

  const books = (booksRes.docs as any[]).map((b) => ({
    id: b.id,
    title: b.title || 'Без названия',
    status: b.status || 'ongoing',
    statusLabel: STATUS_LABEL[b.status || 'ongoing'] || '—',
    coverUrl: b.cover && typeof b.cover === 'object' ? (b.cover.url || null) : null,
    chapters: counts.get(String(b.id)) || 0,
    updatedAt: b.updatedAt || null,
  }))

  return <BooksManager initialBooks={books} />
}
