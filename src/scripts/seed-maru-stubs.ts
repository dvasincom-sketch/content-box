import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { slugify } from '../lib/slugify'
import fs from 'fs'
import path from 'path'

/**
 * Пустышки каталога «Маруся Озвучка» из СТРУКТУРИРОВАННОГО списка.
 *
 * Три раздела-контейнера (Слушать / Эфиры / Влоги) → подразделы → по одной
 * ПУСТОЙ работе-серии (категория videoSeries) на каждую позицию. Без аудио/
 * обложек/тегов — их дозаливаем в Фазе 2.
 *
 * ИСТОЧНИК: data/maru-source.txt. Формат (иерархия задаётся строками-маркерами):
 *   # РАЗДЕЛ: Слушать        ← раздел (афиша в шапке)
 *   ## Романтика и драма     ← подраздел
 *   1. [Название](url)        ← работа (станет пустой серией под подразделом)
 *   ...
 *   # РАЗДЕЛ: Влоги
 *   80. [ВЛОГИ ИЗ СЕУЛА](url) ← работа без «##» крепится ПРЯМО к разделу
 *
 * Прочие строки на «#» (без «РАЗДЕЛ:») — комментарии, игнорируются.
 *
 * ЗАПУСК (прод-база maruozvuchka):
 *   # 1) DRY-RUN — распарсить и показать дерево (безопасно):
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-maru-stubs.ts
 *
 *   # 2) Создать:
 *   CONFIRM=CREATE DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-maru-stubs.ts
 *
 * Идемпотентно: категория с уже существующим slug под тем же родителем
 * пропускается, повторный запуск дозальёт только новое.
 */

const SUB = 'maruozvuchka'
const SOURCE = process.env.SOURCE || 'data/maru-source.txt'

// Порядок разделов в шапке. Ключ — точное название после «# РАЗДЕЛ:».
const SECTION_ORDER: Record<string, number> = { 'Слушать': 1, 'Эфиры': 2, 'Влоги': 3 }

type Work = { title: string; section: string; sub: string | null }

/** Название работы из строки: текст первой ссылки [ ... ], иначе после номера. */
function parseTitle(line: string): string {
  const m = line.match(/\[([^\]]+)\]/)
  let t = m ? m[1] : line.replace(/^\s*№?\s*\d+\s*[.)]?\s*/, '')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/^["'«»._\s]+/, '').replace(/["'«»._\s]+$/, '').trim()
  return t
}

/** Разбор структурированного файла в плоский список работ с (раздел, подраздел). */
function parseSource(raw: string): Work[] {
  const works: Work[] = []
  let section: string | null = null
  let sub: string | null = null
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/﻿/g, '')
    const secM = line.match(/^\s*#\s*РАЗДЕЛ:\s*(.+?)\s*$/)
    if (secM) {
      section = secM[1].trim()
      sub = null
      continue
    }
    const subM = line.match(/^\s*##\s+(.+?)\s*$/)
    if (subM) {
      sub = subM[1].trim()
      continue
    }
    if (/^\s*#/.test(line)) continue // прочий комментарий
    if (!section) continue
    if (!/\[[^\]]+\]/.test(line)) continue // строка-работа обязана иметь [ссылку]
    const title = parseTitle(line)
    if (!title || title.length < 2) continue
    works.push({ title, section, sub })
  }
  return works
}

async function ensureCategory(
  payload: any,
  tenantId: number,
  opts: { title: string; parent: number | null; order: number; isSection: boolean; isWork: boolean },
): Promise<number> {
  const base = slugify(opts.title) || `cat-${Date.now()}`
  // slug уникален в пределах родителя — ищем именно под этим parent.
  const parentCond = opts.parent == null ? { parent: { exists: false } } : { parent: { equals: opts.parent } }
  const found = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: base } }, parentCond] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (found.docs.length > 0) return found.docs[0].id as number

  const doc = await payload.create({
    collection: 'categories',
    data: {
      tenant: tenantId,
      title: opts.title,
      slug: base,
      parent: opts.parent,
      order: opts.order,
      // Разделы — в шапке афишами; подразделы и работы — нет.
      showInHeader: opts.isSection,
      showInFooter: false,
      // Работа = серия (плейлист частей). Раздел/подраздел — обычные категории.
      videoSeries: opts.isWork,
      // Плитки-постеры для разделов и подразделов (витрина), у работы — как серия.
      posterLayout: !opts.isWork,
    } as any,
    depth: 0, overrideAccess: true,
  })
  return doc.id as number
}

