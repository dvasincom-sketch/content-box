import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import fs from 'fs'
import path from 'path'

/**
 * Одноразовая чистка: убирает буквальные теги <p>/</p>, попавшие в ТЕКСТ
 * richText-полей из-за старого бага htmlToLexical (пункты списка оборачивались
 * в <p>, и тег сохранялся как текст, удваиваясь при каждом сохранении).
 *
 * Проходит по: publications.description, pages.content, categories.description.
 * Правит только текст-ноды, из которых удаляет подстроки-теги <p …>/</p>.
 * Структуру Lexical не трогает.
 *
 * DRY-RUN по умолчанию. Применение — APPLY=1. Перед записью сохраняет бэкап
 * оригиналов затронутых документов в data/backup-ptags-<время>.json.
 *
 * Запуск:
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/fix-p-tags.ts
 *   APPLY=1 DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/fix-p-tags.ts
 */

const TARGETS: { collection: string; field: string }[] = [
  { collection: 'publications', field: 'description' },
  { collection: 'pages', field: 'content' },
  { collection: 'categories', field: 'description' },
]

// <p>, <p attr…>, </p> — но НЕ <pre> (граница слова после p).
const P_TAG = /<\/?p\b[^>]*>/gi

/** Рекурсивно чистит текст-ноды дерева. Возвращает число изменённых нод. */
function stripInTree(node: any): number {
  if (!node || typeof node !== 'object') return 0
  let changed = 0
  if (node.type === 'text' && typeof node.text === 'string') {
    const next = node.text.replace(P_TAG, '')
    if (next !== node.text) {
      node.text = next
      changed += 1
    }
  }
  if (Array.isArray(node.children)) {
    for (const k of node.children) changed += stripInTree(k)
  }
  return changed
}

type Change = { collection: string; field: string; id: number | string; before: any; after: any }

async function main() {
  const apply = process.env.APPLY === '1'
  const payload = await getPayload({ config: await config })
  console.log(`Режим: ${apply ? 'ЗАПИСЬ (APPLY=1)' : 'DRY-RUN'}\n`)

  // Фаза 1: собрать все изменения, ничего не записывая.
  const changes: Change[] = []
  const perCollection: Record<string, { docs: number; nodes: number }> = {}

  for (const { collection, field } of TARGETS) {
    const res = await payload.find({
      collection: collection as any,
      limit: 100000,
      depth: 0,
      overrideAccess: true,
    })
    let docs = 0
    let nodes = 0
    for (const doc of res.docs as any[]) {
      const data = doc[field]
      if (!data || !data.root) continue
      const after = JSON.parse(JSON.stringify(data))
      const n = stripInTree(after.root)
      if (n > 0) {
        docs += 1
        nodes += n
        changes.push({ collection, field, id: doc.id, before: data, after })
      }
    }
    perCollection[collection] = { docs, nodes }
    console.log(`${collection}.${field}: документов с тегами ${docs}, текст-нод ${nodes}`)
  }

  const totalDocs = changes.length
  const totalNodes = Object.values(perCollection).reduce((s, x) => s + x.nodes, 0)

  if (!apply) {
    console.log(`\nDRY-RUN. Всего документов ${totalDocs}, текст-нод ${totalNodes}.`)
    console.log('Запусти с APPLY=1, чтобы записать (бэкап оригиналов сохранится автоматически).')
    process.exit(0)
  }

  if (totalDocs === 0) {
    console.log('\nНечего чистить — тегов <p> в тексте не найдено.')
    process.exit(0)
  }

  // Бэкап оригиналов ДО записи.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.resolve(process.cwd(), `data/backup-ptags-${stamp}.json`)
  fs.writeFileSync(
    backupPath,
    JSON.stringify(changes.map((c) => ({ collection: c.collection, field: c.field, id: c.id, before: c.before })), null, 2),
  )
  console.log(`\n✓ Бэкап оригиналов: ${backupPath}`)

  // Фаза 2: запись.
  for (const c of changes) {
    await payload.update({
      collection: c.collection as any,
      id: c.id,
      data: { [c.field]: c.after } as any,
      depth: 0,
      overrideAccess: true,
    })
  }

  console.log(`\n✓ Готово. Очищено документов ${totalDocs}, текст-нод ${totalNodes}.`)
  process.exit(0)
}

main().catch((e) => {
  console.error('Ошибка:', e?.message ?? e)
  process.exit(1)
})
