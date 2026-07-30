import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import fs from 'fs'
import path from 'path'

/**
 * ПОЛНАЯ ПЕРЕЗАГРУЗКА контента одного тенанта (Coco Jambo / bts-russia.ru):
 * снести весь старый контент и засеять новый скелет категорий из
 * data/bts-tree.txt (два блока — «Смотреть» и «Мир BTS»).
 *
 * ─── БЕЗОПАСНОСТЬ ────────────────────────────────────────────────────────
 *  • По умолчанию DRY-RUN: только считает и печатает, НИЧЕГО не трогает.
 *  • Реальная чистка+сев — только с CONFIRM=WIPE.
 *  • Перед удалением пишет полный JSON-бэкап затрагиваемых коллекций в
 *    data/backup-bts-<tenant>-<timestamp>.json. Это твой откат.
 *  • Тенант ищется по subdomain='bts', иначе по имени ~'coco'. Если найдено
 *    ноль или больше одного — скрипт выходит, ничего не делая.
 *
 * ─── ЗАПУСК ──────────────────────────────────────────────────────────────
 *   # 1. Посмотреть, что будет удалено и создано (безопасно):
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" \
 *     npx tsx src/scripts/reset-and-seed-bts.ts
 *
 *   # 2. Выполнить (СНАЧАЛА СНИМИ ДАМП БАЗЫ pg_dump!):
 *   CONFIRM=WIPE DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" \
 *     npx tsx src/scripts/reset-and-seed-bts.ts
 *
 * ─── FK ──────────────────────────────────────────────────────────────────
 *  Все внешние ключи на удаляемые таблицы — SET NULL или CASCADE (проверено),
 *  поэтому порядок удаления не роняет БД. Порядок ниже выбран так, чтобы
 *  сначала уходили зависимые записи (вовлечённость), потом контент.
 */

// Коллекции вовлечённости — привязаны к удаляемому контенту, чистим первыми.
// follows (соцсвязь подписчик↔подписчик) НЕ трогаем — она не про контент.
const ENGAGEMENT = ['views', 'bookmarks', 'reactions', 'comments', 'submissions', 'activity-events'] as const
// Контент. Порядок: зависимые ссылки → корни таксономии → медиа.
const CONTENT = [
  'publications',
  'videos',
  'menu-items',
  'gallery-images',
  'gallery-folders',
  'video-folders',
  'categories',
  'media',
] as const
// Что кладём в бэкап (всё удаляемое + site-settings, у которого ссылки занулятся).
const BACKUP_COLLECTIONS = [...ENGAGEMENT, ...CONTENT, 'site-settings'] as const

type Flags = {
  showInHeader: boolean
  videoSeries: boolean
  posterLayout: boolean
  showInFooter: boolean
  feed: boolean
}
type Row = { path: string; title: string; flags: Flags; order: number }

function parseFlags(raw: string | undefined): Flags {
  const set = new Set((raw ?? '').split(',').map((s) => s.trim()).filter(Boolean))
  return {
    showInHeader: set.has('header'),
    videoSeries: set.has('playlist'),
    posterLayout: set.has('posters'),
    showInFooter: set.has('footer'),
    feed: set.has('feed'),
  }
}

/** Разбор дерева. order — позиция среди СОСЕДЕЙ (в порядке файла). */
function parseTree(file: string): Row[] {
  const raw = fs.readFileSync(file, 'utf-8')
  const rows: Row[] = []
  const orderByParent = new Map<string, number>()
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [p, title, flags] = trimmed.split('|').map((s) => s?.trim())
    if (!p || !title) continue
    const parentPath = p.split('/').slice(0, -1).join('/')
    const ord = orderByParent.get(parentPath) ?? 0
    orderByParent.set(parentPath, ord + 1)
    rows.push({ path: p, title, flags: parseFlags(flags), order: ord })
  }
  return rows
}

