/**
 * Разовый бэкфилл SEO-полей для существующих категорий и публикаций.
 *
 * Зачем: хук beforeChange у категорий заполняет seo.title/description только при
 * сохранении и только из текста тела — старые записи и записи БЕЗ текста тела
 * остаются без описания (видно в /admin/seo-audit). У публикаций авто-описания
 * нет вовсе. Этот скрипт проставляет пустые seo-поля «из контекста страницы»
 * (см. lib/seoAutoDescription): текст тела → иначе заголовок + раздел + ключи +
 * бренд. Уже заполненные вручную поля НЕ трогает (без --force).
 *
 * Запуск (прод — только с явным DATABASE_URL, БД Timeweb закрыта по IP, из
 * песочницы недоступна — запускать в терминале Dmitry):
 *   cd ~/content-box && DATABASE_URL="$PROD_DB" npx tsx src/scripts/backfill-seo.ts
 *
 * Флаги:
 *   --dry      показать, что будет изменено, но НЕ писать в БД
 *   --tenant   ID тенанта (по умолчанию все)
 *   --force    перезаписать даже непустые seo-поля
 *   --only     categories | publications (по умолчанию обе)
 */
import 'dotenv/config' // грузим .env (PAYLOAD_SECRET и пр.) — standalone-скрипт, не Next
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '../payload.config'
import { extractLexicalText, truncateAtWord } from '../utils/lexicalText'
import { autoSeoDescription, PUB_INTENT_BY_SLUG, SEO_DESC_MAX } from '../lib/seoAutoDescription'

const SEO_TITLE_MAX = 60
const SITE_NAME = 'COCO JAMBO'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? (process.argv[i + 1] ?? '') : undefined
}
const DRY = process.argv.includes('--dry')
const FORCE = process.argv.includes('--force')
const TENANT = arg('--tenant')
const ONLY = (arg('--only') || '').trim() // '' = обе коллекции

function buildTitle(fullTitle?: string, title?: string): string | undefined {
  const base = fullTitle || title
  if (!base) return undefined
  const suffix = ` | ${SITE_NAME}`
  const room = SEO_TITLE_MAX - suffix.length
  return truncateAtWord(String(base), room) + suffix
}

function relId(v: unknown): string | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? (v as { id?: unknown }).id : v
  return raw == null ? null : String(raw)
}

async function main() {
  // Защита от случайного подключения к локальной БД: без DATABASE_URL pg уходит
  // на дефолты (БД по имени пользователя) и создаёт мусор. Требуем явный адрес.
  if (!String(process.env.DATABASE_URL || '').trim()) {
    console.error(
      'DATABASE_URL не задан. Укажи строку подключения к прод-БД, напр.:\n' +
        '  DATABASE_URL="postgres://user:pass@host:5432/dbname" npx tsx src/scripts/backfill-seo.ts --dry',
    )
    process.exit(1)
  }

  const payload = await getPayload({ config })

  const where: Where = {}
  if (TENANT) where.tenant = { equals: Number(TENANT) }

  // Карта доменов тенантов — для брендовых формулировок описаний.
  const tenantDomain = new Map<string, string>()
  try {
    const tenants = await payload.find({ collection: 'tenants', limit: 0, depth: 0, overrideAccess: true })
    for (const t of tenants.docs as any[]) tenantDomain.set(String(t.id), String(t.domain || ''))
  } catch { /* домены не критичны — без бренда опишем нейтрально */ }
  const domainOf = (doc: any): string | undefined => tenantDomain.get(relId(doc.tenant) || '') || undefined

  let updated = 0
  let skipped = 0
  let scanned = 0

  // ── Категории ──────────────────────────────────────────────────────────
  if (ONLY !== 'publications') {
    let page = 1
    while (true) {
      const res = await payload.find({ collection: 'categories', where, limit: 100, page, depth: 0, overrideAccess: true })
      for (const doc of res.docs as any[]) {
        scanned++
        const seo = doc.seo || {}
        const patch: { title?: string; description?: string } = {}

        if (FORCE || !seo.title) {
          const t = buildTitle(doc.fullTitle, doc.title)
          if (t) patch.title = t
        }
        if (FORCE || !seo.description) {
          const kws = Array.isArray(doc.seo?.targetKeywords)
            ? (doc.seo.targetKeywords as any[]).map((k) => String(k?.keyword || '').trim()).filter(Boolean)
            : []
          const d = autoSeoDescription({
            domain: domainOf(doc),
            bodyText: extractLexicalText(doc.description),
            leadTitle: doc.fullTitle || doc.title,
            keywords: kws,
            flavor: 'category',
          })
          if (d) patch.description = d
        }

        if (Object.keys(patch).length === 0) { skipped++; continue }
        const nextSeo = { ...seo, ...patch }
        if (DRY) {
          console.log(`[dry][cat] #${doc.id} ${doc.fullTitle || doc.title}`)
          if (patch.title) console.log(`      title: ${patch.title}`)
          if (patch.description) console.log(`      desc:  ${String(patch.description).slice(0, 90)}…`)
          updated++
          continue
        }
        try {
          await payload.update({ collection: 'categories', id: doc.id, data: { seo: nextSeo }, depth: 0, overrideAccess: true })
          console.log(`✓ [cat] #${doc.id} ${doc.fullTitle || doc.title}`)
          updated++
        } catch (e) {
          console.error(`✗ [cat] #${doc.id}:`, (e as Error).message)
          skipped++
        }
      }
      if (page >= res.totalPages) break
      page++
    }
  }

  // ── Публикации ─────────────────────────────────────────────────────────
  if (ONLY !== 'categories') {
    let page = 1
    while (true) {
      // depth:1 — чтобы знать slug основной категории (тип контента для описания).
      const res = await payload.find({ collection: 'publications', where, limit: 100, page, depth: 1, overrideAccess: true })
      for (const doc of res.docs as any[]) {
        scanned++
        const seo = doc.seo || {}
        // Публикациям трогаем только описание (title строится в рантайме бренд-логикой).
        if (!FORCE && seo.description) { skipped++; continue }
        const cat = doc.category && typeof doc.category === 'object' ? doc.category : null
        const intent = cat?.slug ? PUB_INTENT_BY_SLUG[String(cat.slug)] : undefined
        const d = autoSeoDescription({
          domain: domainOf(doc),
          bodyText: extractLexicalText(doc.description),
          leadTitle: doc.title,
          flavor: 'publication',
          intent,
        })
        if (!d) { skipped++; continue }
        const nextSeo = { ...seo, description: truncateAtWord(d, SEO_DESC_MAX) }
        if (DRY) {
          console.log(`[dry][pub] #${doc.id} ${doc.title}`)
          console.log(`      desc:  ${String(nextSeo.description).slice(0, 90)}…`)
          updated++
          continue
        }
        try {
          await payload.update({ collection: 'publications', id: doc.id, data: { seo: nextSeo }, depth: 0, overrideAccess: true })
          console.log(`✓ [pub] #${doc.id} ${doc.title}`)
          updated++
        } catch (e) {
          console.error(`✗ [pub] #${doc.id}:`, (e as Error).message)
          skipped++
        }
      }
      if (page >= res.totalPages) break
      page++
    }
  }

  console.log(`\nГотово. Просмотрено: ${scanned}, обновлено: ${updated}, пропущено: ${skipped}.` + (DRY ? ' (dry-run, БД не изменялась)' : ''))
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
