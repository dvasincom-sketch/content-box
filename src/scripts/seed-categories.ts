import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import fs from 'fs'
import path from 'path'

/**
 * Сид дерева категорий из data/categories-tree.txt.
 * Идемпотентный: повторный запуск не плодит дубли.
 *
 * Запуск:
 *   npx tsx src/scripts/seed-categories.ts            (локально)
 *   DATABASE_URL="$PROD_DB" npx tsx src/scripts/seed-categories.ts   (прод)
 */

// Старые корневые категории → их место в новом дереве.
// Перечислены ЯВНО: эвристика «найти корневую с тем же slug» опасна —
// она утаскивает только что созданные корни внутрь их же веток (цикл).
const LEGACY_MAP: Record<string, string> = {
  'run-bts': 'videography/web-series/run-bts',
  'in-the-soop': 'videography/television/in-the-soop-bts',
  documentaries: 'videography/docuseries',
  concerts: 'videography/concerts',
  'weverse-live': 'videography/weverse-live',
  'bon-voyage': 'videography/bon-voyage',
  audio: 'discography/audio',
}

type Row = { path: string; title: string; showInHeader: boolean }

function parseTree(file: string): Row[] {
  const raw = fs.readFileSync(file, 'utf-8')
  const rows: Row[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [p, title, flag] = trimmed.split('|')
    if (!p || !title) continue
    rows.push({ path: p.trim(), title: title.trim(), showInHeader: flag?.trim() === '1' })
  }
  // Сортируем по глубине: родитель создаётся раньше ребёнка.
  return rows.sort((a, b) => a.path.split('/').length - b.path.split('/').length)
}

async function main() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Тенант: берём первый (MVP одного тенанта).
  const tenants = await payload.find({ collection: 'tenants', limit: 1, overrideAccess: true })
  const tenant = tenants.docs[0] as any
  if (!tenant) throw new Error('Тенант не найден.')
  console.log(`Тенант: ${tenant.name} (id ${tenant.id})`)

  const rows = parseTree(path.resolve(process.cwd(), 'data/categories-tree.txt'))
  console.log(`Узлов в дереве: ${rows.length}`)

  // path → id созданной/найденной категории
  const idByPath = new Map<string, number>()
  const touched = new Set<number>() // id, обработанные в этом прогоне

  // Разворачиваем LEGACY_MAP: новый путь → старый slug
  const legacyByNewPath = new Map<string, string>()
  for (const [oldSlug, newPath] of Object.entries(LEGACY_MAP)) {
    legacyByNewPath.set(newPath, oldSlug)
  }

  let created = 0
  let updated = 0

  for (const row of rows) {
    const segments = row.path.split('/')
    const slug = segments[segments.length - 1]
    const parentPath = segments.slice(0, -1).join('/')
    const parentID = parentPath ? idByPath.get(parentPath) : undefined

    if (parentPath && !parentID) {
      throw new Error(`Родитель не найден для ${row.path} (ожидался ${parentPath})`)
    }

    // 1. Ищем по нужному slug + parent — вдруг уже создана прошлым прогоном.
    const bySlug = await payload.find({
      collection: 'categories',
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          { slug: { equals: slug } },
          parentID ? { parent: { equals: parentID } } : { parent: { exists: false } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    let doc = bySlug.docs[0] as any

    // 2. Не нашли — может это старая категория с другим slug?
    if (!doc) {
      const legacySlug = legacyByNewPath.get(row.path)
      if (legacySlug) {
        const legacy = await payload.find({
          collection: 'categories',
          where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: legacySlug } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        doc = legacy.docs[0] as any
        // Не трогаем то, что уже обработали (защита от циклов).
        if (doc && touched.has(doc.id)) doc = null
        if (doc) console.log(`  ↻ переношу legacy "${legacySlug}" → ${row.path}`)
      }
    }

    if (doc) {
      const needsUpdate =
        doc.title !== row.title ||
        doc.slug !== slug ||
        String(doc.parent ?? '') !== String(parentID ?? '') ||
        Boolean(doc.showInHeader) !== row.showInHeader

      if (needsUpdate) {
        doc = await payload.update({
          collection: 'categories',
          id: doc.id,
          data: {
            title: row.title,
            slug,
            parent: (parentID ?? null) as any,
            showInHeader: row.showInHeader,
          },
          depth: 0,
          overrideAccess: true,
        })
        updated++
      }
    } else {
      doc = await payload.create({
        collection: 'categories',
        data: {
          tenant: tenant.id,
          title: row.title,
          slug,
          parent: (parentID ?? null) as any,
          showInHeader: row.showInHeader,
        },
        depth: 0,
        overrideAccess: true,
      })
      created++
    }

    idByPath.set(row.path, doc.id as number)
    touched.add(doc.id as number)

    if ((created + updated) % 25 === 0 && created + updated > 0) {
      console.log(`  ... ${created} создано, ${updated} обновлено`)
    }
  }

  console.log(`\nГотово. Создано: ${created}, обновлено: ${updated}.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Ошибка сида:', err?.message ?? err)
  // ValidationError прячет детали в data.errors — раскрываем.
  const errors = (err as any)?.data?.errors
  if (Array.isArray(errors)) {
    console.error('Детали:')
    for (const e of errors) console.error(' ', JSON.stringify(e))
  }
  process.exit(1)
})
