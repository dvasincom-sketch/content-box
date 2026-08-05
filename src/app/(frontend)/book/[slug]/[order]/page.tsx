import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { checkChapterAccess } from '@/lib/chapterAccess'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { ChevronLeft, ChevronRight, List, Lock } from 'lucide-react'
import '../../../styles.css'

export const dynamic = 'force-dynamic'

export default async function ReaderPage({ params }: { params: Promise<{ slug: string; order: string }> }) {
  const { slug, order } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx
  const payload = await getPayload({ config: await config })

  const bookRes = await payload.find({
    collection: 'books' as any,
    where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenant.id } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const book = bookRes.docs[0] as any
  if (!book) notFound()

  const ord = Number(order)
  const chRes = await payload.find({
    collection: 'chapters' as any,
    where: { and: [{ tenant: { equals: tenant.id } }, { book: { equals: book.id } }, { order: { equals: ord } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const chapterStub = chRes.docs[0] as any
  if (!chapterStub) notFound()

  // Соседние главы для навигации.
  const allRes = await payload.find({
    collection: 'chapters' as any,
    where: { and: [{ tenant: { equals: tenant.id } }, { book: { equals: book.id } }] },
    sort: 'order', limit: 5000, depth: 0, overrideAccess: true,
  })
  const orders = (allRes.docs as any[]).map((c) => Number(c.order)).sort((a, b) => a - b)
  const idx = orders.indexOf(ord)
  const prev = idx > 0 ? orders[idx - 1] : null
  const next = idx >= 0 && idx < orders.length - 1 ? orders[idx + 1] : null

  const access = await checkChapterAccess({ id: chapterStub.id, tenantId: tenant.id })
  if (!access.allowed && access.reason === 'not-found') notFound()

  const chapter = access.allowed ? access.chapter : chapterStub

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6 text-sm" style={{ color: 'var(--brand-muted)' }}>
          <Link href={`/book/${slug}`} className="inline-flex items-center gap-1 c-navlink"><List size={15} /> {book.title}</Link>
        </div>

        <h1 className="text-2xl lg:text-3xl font-extrabold mb-6" style={{ color: 'var(--brand-text)' }}>{chapter.title}</h1>

        {access.allowed ? (
          <>
            <article className="reader-body leading-relaxed" style={{ color: 'var(--brand-text)', fontSize: 18, lineHeight: 1.75 }}>
              {chapter.body ? <RichText data={chapter.body} /> : <p style={{ color: 'var(--brand-muted)' }}>Глава пока пуста.</p>}
            </article>

            <nav className="flex items-center justify-between gap-3 mt-10 pt-6" style={{ borderTop: '1px solid color-mix(in srgb, var(--brand-text) 10%, transparent)' }}>
              {prev != null ? (
                <Link href={`/book/${slug}/${prev}`} className="inline-flex items-center gap-1 text-sm font-semibold px-4 py-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand-text) 8%, transparent)', color: 'var(--brand-text)' }}><ChevronLeft size={16} /> Назад</Link>
              ) : <span />}
              <Link href={`/book/${slug}`} className="text-sm c-navlink">Оглавление</Link>
              {next != null ? (
                <Link href={`/book/${slug}/${next}`} className="inline-flex items-center gap-1 text-sm font-semibold px-4 py-2.5 rounded-xl" style={{ background: 'var(--brand-primary)', color: '#fff' }}>Далее <ChevronRight size={16} /></Link>
              ) : <span />}
            </nav>
          </>
        ) : (
          <ChapterLock reason={access.reason} requiredTierName={access.requiredTierName} />
        )}
      </div>
    </main>
  )
}

/* Замок главы — точка продажи. */
function ChapterLock({ reason, requiredTierName }: { reason: string; requiredTierName?: string | null }) {
  const heading = reason === 'need-login' ? 'Войдите, чтобы читать'
    : reason === 'expired' ? 'Подписка истекла'
    : reason === 'blocked' ? 'Доступ ограничен'
    : 'Глава доступна по подписке'
  const text = reason === 'need-login' ? 'Эта глава доступна подписчикам. Войдите или оформите подписку.'
    : reason === 'expired' ? 'Продлите подписку, чтобы продолжить чтение.'
    : reason === 'blocked' ? 'Ваш аккаунт временно ограничен.'
    : requiredTierName ? `Глава открыта на уровне «${requiredTierName}» и выше.`
    : 'Эта глава доступна подписчикам.'
  return (
    <div className="rounded-2xl p-10 text-center" style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: 'rgba(0,0,0,.3)' }}><Lock size={24} color="#fff" /></div>
      <div className="text-2xl font-bold mb-2" style={{ color: '#fff' }}>{heading}</div>
      <p className="mb-6 text-sm" style={{ color: '#fff', opacity: 0.9 }}>{text}</p>
      {reason !== 'blocked' && (
        <Link href={reason === 'need-login' ? '/login' : '/subscribe'} className="inline-block text-sm font-semibold px-6 py-3 rounded-xl" style={{ background: '#fff', color: 'var(--brand-primary)' }}>
          {reason === 'expired' ? 'Продлить подписку' : reason === 'need-login' ? 'Войти или подписаться' : 'Оформить подписку'}
        </Link>
      )}
    </div>
  )
}