async function main() {
  const confirmed = process.env.CONFIRM === 'WIPE'
  const payload = await getPayload({ config: await config })

  // ─── Тенант ──────────────────────────────────────────────────────────
  let tenantRes = await payload.find({
    collection: 'tenants',
    where: { subdomain: { equals: 'bts' } },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  if (tenantRes.docs.length === 0) {
    tenantRes = await payload.find({
      collection: 'tenants',
      where: { name: { like: 'coco' } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
  }
  if (tenantRes.docs.length === 0) {
    console.error('✖ Тенант не найден (ни subdomain="bts", ни name~"coco"). Ничего не делаю.')
    process.exit(1)
  }
  if (tenantRes.docs.length > 1) {
    console.error('✖ Найдено несколько тенантов — уточните. Кандидаты:')
    for (const d of tenantRes.docs as any[]) {
      console.error(`   #${d.id}  ${d.name}  (subdomain=${d.subdomain ?? '—'}, domain=${d.domain ?? '—'})`)
    }
    process.exit(1)
  }
  const tenant = tenantRes.docs[0] as any
  const tenantID = tenant.id
  console.log(`\nТенант: #${tenantID} «${tenant.name}» (subdomain=${tenant.subdomain ?? '—'}, domain=${tenant.domain ?? '—'})`)
  console.log(`Режим:  ${confirmed ? '⚠  РЕАЛЬНАЯ ЧИСТКА + СЕВ (CONFIRM=WIPE)' : 'DRY-RUN (ничего не меняется)'}\n`)

  // ─── Дерево ──────────────────────────────────────────────────────────
  const treeFile = path.resolve(process.cwd(), 'data/bts-tree.txt')
  if (!fs.existsSync(treeFile)) {
    console.error(`✖ Нет файла дерева: ${treeFile}`)
    process.exit(1)
  }
  const rows = parseTree(treeFile)
  console.log(`Дерево для сева: ${rows.length} категорий (${rows.filter((r) => r.flags.showInHeader).length} в шапке).`)

  // ─── Подсчёт того, что будет удалено ─────────────────────────────────
  const counts: Record<string, number> = {}
  for (const slug of BACKUP_COLLECTIONS) {
    if (slug === 'site-settings') continue // не удаляем, только бэкапим
    const res = await payload.find({
      collection: slug as any,
      where: { tenant: { equals: tenantID } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    counts[slug] = res.totalDocs
  }
  console.log('\nБудет удалено (текущий контент тенанта):')
  for (const slug of [...ENGAGEMENT, ...CONTENT]) {
    console.log(`   ${slug.padEnd(16)} ${counts[slug] ?? 0}`)
  }

  if (!confirmed) {
    console.log('\nDRY-RUN завершён. Ничего не изменено.')
    console.log('Чтобы выполнить: сними pg_dump базы, затем запусти с CONFIRM=WIPE.\n')
    process.exit(0)
  }

  // ─── Бэкап ───────────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup: Record<string, any[]> = {}
  for (const slug of BACKUP_COLLECTIONS) {
    const res = await payload.find({
      collection: slug as any,
      where: { tenant: { equals: tenantID } },
      limit: 100000,
      depth: 0,
      overrideAccess: true,
    })
    backup[slug] = res.docs
  }
  const backupPath = path.resolve(process.cwd(), `data/backup-bts-${tenantID}-${stamp}.json`)
  fs.writeFileSync(backupPath, JSON.stringify({ tenant, savedAt: stamp, data: backup }, null, 2))
  console.log(`\n✓ Бэкап записан: ${backupPath}`)

  // ─── Удаление ────────────────────────────────────────────────────────
  console.log('\nУдаляю…')
  for (const slug of [...ENGAGEMENT, ...CONTENT]) {
    const before = counts[slug] ?? 0
    if (before === 0) {
      console.log(`   ${slug.padEnd(16)} — пусто`)
      continue
    }
    await payload.delete({
      collection: slug as any,
      where: { tenant: { equals: tenantID } },
      overrideAccess: true,
    })
    console.log(`   ${slug.padEnd(16)} − ${before}`)
  }

  // ─── Сев дерева ──────────────────────────────────────────────────────
  console.log('\nСею дерево категорий…')
  // Создаём родителей раньше детей: сортируем по глубине пути.
  const toCreate = [...rows].sort((a, b) => a.path.split('/').length - b.path.split('/').length)
  const idByPath = new Map<string, number>()
  let created = 0

  for (const row of toCreate) {
    const segments = row.path.split('/')
    const slug = segments[segments.length - 1]
    const parentPath = segments.slice(0, -1).join('/')
    const parentID = parentPath ? idByPath.get(parentPath) : undefined
    if (parentPath && !parentID) {
      throw new Error(`Родитель не найден для ${row.path} (ожидался ${parentPath})`)
    }

    const doc = await payload.create({
      collection: 'categories',
      data: {
        tenant: tenantID,
        title: row.title,
        slug,
        parent: (parentID ?? null) as any,
        order: row.order,
        showInHeader: row.flags.showInHeader,
        showInFooter: row.flags.showInFooter,
        videoSeries: row.flags.videoSeries,
        posterLayout: row.flags.posterLayout,
      } as any,
      depth: 0,
      overrideAccess: true,
    })
    idByPath.set(row.path, doc.id as number)
    created++
    if (created % 25 === 0) console.log(`   … ${created}/${rows.length}`)
  }

  console.log(`\n✓ Готово. Создано категорий: ${created}.`)
  console.log('  Меню шапки/футера соберётся автоматически из дерева (buildMenu).')
  console.log('  Публикации и видео добавляй в студии; связку «Смотреть»↔«Мир BTS»')
  console.log('  задавай полем watchCategory у публикации.\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('Ошибка:', err?.message ?? err)
  const errors = (err as any)?.data?.errors
  if (Array.isArray(errors)) for (const e of errors) console.error(' ', JSON.stringify(e))
  process.exit(1)
})
