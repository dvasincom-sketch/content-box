import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { relativeDayLabel } from '@/lib/relativeDate'
import { ExploreView, type FeaturedData } from './ExploreView'

/**
 * Витрина проектов (/explore). Серверная обёртка: тянет РЕАЛЬНЫЕ последние
 * публикации действующего проекта (BTS Russia / Coco Jambo) и их счётчики,
 * затем отдаёт в клиентский ExploreView. Витринные (закрытые) проекты — демо.
 *
 * Featured-тенант определяем по самой свежей опубликованной публикации на
 * площадке (в проде это единственный контентный тенант). Так не нужно знать его
 * точный id/домен, и лента всегда реальная.
 */
export const dynamic = 'force-dynamic'

async function getFeatured(): Promise<FeaturedData | null> {
  try {
    const payload = await getPayload({ config: await config })
    const now = new Date().toISOString()

    // Свежайшая опубликованная публикация → её тенант = действующий проект.
    const latest = await payload.find({
      collection: 'publications',
      where: { publishedAt: { less_than_equal: now } },
      sort: '-publishedAt',
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const first = latest.docs[0] as any
    if (!first) return null
    const rawTenant = first.tenant
    const tenantId = rawTenant && typeof rawTenant === 'object' ? rawTenant.id : rawTenant
    if (!tenantId) return null

    const [pubsRes, subsRes] = await Promise.all([
      payload.find({
        collection: 'publications',
        where: { and: [{ tenant: { equals: tenantId } }, { publishedAt: { less_than_equal: now } }] },
        sort: '-publishedAt',
        limit: 4,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'subscribers',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    const pubs = (pubsRes.docs as any[]).map((d) => {
      const cover = d.cover && typeof d.cover === 'object' ? d.cover : null
      return {
        title: (d.title as string) || 'Без заголовка',
        coverUrl: (cover?.url as string) ?? null,
        dateLabel: relativeDayLabel(d.publishedAt),
        slug: (d.slug as string) ?? null,
      }
    })

    return {
      pubCount: pubsRes.totalDocs,
      subCount: subsRes.totalDocs,
      pubs,
    }
  } catch {
    return null
  }
}

export default async function ExplorePage() {
  const featured = await getFeatured()
  return <ExploreView featured={featured} />
}
