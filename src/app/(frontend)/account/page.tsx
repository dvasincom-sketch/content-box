import React from 'react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { suggestHandle } from '@/lib/handle'
import { earnedBadges } from '@/lib/badges'
import { AccountProfileView } from './AccountProfileView'

/**
 * Личный кабинет подписчика → «Мой профиль» (Фаза 1 «Сообщество»).
 * Только для залогиненных; гость уходит на /login с возвратом.
 */
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) redirect('/login?redirect=/account')

  const ctx = await getTenantFromHeaders()
  const settings = (ctx as any)?.settings

  const payload = await getPayload({ config: await config })
  const full = (await payload.findByID({
    collection: 'subscribers',
    id: sub.id,
    depth: 1, // подтянуть avatar (url)
    overrideAccess: true,
  })) as any

  const commentCount = await payload
    .count({ collection: 'comments', where: { and: [{ author: { equals: sub.id } }, { status: { equals: 'published' } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const reactionsReceived = await payload
    .count({ collection: 'activity-events' as any, where: { and: [{ subscriber: { equals: sub.id } }, { type: { equals: 'reaction_received' } }] }, overrideAccess: true })
    .then((r: any) => r.totalDocs).catch(() => 0)
  const badges = earnedBadges({ commentCount, reactionsReceived, level: Number(full?.level) || 0, hasPaidTier: Boolean(full?.activeTier) })

  const avatarUrl = full?.avatar && typeof full.avatar === 'object' ? full.avatar.url : null
  const handle: string = full?.handle || ''
  const suggested = handle || suggestHandle(full?.displayName || full?.email || 'user')

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <AccountProfileView
          displayName={full?.displayName || ''}
          avatarUrl={avatarUrl}
          bio={full?.bio || ''}
          handle={handle}
          suggestedHandle={suggested}
          profilePrivate={Boolean(full?.profilePrivate)}
          hasPaidTier={Boolean(full?.activeTier)}
          level={Number(full?.level) || 0}
          points={Number(full?.points) || 0}
          badges={badges}
        />
      </div>
    </main>
  )
}
