import type { MetadataRoute } from 'next'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { categoryHref } from '@/lib/categoryHref'

/**
 * Динамический per-tenant sitemap.xml (ТЗ §6).
 *
 * Тенант определяется по заголовку x-tenant-id, который инжектит proxy.ts
 * (тот же механизм, что и getTenantFromHeaders). Базовый URL берётся из
 * заголовка host запроса — так sitemap на домене X всегда отдаёт URL с
 * доменом X (корректно для мультидомена).
 *
 * В карту попадают только «непустые» категории: те, у которых есть описание,
 * есть подкатегории или есть публикации. Голые листья (галереи, sns-архивы)
 * исключаются, чтобы не отдавать поисковикам тонкие страницы без контента.
 *
 * URL категорий строятся тем же categoryHref, что и ссылки на фронте —
 * значит sitemap и реальные роуты совпадают, без 404.
 */

export const dynamic = 'force-dynamic'

type CatDoc = {
  id: number | string
  slug?: string | null
  updatedAt: string
  parent?: unknown
  description?: unknown
  breadcrumbs?: { url?: string | null }[] | null
}

/** true, если richText Lexical содержит непробельный текст. */
function hasDescription(description: unknown): boolean {
  if (!description || typeof description !== 'object') return false
  const json = JSON.stringify(description)
  // Быстрая проверка: есть ли хоть один непустой текстовый узел.
  return /"text"\s*:\s*"[^"]/.test(json)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headers = await getHeaders()
  const tenantId = headers.get('x-tenant-id')
  const host = headers.get('host')
  if (!tenantId || !host) return []

  // Схема: за прокси на проде всегда https; локально возможен http.
  const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  const base = `${proto}://${host}`

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Все категории тенанта (depth:1 — нужны breadcrumbs для URL).
  const catsRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: tenantId } },
    limit: 0,
    depth: 1,
    overrideAccess: true,
  })
  const cats = catsRes.docs as CatDoc[]

  // Множество id, у которых есть хотя бы один ребёнок.
  const parentIds = new Set<string>()
  for (const c of cats) {
    const p = c.parent
    const pid =
      p && typeof p === 'object' ? (p as { id?: unknown }).id : p
    if (pid != null) parentIds.add(String(pid))
  }

  // Категории тенанта, у которых есть хотя бы одна публикация.
  // Один запрос: тянем category-ссылки всех публикаций тенанта.
  const pubsRes = await payload.find({
    collection: 'publications',
    where: { tenant: { equals: tenantId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  const pubs = pubsRes.docs as { slug?: string | null; updatedAt: string; category?: unknown }[]

  const catsWithPubs = new Set<string>()
  for (const pub of pubs) {
    const cat = pub.category
    const cid = cat && typeof cat === 'object' ? (cat as { id?: unknown }).id : cat
    if (cid != null) catsWithPubs.add(String(cid))
  }

  // Фильтр «непустая»: описание ИЛИ есть дети ИЛИ есть публикации.
  const meaningful = cats.filter((c) => {
    const id = String(c.id)
    return hasDescription(c.description) || parentIds.has(id) || catsWithPubs.has(id)
  })

  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...meaningful.map((c) => ({
      url: `${base}${categoryHref(c)}`,
      lastModified: new Date(c.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...pubs
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${base}/publication/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
  ]

  return entries
}
