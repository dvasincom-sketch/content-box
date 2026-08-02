import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { SubmitForm } from './SubmitForm'

/** Отправка публикации участником (внутри кабинета). */
export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  const ctx = await getTenantFromHeaders()
  const tenant = (ctx as any)?.tenant
  const payload = await getPayload({ config: await config })
  const catsRes = tenant?.id
    ? await payload.find({ collection: 'categories', where: { tenant: { equals: tenant.id } }, sort: 'title', limit: 200, depth: 0, overrideAccess: true })
    : { docs: [] as any[] }
  const categories = (catsRes.docs as any[]).map((c) => ({
    id: c.id as number,
    title: (c.title || c.slug || `#${c.id}`) as string,
    parentId: c.parent ? (typeof c.parent === 'object' ? Number(c.parent.id) : Number(c.parent)) : null,
  }))

  return <SubmitForm categories={categories} />
}
