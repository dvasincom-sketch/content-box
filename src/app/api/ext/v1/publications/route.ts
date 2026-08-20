import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { resolveTenantByApiKey } from '@/lib/externalApiAuth'
import { contentToLexical } from '@/lib/mdToLexical'
import { slugify } from '@/lib/slugify'
import { shrinkForWeb, storageName } from '@/lib/imageIngest'

/**
 * Внешний API создания публикации (Фаза 1). Авторизация — X-API-KEY (тенант по
 * ключу, не по хосту). Формат ответа как у Sponsr: { data: { id, url, editor } }.
 *
 * POST /api/ext/v1/publications
 * Body: { title, text, format(markdown|plain), publishedAt, categorySlug|categoryId,
 *         extraCategorySlugs[], access(all|tier), minTierSlug, coverUrl, tags[],
 *         featured, isNews, seoTitle, seoDescription, externalRef }
 */
export const runtime = 'nodejs'

const MAX_COVER_BYTES = 8 * 1024 * 1024

function err(message: string, statusCode = 400) {
  return NextResponse.json({ message, statusCode }, { status: statusCode })
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: await config })
  const ctx = await resolveTenantByApiKey(payload, req.headers.get('x-api-key') || '')
  if (!ctx) return err('Неверный или отсутствующий X-API-KEY', 401)
  const tenantId = ctx.tenantId

  const data = (await req.json().catch(() => null)) as any
  if (!data || typeof data !== 'object') return err('Некорректное тело запроса (ожидается JSON)')

  const title = String(data.title || '').trim()
  if (title.length < 4 || title.length > 256) return err('title должен быть 4..256 символов')

  const format: 'markdown' | 'plain' = data.format === 'plain' ? 'plain' : 'markdown'
  const description = contentToLexical(String(data.text || ''), format)

  // Категория (по slug или id) — в пределах тенанта.
  let category: number | string | null = null
  if (data.categoryId != null && data.categoryId !== '') {
    const cid = Number(data.categoryId)
    if (Number.isFinite(cid) && (await belongsCat(payload, tenantId, cid))) category = cid
    else return err(`Категория не найдена: ${data.categoryId}`)
  } else if (data.categorySlug) {
    category = await findCategoryBySlug(payload, tenantId, String(data.categorySlug))
    if (!category) return err(`Категория не найдена: ${data.categorySlug}`)
  }

  const extraCategories: Array<number | string> = []
  if (Array.isArray(data.extraCategorySlugs)) {
    for (const s of data.extraCategorySlugs) {
      const id = await findCategoryBySlug(payload, tenantId, String(s))
      if (id) extraCategories.push(id)
    }
  }

  // Доступ: all → бесплатно; active/continuity/tier → уровень (minTierSlug либо
  // низший платный уровень тенанта).
  let minTier: number | string | null = null
  const accessTier = data.access === 'tier' || data.access === 'active' || data.access === 'continuity'
  if (accessTier) {
    if (data.minTierSlug) {
      minTier = await findTierBySlug(payload, tenantId, String(data.minTierSlug))
      if (!minTier) return err(`Уровень подписки не найден: ${data.minTierSlug}`)
    } else {
      minTier = await lowestPaidTier(payload, tenantId)
    }
  }

  let cover: number | string | null = null
  if (data.coverUrl) {
    try {
      cover = await ingestCover(payload, tenantId, String(data.coverUrl), title)
    } catch {
      cover = null
    }
  }

  const tags = Array.isArray(data.tags)
    ? (data.tags as unknown[])
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => ({ label: t.trim() }))
    : []

  const publishedAt = (() => {
    if (!data.publishedAt) return new Date().toISOString()
    const d = new Date(String(data.publishedAt))
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  })()

  const domain = await tenantDomain(payload, tenantId)
  const externalRef = data.externalRef ? String(data.externalRef).slice(0, 200) : null

  // Дедуп повторного импорта.
  if (externalRef) {
    const ex = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenantId } }, { externalRef: { equals: externalRef } }] } as any,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const e = ex.docs[0] as any
    if (e) {
      return NextResponse.json({
        data: { id: e.id, url: `https://${domain}/publication/${e.slug}`, editor: `https://${domain}/studio/posts/${e.id}`, deduped: true },
      })
    }
  }

  const owner = await tenantOwnerId(payload, tenantId)
  const slug = await uniqueSlug(payload, tenantId, slugify(title) || 'post')
  const seo =
    data.seoTitle || data.seoDescription
      ? { title: data.seoTitle ? String(data.seoTitle) : undefined, description: data.seoDescription ? String(data.seoDescription) : undefined }
      : undefined

  try {
    const doc = (await payload.create({
      collection: 'publications',
      data: {
        title,
        slug,
        description,
        template: 'article',
        cover,
        category,
        extraCategories,
        minTier,
        tags,
        featured: data.featured === true,
        isNews: data.isNews === true,
        publishedAt,
        externalRef,
        ...(seo ? { seo } : {}),
        ...(owner ? { owner } : {}),
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })) as any

    return NextResponse.json({
      data: {
        id: doc.id,
        url: `https://${domain}/publication/${doc.slug}`,
        editor: `https://${domain}/studio/posts/${doc.id}`,
      },
    })
  } catch {
    return err('Не удалось создать публикацию', 500)
  }
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

async function findCategoryBySlug(payload: any, tenantId: number, slug: string): Promise<number | string | null> {
  const res = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0]?.id ?? null
}

