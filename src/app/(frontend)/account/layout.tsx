import React from 'react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { AccountSidebar } from './AccountSidebar'

/** Кабинет участника: боковое меню + контент (Профиль / Публикации / Настройки). */
export const dynamic = 'force-dynamic'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const sub = await getCurrentSubscriber()
  if (!sub) redirect('/login?redirect=/account')

  const ctx = await getTenantFromHeaders()
  const settings = (ctx as any)?.settings
  const payload = await getPayload({ config: await config })
  const full = (await payload.findByID({ collection: 'subscribers', id: sub.id, depth: 1, overrideAccess: true })) as any
  const avatarUrl = full?.avatar && typeof full.avatar === 'object' ? full.avatar.url : null

  // Разделы «Библиотека» и «История» показываем только при активности (иначе прячем).
  const cnt = (collection: string, where: any): Promise<number> =>
    payload.count({ collection: collection as any, where, overrideAccess: true }).then((r: any) => r.totalDocs).catch(() => 0)
  const [bookViews, bookMarks, bookFollows, viewsAll] = await Promise.all([
    cnt('views', { and: [{ subscriber: { equals: sub.id } }, { targetType: { equals: 'book' } }] }),
    cnt('bookmarks', { and: [{ subscriber: { equals: sub.id } }, { targetType: { equals: 'book' } }] }),
    cnt('book-follows', { subscriber: { equals: sub.id } }),
    cnt('views', { subscriber: { equals: sub.id } }),
  ])
  const showLibrary = bookViews + bookMarks + bookFollows > 0
  const showHistory = viewsAll > 0

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="acct">
          <AccountSidebar
            name={full?.displayName || full?.email || 'Профиль'}
            email={full?.email || ''}
            avatarUrl={avatarUrl}
            showLibrary={showLibrary}
            showHistory={showHistory}
          />
          <div className="acct__main">{children}</div>
        </div>
      </div>
    </main>
  )
}
