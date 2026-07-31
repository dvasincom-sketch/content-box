import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { publishedWhere } from '@/lib/published'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import { levelName } from '@/lib/reputation'
import { earnedBadges } from '@/lib/badges'
import { FollowButton } from '@/components/social/FollowButton'

/**
 * Публичная страница профиля участника — /u/<handle> (Фаза 1 «Сообщество»).
 * Публичная и индексируемая (SEO-приоритет). Приватный/заблокированный → 404 + noindex
 * (владельцу приватный показываем как превью). Уровень/значки — заглушки (Ф2–Ф3),
 * публикации-вклады — Ф4.
 */
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ handle: string }> }

async function loadProfile(handle: string) {
  const ctx = await getTenantFromHeaders()
  const tenant = (ctx as any)?.tenant
  const settings = (ctx as any)?.settings
  if (!tenant?.id) return { tenant: null, settings, profile: null, payload: null as any }
  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'subscribers',
    where: { and: [{ tenant: { equals: tenant.id } }, { handle: { equals: handle } }] },
    limit: 1,
    depth: 1, // avatar + activeTier
    overrideAccess: true,
  })
  return { tenant, settings, profile: (res.docs[0] as any) || null, payload }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params
  const { tenant, settings, profile } = await loadProfile(handle)
  if (!tenant || !profile || profile.isBlocked || profile.profilePrivate) {
    return { robots: { index: false, follow: false } }
  }
  const name = profile.displayName || `@${profile.handle}`
  const avatar = profile.avatar && typeof profile.avatar === 'object' ? profile.avatar.url : undefined
  const base = buildMetadata({
    defaults: settings?.seoDefaults,
    levels: [{ title: name, description: profile.bio || undefined, ogImage: avatar ? { url: avatar } : undefined }],
    fallbackTitle: name,
    brandName: tenant?.name,
  })
  return { ...base, alternates: { canonical: `/u/${profile.handle}` }, robots: { index: true, follow: true } }
}

function joinedLabel(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
  } catch {
    return ''
  }
}