async function belongsCat(payload: any, tenantId: number, id: number): Promise<boolean> {
  try {
    const c = await payload.findByID({ collection: 'categories', id, depth: 0, overrideAccess: true })
    const t = c?.tenant
    const tid = t && typeof t === 'object' ? t.id : t
    return Number(tid) === Number(tenantId)
  } catch {
    return false
  }
}

async function findTierBySlug(payload: any, tenantId: number, slug: string): Promise<number | string | null> {
  const res = await payload.find({
    collection: 'subscription-tiers',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0]?.id ?? null
}

async function lowestPaidTier(payload: any, tenantId: number): Promise<number | string | null> {
  const res = await payload.find({
    collection: 'subscription-tiers',
    where: { and: [{ tenant: { equals: tenantId } }, { isActive: { equals: true } }, { priceRub: { greater_than: 0 } }] },
    sort: 'weight',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0]?.id ?? null
}

async function tenantOwnerId(payload: any, tenantId: number): Promise<number | string | null> {
  const res = await payload.find({
    collection: 'users',
    where: { and: [{ tenant: { equals: tenantId } }, { tenantRole: { not_equals: 'contributor' } }] },
    sort: 'createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0]?.id ?? null
}

async function tenantDomain(payload: any, tenantId: number): Promise<string> {
  try {
    const t = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    return String(t?.domain || 'contentbox.site')
  } catch {
    return 'contentbox.site'
  }
}

async function uniqueSlug(payload: any, tenantId: number, base: string): Promise<string> {
  let candidate = base
  for (let n = 1; n < 200; n++) {
    const res = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: candidate } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (res.totalDocs === 0) return candidate
    candidate = `${base}-${n + 1}`
  }
  return `${base}-${Date.now()}`
}

async function ingestCover(payload: any, tenantId: number, url: string, title: string): Promise<number | string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), cache: 'no-store' })
  if (!res.ok) return null
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!type.startsWith('image/')) return null
  const raw = Buffer.from(await res.arrayBuffer())
  if (raw.length === 0 || raw.length > MAX_COVER_BYTES) return null
  const ing = await shrinkForWeb(raw, type)
  const media = await payload.create({
    collection: 'media',
    data: { tenant: tenantId, alt: title || 'Обложка' } as any,
    file: { data: ing.buffer, name: storageName(tenantId, title || 'cover', ing.ext, 'cover'), mimetype: ing.mime, size: ing.buffer.length },
    overrideAccess: true,
  })
  return media?.id ?? null
}
