/**
 * Разовый бэкфилл SEO-полей для уже существующих категорий.
 *
 * Хук beforeChange заполняет seo.title / seo.description только при сохранении
 * документа, поэтому старые записи остаются пустыми, пока их кто-то не пересохранит.
 * Этот скрипт проходит по всем категориям и проставляет пустые SEO-поля
 * по той же логике, что и хук.
 *
 * НЕ перезаписывает уже заполненные вручную SEO-поля.
 *
 * Запуск (прод — только с явным DATABASE_URL):
 *   cd ~/content-box && DATABASE_URL="$PROD_DB" npx tsx src/scripts/backfill-seo.ts
 *
 * Флаги:
 *   --dry     показать, что будет изменено, но НЕ писать в БД
 *   --tenant  ID тенанта (по умолчанию все)
 *   --force   перезаписать даже непустые SEO-поля
 */
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '../payload.config'
import { extractLexicalText, truncateAtWord } from '../utils/lexicalText'

const SEO_TITLE_MAX = 60
const SEO_DESC_MAX = 160
const SITE_NAME = 'COCO JAMBO'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? (process.argv[i + 1] ?? '') : undefined
}
const DRY = process.argv.includes('--dry')
const FORCE = process.argv.includes('--force')
const TENANT = arg('--tenant')

function buildTitle(fullTitle?: string, title?: string): string | undefined {
  const base = fullTitle || title
  if (!base) return undefined
  const suffix = ` | ${SITE_NAME}`
  const room = SEO_TITLE_MAX - suffix.length
  return truncateAtWord(String(base), room) + suffix
}

async function main() {
  const payload = await getPayload({ config })

  const where: Where = {}
  if (TENANT) where.tenant = { equals: Number(TENANT) }

  let page = 1
  let updated = 0
  let skipped = 0
  let scanned = 0

  // Идём страницами по 100.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await payload.find({
      collection: 'categories',
      where,
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
    })

    for (const doc of res.docs as any[]) {
      scanned++
      const seo = doc.seo || {}
      const patch: { title?: string; description?: string } = {}

      if (FORCE || !seo.title) {
        const t = buildTitle(doc.fullTitle, doc.title)
        if (t) patch.title = t
      }
      if (FORCE || !seo.description) {
        const text = extractLexicalText(doc.description)
        if (text) patch.description = truncateAtWord(text, SEO_DESC_MAX)
      }

      if (Object.keys(patch).length === 0) {
        skipped++
        continue
      }

      const nextSeo = { ...seo, ...patch }

      if (DRY) {
        console.log(`[dry] #${doc.id} ${doc.fullTitle || doc.title}`)
        if (patch.title) console.log(`      title: ${patch.title}`)
        if (patch.description)
          console.log(`      desc:  ${String(patch.description).slice(0, 80)}…`)
        updated++
        continue
      }

      try {
        await payload.update({
          collection: 'categories',
          id: doc.id,
          data: { seo: nextSeo },
          depth: 0,
          overrideAccess: true,
          // context пропускаем — хук всё равно не перезапишет уже заданное
        })
        console.log(`✓ #${doc.id} ${doc.fullTitle || doc.title}`)
        updated++
      } catch (e) {
        console.error(`✗ #${doc.id} ${doc.fullTitle || doc.title}:`, (e as Error).message)
        skipped++
      }
    }

    if (page >= res.totalPages) break
    page++
  }

  console.log(
    `\nГотово. Просмотрено: ${scanned}, обновлено: ${updated}, пропущено: ${skipped}.` +
      (DRY ? ' (dry-run, БД не изменялась)' : ''),
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
