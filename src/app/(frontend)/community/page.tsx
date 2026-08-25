import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { brandVars } from '@/lib/brand'
import { publishedWhere } from '@/lib/published'
import { levelName } from '@/lib/reputation'
import { FollowButton } from '@/components/social/FollowButton'
import type { Metadata } from 'next'
import '../styles.css'

/**
 * Лента участников — публикации авторов-подписчиков, в приоритете авторы с
 * более высоким уровнем (статусом). Точка входа, чтобы найти, на кого
 * подписаться (CTA из пустой «Ленты» кабинета). Первый срез Фазы 6.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Сообщество' }
}

function relId(v: any): number | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? v.id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
function fmt(iso?: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

type Card = {
  id: number | string
  slug: string
  title: string
  date: string | null
  author: {
    id: number
    handle: string | null
    name: string
    level: number
    avatarUrl: string | null
    isPrivate: boolean
    paid: boolean
  }
}

export default async function CommunityPage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx
  const viewer = await getCurrentSubscriber().catch(() => null)

  // Лента сообщества — только для зарегистрированных пользователей. Гостю
  // показываем приглашение войти/зарегистрироваться вместо публикаций участников.
  if (!viewer) {
    return (
      <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-text)', marginBottom: 6 }}>Сообщество</h1>
          <div className="c-card" style={{ padding: '28px 24px', textAlign: 'center', color: 'var(--brand-muted)' }}>
            <p style={{ marginBottom: 18, lineHeight: 1.6 }}>
              Лента публикаций участников доступна зарегистрированным пользователям. Войдите или создайте аккаунт, чтобы читать и публиковать материалы сообщества.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/login" className="c-btn c-btn--primary">Войти</Link>
              <Link href="/register" className="c-btn">Зарегистрироваться</Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenant.id } }, { author: { exists: true } }, publishedWhere()] },
    sort: '-publishedAt',
    limit: 60,
    depth: 1,
    overrideAccess: true,
  })

  const cards: Card[] = (res.docs as any[])
    .filter((p) => p.slug && p.author && typeof p.author === 'object')
    .map((p) => {
      const a = p.author
      return {
        id: p.id,
        slug: p.slug,
        title: p.title || 'Без заголовка',
        date: p.publishedAt || p.createdAt || null,
        author: {
          id: Number(a.id),
          handle: a.handle || null,
          name: a.displayName || (a.handle ? `@${a.handle}` : 'Участник'),
          level: Number(a.level) || 0,
          avatarUrl: a.avatar && typeof a.avatar === 'object' ? a.avatar.url : null,
          isPrivate: Boolean(a.profilePrivate) || Boolean(a.isBlocked),
          paid: Boolean(a.activeTier),
        },
      }
    })

  // Приоритет: выше уровень автора → выше в ленте; при равном — свежее.
  cards.sort(
    (x, y) => y.author.level - x.author.level || (new Date(y.date || 0).getTime() - new Date(x.date || 0).getTime()),
  )

  let followingIds = new Set<number>()
  if (viewer) {
    const f = await payload.find({
      collection: 'follows',
      where: { and: [{ tenant: { equals: tenant.id } }, { follower: { equals: viewer.id } }] },
      limit: 500, depth: 0, overrideAccess: true,
    })
    followingIds = new Set((f.docs as any[]).map((x) => relId(x.following)).filter((n): n is number => n != null))
  }

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-text)', marginBottom: 6 }}>Сообщество</h1>
        <p style={{ color: 'var(--brand-muted)', marginBottom: 22 }}>
          Публикации участников — подписывайтесь на авторов, чьи материалы вам близки. Выше уровень автора — выше в ленте.
        </p>

        {cards.length === 0 ? (
          <div className="c-card" style={{ padding: '28px 24px', textAlign: 'center', color: 'var(--brand-muted)' }}>
            Пока нет публикаций участников. Будьте первым —{' '}
            <Link href="/account/submit" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>напишите публикацию</Link>.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cards.map((c) => {
              const a = c.author
              const profileHref = a.handle && !a.isPrivate ? `/u/${a.handle}` : null
              const canFollow = viewer && Number(viewer.id) !== a.id
              return (
                <div key={c.id} className="c-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span
                      style={{
                        display: 'grid', placeItems: 'center', width: 40, height: 40, flex: 'none',
                        borderRadius: 12, overflow: 'hidden', fontWeight: 700,
                        background: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)', color: 'var(--brand-text)',
                      }}
                    >
                      {a.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (a.name[0] || '?').toUpperCase()
                      )}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {profileHref ? (
                          <Link href={profileHref} style={{ fontWeight: 700, color: 'var(--brand-text)' }}>{a.name}</Link>
                        ) : (
                          <span style={{ fontWeight: 700, color: 'var(--brand-text)' }}>{a.name}</span>
                        )}
                        {a.paid && <span title="Подписчик" style={{ color: 'var(--brand-accent)' }}>★</span>}
                        <span
                          style={{
                            fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999,
                            background: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)', color: 'var(--brand-text)',
                          }}
                        >
                          {levelName(a.level)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--brand-muted)', marginTop: 2 }}>{fmt(c.date)}</div>
                    </div>
                    {canFollow && (
                      <FollowButton handle={a.handle || undefined} targetId={a.id} initialFollowing={followingIds.has(a.id)} />
                    )}
                  </div>
                  <Link href={`/publication/${c.slug}`} style={{ color: 'var(--brand-text)', fontWeight: 600, fontSize: 16 }}>
                    {c.title}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