async function main() {
  const doWrite = process.env.CONFIRM === 'CREATE'

  const srcPath = path.resolve(process.cwd(), SOURCE)
  if (!fs.existsSync(srcPath)) {
    console.error(`Нет файла со списком: ${SOURCE}. Сохрани туда каталог и запусти снова.`)
    process.exit(1)
  }
  const works = parseSource(fs.readFileSync(srcPath, 'utf-8'))

  // Дерево для отчёта: раздел → подраздел(|'—') → [работы]
  const tree = new Map<string, Map<string, string[]>>()
  const seenPerParent = new Map<string, Set<string>>() // ключ "section|sub" → set slug (дедуп)
  let dup = 0
  for (const w of works) {
    const subKey = w.sub ?? '—'
    if (!tree.has(w.section)) tree.set(w.section, new Map())
    const subs = tree.get(w.section)!
    if (!subs.has(subKey)) subs.set(subKey, [])
    const pkey = `${w.section}|${subKey}`
    if (!seenPerParent.has(pkey)) seenPerParent.set(pkey, new Set())
    const slug = slugify(w.title) || w.title
    if (seenPerParent.get(pkey)!.has(slug)) { dup++; continue }
    seenPerParent.get(pkey)!.add(slug)
    subs.get(subKey)!.push(w.title)
  }

  let total = 0
  console.log(`Разобрано работ: ${works.length} (дублей пропущено: ${dup})\n`)
  for (const [section, subs] of tree) {
    let secCount = 0
    for (const list of subs.values()) secCount += list.length
    total += secCount
    console.log(`# ${section}  (${secCount})`)
    for (const [sub, list] of subs) {
      console.log(`  ## ${sub}  (${list.length})`)
      if (!doWrite) for (const t of list) console.log(`      • ${t}`)
    }
  }
  console.log(`\nВсего работ к созданию: ${total}`)

  if (!doWrite) {
    console.log('\nDRY-RUN — ничего не создано. Проверь дерево (правь data/maru-source.txt).')
    console.log('Создать: CONFIRM=CREATE ... npx tsx src/scripts/seed-maru-stubs.ts')
    process.exit(0)
  }

  console.log('Подключаюсь к базе… (первый запрос может занять время)')
  const payload = await getPayload({ config })
  const t = await payload.find({ collection: 'tenants', where: { subdomain: { equals: SUB } }, limit: 1, depth: 0, overrideAccess: true })
  if (t.docs.length === 0) { console.error(`Тенант "${SUB}" не найден.`); process.exit(1) }
  const tenantId = t.docs[0].id as number
  console.log(`Тенант «${SUB}» #${tenantId}. Начинаю создание (по сети к прод-базе — идёт последовательно).\n`)

  const t0 = Date.now()
  let created = 0, skipped = 0, done = 0
  for (const [section, subs] of tree) {
    const rootId = await ensureCategory(payload, tenantId, {
      title: section, parent: null, order: SECTION_ORDER[section] ?? 99, isSection: true, isWork: false,
    })
    console.log(`# ${section}  → #${rootId}`)
    let subOrder = 1
    for (const [sub, list] of subs) {
      // '—' означает «прямо под разделом» (влоги): родитель работ = сам раздел.
      const parentId = sub === '—'
        ? rootId
        : await ensureCategory(payload, tenantId, {
            title: sub, parent: rootId, order: subOrder++, isSection: false, isWork: false,
          })
      if (sub !== '—') console.log(`  ## ${sub}  → #${parentId}`)
      let workOrder = 1
      const beforeSlugs = new Set<string>()
      for (const title of list) {
        const slug = slugify(title) || title
        if (beforeSlugs.has(slug)) { skipped++; done++; continue }
        beforeSlugs.add(slug)
        const existing = await payload.find({
          collection: 'categories',
          where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }, { parent: { equals: parentId } }] },
          limit: 1, depth: 0, overrideAccess: true,
        })
        if (existing.docs.length > 0) { skipped++; done++; continue }
        await ensureCategory(payload, tenantId, {
          title, parent: parentId, order: workOrder++, isSection: false, isWork: true,
        })
        created++; done++
        // Живой прогресс: строка каждые 5 работ, чтобы было видно движение.
        if (done % 5 === 0 || done === total) {
          const sec = Math.round((Date.now() - t0) / 1000)
          process.stdout.write(`\r    прогресс: ${done}/${total} (создано ${created}, пропущено ${skipped}) · ${sec}s   `)
        }
      }
    }
    process.stdout.write('\n')
    console.log(`  ✓ раздел «${section}» готов`)
  }

  console.log(`\nГотово. Создано работ: ${created}, пропущено (уже были): ${skipped}.`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
