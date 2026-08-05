import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { slugify } from '../lib/slugify'
import fs from 'fs'
import path from 'path'

/**
 * Пустышки каталога «Маруся Озвучка»: три раздела-контейнера (Слушать / Эфиры /
 * Влоги) и по одной ПУСТОЙ работе-серии (категория videoSeries) на каждую
 * позицию из списка. Без аудио/обложек/тегов — их дозаливаем потом.
 *
 * ИСТОЧНИК: data/maru-source.txt — вставь СВОЙ исходный список как есть (та самая
 * нумерованная простыня со ссылками). Скрипт сам вытащит названия из [ ... ],
 * почистит, раскидает по разделам по ключевым словам (влог → Влоги;
 * стрим/концерт/эфир/sowoozoo/столовка → Эфиры; остальное → Слушать).
 *
 * ЗАПУСК (прод-база maruozvuchka):
 *   # 1) DRY-RUN — распарсить и показать, что будет создано (безопасно):
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-maru-stubs.ts
 *
 *   # 2) Создать:
 *   CONFIRM=CREATE DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-maru-stubs.ts
 *
 * Идемпотентно: работа с уже существующим slug под своим разделом пропускается,
 * так что повторный запуск безопасен (дозальёт только новое).
 */

const SUB = 'maruozvuchka'
const SOURCE = process.env.SOURCE || 'data/maru-source.txt'

type Section = 'listen' | 'streams' | 'vlogs'
const SECTION_TITLE: Record<Section, string> = { listen: 'Слушать', streams: 'Эфиры', vlogs: 'Влоги' }
const SECTION_ORDER: Record<Section, number> = { listen: 1, streams: 2, vlogs: 3 }

/** Название работы из строки списка: берём текст первой ссылки [ ... ], иначе
 *  текст после номера. Чистим кавычки/пробелы/мусор по краям. */
function parseTitle(line: string): string {
  const m = line.match(/\[([^\]]+)\]/)
  let t = m ? m[1] : line.replace(/^\s*№?\s*\d+\s*[.)]?\s*/, '')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/^["'«»._\s]+/, '').replace(/["'«»._\s]+$/, '').trim()
  return t
}

function classify(title: string): Section {
  const t = title.toLowerCase()
  if (/влог/.test(t)) return 'vlogs'
  if (/стрим|концерт|эфир|sowoozoo|столовка|\(запись/.test(t)) return 'streams'
  return 'listen'
}

async function ensureRoot(payload: any, tenantId: number, section: Section): Promise<number> {
  const title = SECTION_TITLE[section]
  const slug = slugify(title) || section
  const found = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }, { parent: { exists: false } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (found.docs.length > 0) return found.docs[0].id as number
  const doc = await payload.create({
    collection: 'categories',
    data: {
      tenant: tenantId, title, slug, parent: null,
      order: SECTION_ORDER[section],
      showInHeader: true, showInFooter: false,
      videoSeries: false, posterLayout: true,
    } as any,
    depth: 0, overrideAccess: true,
  })
  console.log(`  + раздел «${title}» (#${doc.id})`)
  return doc.id as number
}

async function main() {
  const doWrite = process.env.CONFIRM === 'CREATE'

  const srcPath = path.resolve(process.cwd(), SOURCE)
  if (!fs.existsSync(srcPath)) {
    console.error(`Нет файла со списком: ${SOURCE}. Сохрани туда свой исходный список и запусти снова.`)
    process.exit(1)
  }
  const raw = fs.readFileSync(srcPath, 'utf-8')

  // Парсим строки, которые начинаются с номера (позиции списка).
  const seen = new Set<string>()
  const works: { title: string; section: Section; slug: string }[] = []
  const slugsBySection: Record<Section, Set<string>> = { listen: new Set(), streams: new Set(), vlogs: new Set() }
  let skippedEmpty = 0, skippedDup = 0

  for (const line of raw.split('\n')) {
    if (!/^\s*\d+\s*[.)\]\s\[]/.test(line)) continue // только строки-позиции
    const title = parseTitle(line)
    if (!title || title.length < 2) { skippedEmpty++; continue }
    const norm = title.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(norm)) { skippedDup++; continue }
    seen.add(norm)
    const section = classify(title)
    const base = slugify(title) || `work-${works.length + 1}`
    let slug = base
    let n = 2
    while (slugsBySection[section].has(slug)) slug = `${base}-${n++}`
    slugsBySection[section].add(slug)
    works.push({ title, section, slug })
  }

  const counts = { listen: 0, streams: 0, vlogs: 0 } as Record<Section, number>
  for (const w of works) counts[w.section]++

  console.log(`Распознано работ: ${works.length}  (пропущено: пустых ${skippedEmpty}, дублей ${skippedDup})`)
  console.log(`  Слушать: ${counts.listen} · Эфиры: ${counts.streams} · Влоги: ${counts.vlogs}`)
  console.log('')

  if (!doWrite) {
    console.log('DRY-RUN — ничего не создано. Список (раздел · название):')
    for (const w of works) console.log(`  [${SECTION_TITLE[w.section]}] ${w.title}`)
    console.log('')
    console.log('Проверь классификацию/названия (правь data/maru-source.txt при необходимости).')
    console.log('Создать: CONFIRM=CREATE ... npx tsx src/scripts/seed-maru-stubs.ts')
    process.exit(0)
  }

  const payload = await getPayload({ config })
  const t = await payload.find({ collection: 'tenants', where: { subdomain: { equals: SUB } }, limit: 1, depth: 0, overrideAccess: true })
  if (t.docs.length === 0) { console.error(`Тенант "${SUB}" не найден.`); process.exit(1) }
  const tenantId = t.docs[0].id as number

  const rootId: Record<Section, number> = {
    listen: await ensureRoot(payload, tenantId, 'listen'),
    streams: await ensureRoot(payload, tenantId, 'streams'),
    vlogs: await ensureRoot(payload, tenantId, 'vlogs'),
  }

  let created = 0, skipped = 0
  for (const w of works) {
    const parent = rootId[w.section]
    const exists = await payload.find({
      collection: 'categories',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: w.slug } }, { parent: { equals: parent } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (exists.docs.length > 0) { skipped++; continue }
    await payload.create({
      collection: 'categories',
      data: {
        tenant: tenantId, title: w.title, slug: w.slug, parent: parent as any,
        order: 0, showInHeader: false, showInFooter: false,
        videoSeries: true, posterLayout: false,
      } as any,
      depth: 0, overrideAccess: true,
    })
    created++
    if (created % 25 === 0) console.log(`   … создано ${created}`)
  }

  console.log('')
  console.log(`✓ Готово. Создано работ-пустышек: ${created}, пропущено (уже были): ${skipped}.`)
  console.log('  Разделы Слушать/Эфиры/Влоги в шапке; работы — пустые серии, дозаливай аудио в студии (Медиа → Аудио, поле «Категория»).')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
