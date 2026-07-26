import React from 'react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { SubmitForm } from './SubmitForm'

/** Отправка публикации участником (UGC, Фаза 4). Только для залогиненных. */
export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) redirect('/login?redirect=/account/submit')

  const ctx = await getTenantFromHeaders()
  const tenant = (ctx as any)?.tenant
  const settings = (ctx as any)?.settings

  const payload = await getPayload({ config: await config })
  const catsRes = tenant?.id
    ? await payload.find({ collection: 'categories', where: { tenant: { equals: tenant.id } }, sort: 'title', limit: 200, depth: 0, overrideAccess: true })
    : { docs: [] as any[] }
  const categories = (catsRes.docs as any[]).map((c) => ({ id: c.id as number, title: (c.title || c.slug || `#${c.id}`) as string }))

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <SubmitForm categories={categories} />
      </div>
    </main>
  )
}
