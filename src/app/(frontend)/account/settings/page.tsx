import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { suggestHandle } from '@/lib/handle'
import { SettingsForm } from '../AccountProfileView'
import { HistorySettings } from './HistorySettings'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const payload = await getPayload({ config: await config })
  const full = (await payload.findByID({ collection: 'subscribers', id: sub.id, depth: 1, overrideAccess: true })) as any
  const avatarUrl = full?.avatar && typeof full.avatar === 'object' ? full.avatar.url : null
  const handle: string = full?.handle || ''
  const suggested = handle || suggestHandle(full?.displayName || full?.email || 'user')

  return (
    <>
      <SettingsForm
        displayName={full?.displayName || ''}
        avatarUrl={avatarUrl}
        bio={full?.bio || ''}
        handle={handle}
        suggestedHandle={suggested}
        profilePrivate={Boolean(full?.profilePrivate)}
      />
      <HistorySettings initialEnabled={full?.historyEnabled !== false} />
    </>
  )
}
