import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { checkPublicationAccess } from '@/lib/publicationAccess'
import { StreamLive } from './StreamLive'
import { StreamChat } from './StreamChat'
import type { Metadata } from 'next'
import '../../styles.css'

type Params = { slug: string }
export const dynamic = 'force-dynamic'

async function loadStream(slug: string) {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return null
  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'streams' as any,
    where: { and: [{ tenant: { equals: ctx.tenant.id } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })
  const stream = (res.docs as any[])[0] || null
  return stream ? { ctx, stream } : null
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const data = await loadStream(slug)
  const desc = data?.stream?.description ? String(data.stream.description).slice(0, 300) : undefined
  return { title: data?.stream?.title || 'Трансляция', description: desc }
}

export default async function StreamPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const data = await loadStream(slug)
  if (!data) return notFound()
  const { ctx, stream } = data
  const settings = ctx.settings as any

  const cover = stream.cover && typeof stream.cover === 'object' ? stream.cover : null
  const coverUrl = cover?.sizes?.large?.url || cover?.url || null

  // Доступ по тарифу — та же модель, что у публикаций/видео.
  const access = await checkPublicationAccess(stream)

  const when = stream.scheduledAt
    ? new Date(stream.scheduledAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <style>{`
        .stream-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
        .stream-chat-cell { height: 340px; }
        @media (min-width: 900px) {
          .stream-grid.has-chat { grid-template-columns: minmax(0, 1fr) 340px; }
          .stream-chat-cell { height: 420px; }
        }
      `}</style>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-text)', margin: '0 0 6px' }}>{stream.title}</h1>
        {when && <div style={{ color: 'var(--brand-muted)', fontSize: 14, marginBottom: stream.description ? 10 : 16 }}>{when}</div>}
        {stream.description && (
          <p style={{ color: 'var(--brand-text)', fontSize: 15, lineHeight: 1.55, margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>{stream.description}</p>
        )}

        {access.allowed ? (
          <div className={`stream-grid${stream.chatEnabled !== false ? ' has-chat' : ''}`}>
            <div>
              <StreamLive
                title={stream.title}
                scheduledAt={stream.scheduledAt || null}
                endsAt={stream.endsAt || null}
                playbackUrl={stream.playbackUrl || ''}
                recordingUrl={stream.recordingUrl || ''}
                coverUrl={coverUrl}
              />
            </div>
            {stream.chatEnabled !== false && (
              <div className="stream-chat-cell">
                <StreamChat streamId={String(stream.id)} />
              </div>
            )}
          </div>
        ) : (
          <StreamLock reason={access.reason} requiredTierName={access.requiredTierName} coverUrl={coverUrl} slug={slug} />
        )}
      </div>
    </main>
  )
}

/** Замок: трансляция по подписке. Тизер с обложкой + приглашение. */
function StreamLock({
  reason,
  requiredTierName,
  coverUrl,
  slug,
}: {
  reason: 'need-login' | 'need-subscription' | 'expired' | 'blocked'
  requiredTierName: string | null
  coverUrl: string | null
  slug: string
}) {
  const blocked = reason === 'blocked'
  const needLogin = reason === 'need-login'
  const text = blocked
    ? 'Доступ ограничен. Обратитесь в поддержку.'
    : requiredTierName
      ? `Трансляция доступна на уровне «${requiredTierName}» и выше.`
      : 'Трансляция доступна по подписке.'
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--brand-border, rgba(0,0,0,.12))' }}>
      {coverUrl && <div style={{ position: 'absolute', inset: 0, background: `url(${coverUrl}) center/cover`, filter: 'blur(8px) brightness(.5)', transform: 'scale(1.06)' }} />}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, background: 'color-mix(in srgb, #000 45%, transparent)' }}>
        <div style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            {blocked ? 'Доступ ограничен' : 'Трансляция по подписке'}
          </div>
          <p style={{ color: 'rgba(255,255,255,.88)', marginBottom: 18, lineHeight: 1.5 }}>{text}</p>
          {!blocked &&
            (needLogin ? (
              <Link href={`/login?next=${encodeURIComponent('/stream/' + slug)}`} className="c-btn c-btn--primary">Войти</Link>
            ) : (
              <Link href="/subscribe" className="c-btn c-btn--primary">Оформить подписку</Link>
            ))}
        </div>
      </div>
    </div>
  )
}
