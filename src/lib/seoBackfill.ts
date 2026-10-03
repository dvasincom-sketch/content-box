import type { Payload } from 'payload'
import { extractLexicalText, truncateAtWord } from '@/utils/lexicalText'
import { autoSeoDescription, PUB_INTENT_BY_SLUG, SEO_DESC_MAX } from '@/lib/seoAutoDescription'

/**
 * Пакетный бэкфилл SEO (одна страница за вызов) — для админ-кнопки «Сгенерировать
 * описания» в /admin/seo-audit. Выполняется НА СЕРВЕРЕ приложения, где БД
 * доступна (прод Timeweb закрыт фаерволом по IP — с ноутбука не подключиться).
 *
 * Логика генерации — та же, что в scripts/backfill-seo.ts (lib/seoAutoDescription):
 * текст тела → иначе заголовок + раздел + ключи + бренд. Непустые seo-поля не
 * трогаем (без force). Возвращаем прогресс, чтобы клиент шёл страницами и не
 * упирался в таймаут запроса.
 */
const SEO_TITLE_MAX = 60
const SITE_NAME = 'COCO JAMBO'

function buildTitle(fullTitle?: string, title?: string): string | undefined {
  const base = fullTitle || title
  if (!base) return undefined
  const suffix = ` | ${SITE_NAME}`
  return truncateAtWord(String(base), SEO_TITLE_MAX - suffix.length) + suffix
}

export interface BackfillPageResult {
  collection: 'categories' | 'publications'
  page: number
  totalPages: number
  scanned: number
  updated: number
  skipped: number
  done: boolean
}

export async function backfillSeoPage(
  payload: Payload,
  opts: {
    collection: 'categories' | 'publications'
    tenantId: number | string
    page: number
    limit?: number
    dry?: boolean
    force?: boolean
  },
): Promise<BackfillPageResult> {
  const { collection, tenantId } = opts
  const page = Math.max(1, Number(opts.page) || 1)
  const limit = Math.max(1, Math.min(100, opts.limit || 50))
  const dry = opts.dry === true
  const force = opts.force === true

  // Домен тенанта — для брендовых формулировок описаний.
  let domain: string | undefined
  try {
    const t = (await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })) as any
    domain = t?.domain ? String(t.domain) : undefined
  } catch { /* домен не критичен */ }

  const res = await payload.find({
    collection: collection as any,
    where: { tenant: { equals: tenantId } },
    limit,
    page,
    depth: collection === 'publications' ? 1 : 0,
    overrideAccess: true,
  })

  let updated = 0
  let skipped = 0

  for (const doc of res.docs as any[]) {
    const seo = doc.seo || {}
    const patch: { title?: string; description?: string } = {}

    if (collection === 'categories') {
      if (force || !seo.title) {
        const t = buildTitle(doc.fullTitle, doc.title)
        if (t) patch.title = t
      }
      if (force || !seo.description) {
        const kws = Array.isArray(doc.seo?.targetKeywords)
          ? (doc.seo.targetKeywords as any[]).map((k) => String(k?.keyword || '').trim()).filter(Boolean)
          : []
        const d = autoSeoDescription({
          domain,
          bodyText: extractLexicalText(doc.description),
          leadTitle: doc.fullTitle || doc.title,
          keywords: kws,
          flavor: 'category',
        })
        if (d) patch.description = d
      }
    } else {
      // Публикации: только описание (title строится в рантайме бренд-логикой).
      if (force || !seo.description) {
        const cat = doc.category && typeof doc.category === 'object' ? doc.category : null
        const intent = cat?.slug ? PUB_INTENT_BY_SLUG[String(cat.slug)] : undefined
        const d = autoSeoDescription({
          domain,
          bodyText: extractLexicalText(doc.description),
          leadTitle: doc.title,
          flavor: 'publication',
          intent,
        })
        if (d) patch.description = truncateAtWord(d, SEO_DESC_MAX)
      }
    }

    if (Object.keys(patch).length === 0) { skipped++; continue }
    if (dry) { updated++; continue }
    try {
      await payload.update({
        collection: collection as any,
        id: doc.id,
        data: { seo: { ...seo, ...patch } },
        depth: 0,
        overrideAccess: true,
      })
      updated++
    } catch {
      skipped++
    }
  }

  const totalPages = res.totalPages || 1
  return { collection, page, totalPages, scanned: res.docs.length, updated, skipped, done: page >= totalPages }
}
