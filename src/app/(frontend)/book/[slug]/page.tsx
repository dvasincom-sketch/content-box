import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { tierWeight } from '@/lib/tierWeight'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { BookOpen, Lock, Play } from 'lucide-react'
import { BookmarkButton } from '@/components/social/BookmarkButton'
import { FollowBookButton } from '@/components/social/FollowBookButton'
import { parseVideoEmbed } from '@/lib/videoEmbed'
import type { Metadata } from 'next'
import '../../styles.css'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { novel: 'Роман', story: 'Рассказ', mini: 'Миниатюра', cycle: 'Цикл' }
const STATUS_LABEL: Record<string, string> = { ongoing: 'В процессе', finished: 'Завершено', frozen: 'Заморожено' }

async function loadBook(slug: string, tenantId: number | string) {
  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'books' as any,
    where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenantId } }] },
    limit: 1, depth: 2, overrideAccess: true,
  })
  return res.docs[0] as any || null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const book = await loadBook(slug, ctx.tenant.id)
  return book?.title ? { title: `${book.title} — ${(ctx.tenant as any)?.name || ''}`.trim() } : {}
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const book = await loadBook(slug, tenant.id)
  if (!book) notFound()

  const payload = await getPayload({ config: await config })
  const chRes = await payload.find({
    collection: 'chapters' as any,
    where: { and: [{ tenant: { equals: tenant.id } }, { book: { equals: book.id } }] },
    sort: 'order', limit: 5000, depth: 1, overrideAccess: true,
  })

  // Эффективный вес подписки посетителя.
  const viewer = await getCurrentSubscriber(tenant.id).catch(() => null)
  let viewerWeight = -1
  if (viewer && !(viewer as any).isBlocked) {
    const until = (viewer as any).subscriptionUntil ? new Date((viewer as any).subscriptionUntil) : null
    const at = (viewer as any).activeTier
    const atId = at ? (typeof at === 'object' ? at.id : at) : null
    if (until && until.getTime() > Date.now() && atId != null) {
      const w = await tierWeight(payload, atId, tenant.id)
      if (w != null) viewerWeight = w
    }
  }

  const bookTier = book.minTier && typeof book.minTier === 'object' ? book.minTier : null
  const freeChapters = Number(book.freeChapters) || 0

  const chapters = (chRes.docs as any[]).map((c) => {
    const chTier = c.minTier && typeof c.minTier === 'object' ? c.minTier : null
    const eff = chTier ?? bookTier
    const effWeight = eff ? Number(eff.weight) : null
    const order = Number(c.order) || 0
    const free = c.isPreview || (freeChapters > 0 && order <= freeChapters) || !eff
    const unlocked = free || (effWeight != null && viewerWeight >= effWeight)
    return { id: c.id, title: c.title || 'Без заголовка', order, wordCount: typeof c.wordCount === 'number' ? c.wordCount : null, unlocked }
  })

  const firstReadable = chapters.find((c) => c.unlocked) || chapters[0]

  // Библиотека читателя + прогресс.
  let savedInLibrary = false
  let followingBook = false
  let continueOrder: number | null = null
  if (viewer) {
    const bm = await payload.find({
      collection: 'bookmarks',
      where: { and: [{ subscriber: { equals: viewer.id } }, { tenant: { equals: tenant.id } }, { book: { equals: book.id } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    savedInLibrary = bm.docs.length > 0
    const fl = await payload.find({
      collection: 'book-follows' as any,
      where: { and: [{ subscriber: { equals: viewer.id } }, { tenant: { equals: tenant.id } }, { book: { equals: book.id } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    followingBook = (fl as any).docs.length > 0
    const pv = await payload.find({
      collection: 'views',
      where: { and: [{ subscriber: { equals: viewer.id } }, { tenant: { equals: tenant.id } }, { book: { equals: book.id } }] },
      limit: 1, depth: 1, overrideAccess: true,
    })
    const ch = (pv.docs[0] as any)?.chapter
    if (ch && typeof ch === 'object' && ch.order != null) continueOrder = Number(ch.order)
  }
  const coverUrl = book.cover && typeof book.cover === 'object' ? (book.cover.url || null) : null
  const tags = Array.isArray(book.tags) ? (book.tags as any[]).map((t) => t?.label).filter((l): l is string => typeof l === 'string' && l.length > 0) : []
  const genres = [book.genre1, book.genre2].filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
  const quotes = [book.quote1, book.quote2, book.quote3].filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
  const trailer = book.booktrailer ? parseVideoEmbed(String(book.booktrailer)) : null

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <nav className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>
          <Link href="/books" className="c-navlink">Библиотека</Link>
          <span aria-hidden> / </span>
          <span style={{ color: 'var(--brand-text)' }}>{book.title}</span>
        </nav>

        <div className="flex gap-6 flex-col sm:flex-row mb-8">
          <div className="flex-none w-[180px] mx-auto sm:mx-0">
            <div className="w-[180px] h-[240px] rounded-xl overflow-hidden grid place-items-center" style={{ background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' }}>
              {coverUrl ? (
                <Image src={coverUrl} alt="" width={180} height={240} className="object-cover w-full h-full" />
              ) : <BookOpen size={40} style={{ color: 'var(--brand-primary)' }} />}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl lg:text-4xl font-extrabold mb-3" style={{ color: 'var(--brand-text)' }}>{book.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs" style={{ color: 'var(--brand-muted)' }}>
              <span className="px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)' }}>{TYPE_LABEL[book.type || 'novel']}</span>
              <span className="px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-text) 8%, transparent)' }}>{STATUS_LABEL[book.status || 'ongoing']}</span>
              {book.ageRating && <span className="px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-text) 8%, transparent)' }}>{book.ageRating}+</span>}
              {genres.map((g) => (<span key={g} className="px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)' }}>{g}</span>))}
              <span>{chapters.length} глав</span>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((t) => (
                  <Link key={t} href={`/tag/${encodeURIComponent(t)}`} className="text-xs px-2 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)', color: 'var(--brand-text)' }}>{t}</Link>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {continueOrder != null ? (
                <Link href={`/book/${slug}/${continueOrder}`} className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
                  <Play size={16} /> Продолжить (глава {continueOrder})
                </Link>
              ) : firstReadable ? (
                <Link href={`/book/${slug}/${firstReadable.order}`} className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl" style={{ background: 'var(--brand-primary)', color: '#fff' }}>
                  <Play size={16} /> Читать
                </Link>
              ) : null}
              {viewer && <BookmarkButton targetType="book" targetId={book.id} initialSaved={savedInLibrary} />}
              {viewer && <FollowBookButton bookId={book.id} initialFollowing={followingBook} />}
            </div>
          </div>
        </div>

        {book.annotation && (
          <div className="mb-8 leading-relaxed" style={{ color: 'var(--brand-text)' }}>
            <RichText data={book.annotation} />
          </div>
        )}

        {quotes.length > 0 && (
          <div className="mb-8 flex flex-col gap-3">
            {quotes.map((q, i) => (
              <blockquote key={i} className="pl-4 italic" style={{ borderLeft: '3px solid var(--brand-primary)', color: 'var(--brand-text)', opacity: 0.9 }}>{q}</blockquote>
            ))}
          </div>
        )}

        {trailer && (
          <div className="mb-8 rounded-2xl overflow-hidden" style={{ aspectRatio: trailer.aspect === '9:16' ? '9 / 16' : '16 / 9', maxWidth: trailer.aspect === '9:16' ? 340 : '100%', background: '#000' }}>
            <iframe src={trailer.src} title="Буктрейлер" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen style={{ width: '100%', height: '100%', border: 0 }} />
          </div>
        )}

        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--brand-text)' }}>Оглавление</h2>
        {chapters.length === 0 ? (
          <div style={{ color: 'var(--brand-muted)' }}>Глав пока нет.</div>
        ) : (
          <ol className="flex flex-col gap-1">
            {chapters.map((c) => (
              <li key={c.id}>
                <Link href={`/book/${slug}/${c.order}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--brand-surface)', border: '1px solid color-mix(in srgb, var(--brand-text) 8%, transparent)' }}>
                  <span className="text-sm tabular-nums w-8 text-right" style={{ color: 'var(--brand-muted)' }}>{c.order}.</span>
                  <span className="min-w-0 flex-1 font-medium" style={{ color: 'var(--brand-text)' }}>{c.title}</span>
                  {c.wordCount != null && <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>{c.wordCount} сл.</span>}
                  {!c.unlocked && <Lock size={14} style={{ color: 'var(--brand-muted)' }} />}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  )
}