export default async function ProfilePage({ params }: Params) {
  const { handle } = await params
  const { tenant, settings, profile, payload } = await loadProfile(handle)
  if (!tenant || !profile) notFound()

  const viewer = await getCurrentSubscriber().catch(() => null)
  const isOwner = Boolean(viewer && viewer.id === profile.id)
  if (profile.isBlocked || (profile.profilePrivate && !isOwner)) notFound()

  const followerCount = await payload
    .count({ collection: 'follows', where: { and: [{ tenant: { equals: tenant.id } }, { following: { equals: profile.id } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const followingCount = await payload
    .count({ collection: 'follows', where: { and: [{ tenant: { equals: tenant.id } }, { follower: { equals: profile.id } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  let isFollowing = false
  if (viewer && !isOwner) {
    const f = await payload.find({ collection: 'follows', where: { and: [{ tenant: { equals: tenant.id } }, { follower: { equals: viewer.id } }, { following: { equals: profile.id } }] }, limit: 1, depth: 0, overrideAccess: true })
    isFollowing = f.docs.length > 0
  }

  const commentsRes = await payload.find({
    collection: 'comments',
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { author: { equals: profile.id } },
        { status: { equals: 'published' } },
      ],
    },
    sort: '-createdAt',
    limit: 20,
    depth: 1,
    overrideAccess: true,
  })
  const commentCount = commentsRes.totalDocs
  const reactionCount = await payload
    .count({
      collection: 'activity-events',
      where: { and: [{ tenant: { equals: tenant.id } }, { subscriber: { equals: profile.id } }, { type: { equals: 'reaction_received' } }] },
      overrideAccess: true,
    })
    .then((r: any) => r.totalDocs)
    .catch(() => 0)

  const authoredRes = await payload.find({
    collection: 'publications',
    // Снятый с публикации UGC не должен оставаться в списке: карточка
    // отображалась бы, а ссылка вела на 404.
    where: { and: [{ tenant: { equals: tenant.id } }, { author: { equals: profile.id } }, publishedWhere()] },
    sort: '-publishedAt',
    limit: 12,
    depth: 0,
    overrideAccess: true,
  })
  const authored = (authoredRes.docs as any[]).filter((p) => p.slug).map((p) => ({ id: p.id, title: p.title, slug: p.slug }))

  const avatarUrl = profile.avatar && typeof profile.avatar === 'object' ? profile.avatar.url : null
  const name = profile.displayName || `@${profile.handle}`
  const initial = (name.trim()[0] || '?').toUpperCase()
  const tierName =
    profile.activeTier && typeof profile.activeTier === 'object' ? profile.activeTier.name : null
  const confirmedBugs = await payload
    .count({ collection: 'bug-reports', where: { and: [{ subscriber: { equals: profile.id } }, { status: { in: ['confirmed', 'fixed'] } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs)
    .catch(() => 0)
  const badges = earnedBadges({
    commentCount,
    reactionsReceived: reactionCount,
    level: Number(profile.level) || 0,
    hasPaidTier: Boolean(profile.activeTier),
    confirmedBugs,
  })

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {isOwner && profile.profilePrivate && (
          <div className="c-card" style={{ padding: 14, marginBottom: 16, color: 'var(--brand-muted)' }}>
            Профиль скрыт — виден только вам. Открыть его можно в{' '}
            <Link href="/account" style={{ color: 'var(--brand-primary)' }}>кабинете</Link>.
          </div>
        )}

        <div className="c-card" style={{ padding: 28, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            aria-hidden
            style={{
              width: 84, height: 84, borderRadius: 16, flex: 'none', overflow: 'hidden',
              display: 'grid', placeItems: 'center',
              background: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)',
              color: 'var(--brand-text)', fontSize: 30, fontWeight: 700,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initial
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 26, color: 'var(--brand-text)', margin: 0 }}>{name}</h1>
              {tierName && (
                <span
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                    color: 'var(--brand-primary)',
                    background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--brand-primary) 20%, transparent)',
                  }}
                >
                  {tierName}
                </span>
              )}
            </div>
            <div style={{ color: 'var(--brand-muted)', marginTop: 4 }}>@{profile.handle}</div>
            {profile.bio && <p style={{ color: 'var(--brand-text)', marginTop: 10 }}>{profile.bio}</p>}
            <div style={{ color: 'var(--brand-muted)', fontSize: 13, marginTop: 8 }}>
              Участник с {joinedLabel(profile.createdAt)}
              {'  ·  '}Уровень: {levelName(profile.level)} · {profile.points || 0} очков
            </div>
            <div style={{ color: 'var(--brand-muted)', fontSize: 13, marginTop: 4 }}>
              {followerCount} подписчиков · {followingCount} подписок
            </div>
          </div>
          {viewer && !isOwner && (
            <FollowButton handle={profile.handle} targetId={profile.id} initialFollowing={isFollowing} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { k: 'Комментарии', v: commentCount },
            { k: 'Реакции', v: reactionCount },
          ].map((s) => (
            <div key={s.k} className="c-card" style={{ padding: '14px 20px', minWidth: 120 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-text)' }}>{s.v}</div>
              <div style={{ fontSize: 13, color: 'var(--brand-muted)' }}>{s.k}</div>
            </div>
          ))}
        </div>

        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {badges.map((b) => (
              <span
                key={b.id}
                title={b.desc}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                  color: b.exclusive ? 'var(--brand-accent)' : 'var(--brand-text)',
                  background: b.exclusive
                    ? 'color-mix(in srgb, var(--brand-accent) 14%, transparent)'
                    : 'color-mix(in srgb, var(--brand-text) 8%, transparent)',
                }}
              >
                {b.name}
              </span>
            ))}
          </div>
        )}

        {authored.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, color: 'var(--brand-text)', marginBottom: 12 }}>Публикации</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {authored.map((pub) => (
                <Link key={pub.id} href={`/publication/${pub.slug}`} className="c-card" style={{ padding: 14, color: 'var(--brand-text)' }}>
                  {pub.title}
                </Link>
              ))}
            </div>
          </section>
        )}

        {viewer ? (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, color: 'var(--brand-text)', marginBottom: 12 }}>Активность</h2>
            {commentsRes.docs.length === 0 ? (
              <p style={{ color: 'var(--brand-muted)' }}>Пока нет активности.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(commentsRes.docs as any[]).map((c) => {
                  const pub = c.publication && typeof c.publication === 'object' ? c.publication : null
                  return (
                    <div key={c.id} className="c-card" style={{ padding: 16 }}>
                      <p style={{ color: 'var(--brand-text)', margin: 0 }}>{c.text}</p>
                      {pub?.slug && (
                        <Link
                          href={`/publication/${pub.slug}`}
                          style={{ color: 'var(--brand-primary)', fontSize: 13, marginTop: 6, display: 'inline-block' }}
                        >
                          {pub.title || 'Публикация'} →
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
          <div
            className="c-card"
            style={{ padding: 22, marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
          >
            <span style={{ color: 'var(--brand-muted)' }}>
              Войдите, чтобы видеть активность и стать частью сообщества.
            </span>
            <span style={{ display: 'flex', gap: 10 }}>
              <Link href="/register" className="c-btn c-btn--primary">Регистрация</Link>
              <Link href={`/login?redirect=/u/${profile.handle}`} className="c-btn c-btn--surface">Войти</Link>
            </span>
          </div>
        )}
      </div>
    </main>
  )
}
