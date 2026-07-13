/**
 * Импорт целевых ключевиков из CSV Wordstat в поле targetKeywords категорий.
 *
 * CSV — широкая таблица: 9 блоков по 2 колонки (Формулировка, Число запросов),
 * разделённых пустой колонкой. Порядок блоков задан BLOCKS ниже.
 *
 * Заполняются только категории-участники (+ корневая bts). Для каждой берём
 * топ-N запросов по частотности, ПОСЛЕ фильтрации мусора (омонимы: джин-тоник,
 * актриса, adult и т.п.).
 *
 * Запуск (прод — только с явным DATABASE_URL и секретом):
 *   cd ~/content-box && \
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$(grep PAYLOAD_SECRET .env | cut -d= -f2)" \
 *   npx tsx src/scripts/import-keywords.ts --file data/keywords.csv
 *
 * Флаги:
 *   --file <path>   путь к CSV (обязательно)
 *   --top N         сколько топ-запросов на категорию (по умолчанию 15)
 *   --tenant <id>   тенант (по умолчанию 1)
 *   --dry           показать, что импортируется, без записи
 */
import { readFileSync } from 'fs'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '../payload.config'

// Порядок блоков в CSV → slug категории (или 'bts' для корня).
// weverse пропускаем (не участник).
const BLOCKS: { label: string; slug: string | null }[] = [
  { label: 'bts', slug: 'bts' }, // корневая BTS
  { label: 'чимин', slug: 'jimin' },
  { label: 'техен', slug: 'v' }, // Тэхён = V
  { label: 'шуга', slug: 'suga' },
  { label: 'джин', slug: 'jin' },
  { label: 'намджун', slug: 'rm' }, // Намджун = RM
  { label: 'j hope', slug: 'j-hope' },
  { label: 'jungkook', slug: 'jung-kook' },
  { label: 'weverse', slug: null }, // пропускаем
]

// Стоп-слова: если запрос содержит любое — выбрасываем как нерелевантный омоним.
const STOP_WORDS = [
  'тоник', 'тонике', 'эльза', 'ву джин', 'джин ву', 'билли',
  'джерсон', 'пила', 'пит ', 'барристер', 'дорама', 'фильм',
  'порно', 'секс', 'голая', 'голый', 'ли джин', 'про джина',
  'джиной', 'с джиной', 'надя', 'раша', 'раш',
]

// Разрешаем запрос, только если он «про BTS»: содержит bts, имя участника
// в узнаваемой форме, или явный k-pop маркер.
const ALLOW_MARKERS = [
  'bts', 'бтс', 'чимин', 'техен', 'тэхен', 'шуга', 'suga', 'намджун',
  'j hope', 'jhope', 'джейхоуп', 'jungkook', 'чонгук', 'джонгук',
  'kpop', 'к-поп', 'кпоп', 'weverse', 'песн', 'скачать', 'клип',
  'перевод', 'альбом',
]

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : undefined
}
const DRY = process.argv.includes('--dry')
const FILE = arg('--file')
const TOP = Number(arg('--top') || '15')
const TENANT = Number(arg('--tenant') || '1')

/** Парсит число запросов «1 098 489» → 1098489. */
function parseCount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

/** Простой CSV-парсер (значения без кавычек/запятых внутри — наш случай). */
function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(','))
}

function isRelevant(query: string): boolean {
  const q = query.toLowerCase()
  if (!q.trim()) return false
  if (STOP_WORDS.some((sw) => q.includes(sw))) return false
  if (!ALLOW_MARKERS.some((m) => q.includes(m))) return false
  return true
}

async function main() {
  if (!FILE) {
    console.error('Укажи --file <path к CSV>')
    process.exit(1)
  }

  const rows = parseCSV(readFileSync(FILE, 'utf8'))
  // rows[0] — заголовки (Формулировка/Число запросов ×9). Данные с rows[1].
  const dataRows = rows.slice(1)

  // Для каждого блока собираем { query, count }[].
  const perSlug = new Map<string, { query: string; count: number }[]>()

  BLOCKS.forEach((block, bi) => {
    if (!block.slug) return
    const qCol = bi * 3 // 0,3,6,... — колонка Формулировка блока
    const cCol = qCol + 1 // Число запросов

    const collected: { query: string; count: number }[] = []
    for (const row of dataRows) {
      const query = (row[qCol] || '').trim()
      const count = parseCount(row[cCol] || '')
      if (!query) continue
      if (!isRelevant(query)) continue
      collected.push({ query, count })
    }
    // Сорт по частотности, топ N, только уникальные формулировки.
    const seen = new Set<string>()
    const top = collected
      .sort((a, b) => b.count - a.count)
      .filter((x) => {
        const k = x.query.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, TOP)

    const existing = perSlug.get(block.slug) || []
    perSlug.set(block.slug, existing.concat(top))
  })

  const payload = await getPayload({ config: await config })

  let updated = 0
  let notFound = 0

  for (const [slug, kws] of perSlug.entries()) {
    const keywords = kws.map((k) => k.query)

    // Находим категорию по slug в пределах тенанта.
    const where: Where = {
      and: [{ tenant: { equals: TENANT } }, { slug: { equals: slug } }],
    }
    const res = await payload.find({
      collection: 'categories',
      where,
      limit: 5,
      depth: 0,
      overrideAccess: true,
    })

    if (res.docs.length === 0) {
      console.warn(`⚠ категория со slug "${slug}" не найдена`)
      notFound++
      continue
    }
    // Если slug неуникален (дубли) — берём того, чей путь ведёт на участника.
    const target =
      res.docs.find((d: any) =>
        (d.breadcrumbs || []).some((c: any) => (c.url || '').includes('/members/')),
      ) ||
      res.docs.find((d: any) => slug === 'bts' && !d.parent) ||
      res.docs[0]

    console.log(`\n${slug} → #${(target as any).id} (${keywords.length} ключевиков)`)
    console.log('  ' + keywords.slice(0, 8).join(', ') + (keywords.length > 8 ? ' …' : ''))

    if (DRY) {
      updated++
      continue
    }

    try {
      await payload.update({
        collection: 'categories',
        id: (target as any).id,
        data: { seo: { targetKeywords: keywords.map((k) => ({ keyword: k })) } } as any,
        depth: 0,
        overrideAccess: true,
      })
      updated++
    } catch (e) {
      console.error(`✗ ${slug}:`, (e as Error).message)
    }
  }

  console.log(
    `\nГотово. Категорий обновлено: ${updated}, не найдено: ${notFound}.` +
      (DRY ? ' (dry-run)' : ''),
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
