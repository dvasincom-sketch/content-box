/**
 * Генератор документации схемы базы.
 *
 * Читает живую базу и раскладывает её по предметным контурам: на каждый
 * контур — свой файл с ER-диаграммой и справочником колонок. Одна схема
 * на восемьдесят таблиц нечитаема в принципе, поэтому общий файл содержит
 * только контуры и связи между ними, а подробности живут отдельно.
 *
 * Почему генератор, а не нарисованная схема: нарисованная устаревает
 * за месяц и врёт молча. Эта пересобирается командой и попадает в diff,
 * то есть изменение модели видно на код-ревью.
 *
 * Запуск: npx tsx scripts/schema-docs.ts
 * Результат: docs/shema/*.md
 */

import { Client } from 'pg'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const OUT_DIR = 'docs/shema'

/**
 * Контуры перечислены в порядке чтения: сначала то, вокруг чего всё
 * вращается, потом то, что на это навешано. Таблица попадает в первый
 * подошедший контур, поэтому порядок здесь значим.
 */
const KONTURY: { slug: string; name: string; hint: string; match: RegExp[] }[] = [
  {
    slug: '01-yadro',
    name: 'Ядро',
    hint: 'Организация, стадо, животное, человек. Всё остальное ссылается сюда.',
    match: [/^organizations$/, /^herds$/, /^animals$/, /^users(_sessions)?$/, /^invitations$/, /^technicians$/],
  },
  {
    slug: '02-sobytiya',
    name: 'События и фенотип',
    hint: 'Что с животным произошло: отёлы, осеменения, дойки, взвешивания, болезни, перемещения.',
    match: [
      /^calvings/, /^inseminations$/, /^milk_tests$/, /^daily_milkings$/, /^milking_visits$/,
      /^weighings$/, /^health_events$/, /^gradings$/, /^events$/, /^movements$/,
      /^animals_lactations$/,
    ],
  },
  {
    slug: '03-ocenka',
    name: 'Оценка и индекс',
    hint: 'Племенная ценность, экстерьер, генетические тесты, профили весов и база сравнения.',
    match: [
      /^animal_evaluations$/, /^animal_exteriors$/, /^index_/, /^animals_dna_tests$/,
      /^animals_haplotypes$/,
    ],
  },
  {
    slug: '04-priyom-dannyh',
    name: 'Приём и верификация данных',
    hint: 'Пакеты от хозяйств, машинная приёмка, находки эксперта, заявки на верификацию.',
    match: [/^data_submissions/, /^verification_requests/, /^pending_columns/, /^submission_authorities/],
  },
  {
    slug: '05-dostup',
    name: 'Доступ и публичность',
    hint: 'Запросы доступа, выданные разрешения, просмотры, ссылки, согласия на передачу генотипа.',
    match: [/^access_/, /^share_links/, /^genotype_consents/],
  },
  {
    slug: '06-dokumenty',
    name: 'Документы и медиа',
    hint: 'Свидетельства со снимком данных, файлы, галерея, выставки.',
    match: [/^documents$/, /^media$/, /^gallery$/, /^animals_gallery$/, /^animals_shows$/],
  },
  {
    slug: '07-spravochniki',
    name: 'Справочники',
    hint: 'Однотипные списки значений: код, название, порядок, признак активности, UUID ФГИАС.',
    match: [
      /^breeds$/, /^breed_types$/, /^lines$/, /^breeding_/, /^animal_purposes$/, /^disposal_reasons$/,
      /^coat_colors$/, /^blood_groups$/, /^reproduction_methods$/, /^semen_types$/,
      /^insemination_results$/, /^dna_test_types$/, /^haplotype_types$/, /^health_event_types$/,
      /^countries$/, /^regions$/, /^districts$/,
    ],
  },
  {
    slug: '08-sluzhebnoe',
    name: 'Служебное',
    hint: 'Журналы действий и правок, архив, ревизии, замеры скорости, сохранённые выборки.',
    match: [
      /^operations$/, /^animal_revisions$/, /^animal_removals$/, /^check_/, /^bench_runs$/,
      /^saved_searches$/, /^payload_/,
    ],
  },
]

/**
 * Таблицы, которые в документацию не попадают вовсе. Это техническая
 * машинерия Payload: массивы связей, списки строк, блокировки админки.
 * Смысла они не несут, а места занимают больше, чем содержательные
 * таблицы, — из-за них исходная схема и выглядит нечитаемой.
 */
const SKRYT = [/_rels$/, /_scopes$/, /_texts$/, /^payload_locked_documents/, /^payload_preferences/, /^payload_kv$/, /^payload_migrations$/]

/** Порог, после которого колонки показываются группами по префиксу, а не списком. */
const SHIROKAYA_TABLICA = 40

type Kolonka = { table: string; name: string; type: string; notnull: boolean; comment: string | null }
type Svyaz = { from: string; fromCol: string; to: string; onDelete: string }

async function main() {
  const uri = process.env.DATABASE_URI
  if (!uri) throw new Error('Нет DATABASE_URI в окружении')

  const db = new Client({ connectionString: uri })
  await db.connect()

  const tablicy = (
    await db.query<{ name: string; comment: string | null }>(`
      select c.relname as name, obj_description(c.oid) as comment
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `)
  ).rows

  const kolonki = (
    await db.query<Kolonka>(`
      select c.relname as table, a.attname as name,
             format_type(a.atttypid, a.atttypmod) as type,
             a.attnotnull as notnull,
             col_description(c.oid, a.attnum) as comment
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
      order by c.relname, a.attnum
    `)
  ).rows

  const svyazi = (
    await db.query<Svyaz>(`
      select src.relname as from,
             (select att.attname from unnest(con.conkey) k
                join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
                limit 1) as "fromCol",
             tgt.relname as to,
             case con.confdeltype
               when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
               when 'c' then 'CASCADE'   when 'n' then 'SET NULL'
               when 'd' then 'SET DEFAULT' else con.confdeltype::text end as "onDelete"
      from pg_constraint con
      join pg_class src on src.oid = con.conrelid
      join pg_class tgt on tgt.oid = con.confrelid
      where con.contype = 'f'
      order by 1, 2
    `)
  ).rows

  await db.end()

  const vidimye = tablicy.map((t) => t.name).filter((n) => !SKRYT.some((r) => r.test(n)))
  const kontur = (t: string) => KONTURY.find((k) => k.match.some((r) => r.test(t)))?.slug ?? 'prochee'

  await mkdir(OUT_DIR, { recursive: true })

  // Обзор: только контуры и связи между ними. Ни одной колонки — иначе
  // получится ровно та картинка, от которой мы уходим.
  const mezhKonturnye = new Map<string, number>()
  for (const s of svyazi) {
    if (!vidimye.includes(s.from) || !vidimye.includes(s.to)) continue
    const a = kontur(s.from), b = kontur(s.to)
    if (a === b) continue
    const key = `${a}→${b}`
    mezhKonturnye.set(key, (mezhKonturnye.get(key) ?? 0) + 1)
  }

  let obzor = `# Схема базы: обзор\n\n`
  obzor += `Собрано автоматически, не править руками: \`npx tsx scripts/schema-docs.ts\`.\n`
  obzor += `Таблиц в базе ${tablicy.length}, из них содержательных ${vidimye.length};\n`
  obzor += `остальное — служебные таблицы Payload, они скрыты.\n\n`
  obzor += '```mermaid\nflowchart LR\n'
  for (const k of KONTURY) {
    const n = vidimye.filter((t) => kontur(t) === k.slug).length
    if (n) obzor += `  ${k.slug.replace(/-/g, '_')}["${k.name}<br/><small>${n} таблиц</small>"]\n`
  }
  for (const [key, n] of [...mezhKonturnye].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    const [a, b] = key.split('→')
    obzor += `  ${a.replace(/-/g, '_')} -->|${n}| ${b.replace(/-/g, '_')}\n`
  }
  obzor += '```\n\n| Контур | О чём | Таблиц |\n| --- | --- | --- |\n'
  for (const k of KONTURY) {
    const n = vidimye.filter((t) => kontur(t) === k.slug).length
    if (n) obzor += `| [${k.name}](${k.slug}.md) | ${k.hint} | ${n} |\n`
  }
  const prochee = vidimye.filter((t) => kontur(t) === 'prochee')
  if (prochee.length) {
    obzor += `\n**Не разложено по контурам:** ${prochee.join(', ')}.\n`
    obzor += `Это не ошибка генератора, а сигнал: либо таблица новая и её место не названо,\n`
    obzor += `либо контуры пора пересмотреть. Допишите правило в \`KONTURY\`.\n`
  }
  await writeFile(join(OUT_DIR, '00-obzor.md'), obzor)

  // По контуру: ER-диаграмма своих таблиц плюс соседи-заглушки, затем колонки.
  for (const k of KONTURY) {
    const svoi = vidimye.filter((t) => kontur(t) === k.slug)
    if (!svoi.length) continue

    const rebra = svyazi.filter(
      (s) => vidimye.includes(s.from) && vidimye.includes(s.to) && (svoi.includes(s.from) || svoi.includes(s.to)),
    )

    let md = `# ${k.name}\n\n${k.hint}\n\n`
    md += '```mermaid\nerDiagram\n'
    for (const s of rebra) {
      // Обязательная связь рисуется сплошной, необязательная — с нулём:
      // читателю важно, может ли запись существовать без родителя.
      const col = kolonki.find((c) => c.table === s.from && c.name === s.fromCol)
      const kard = col?.notnull ? '||--o{' : '|o--o{'
      md += `  ${s.to} ${kard} ${s.from} : "${s.fromCol}${s.onDelete === 'CASCADE' ? ' ⌫' : ''}"\n`
    }
    md += '```\n\n⌫ — запись удаляется вместе с родителем.\n\n'

    for (const t of svoi) {
      const cols = kolonki.filter((c) => c.table === t)
      const tbl = tablicy.find((x) => x.name === t)
      md += `## \`${t}\`\n\n`
      if (tbl?.comment) md += `${tbl.comment}\n\n`
      else md += `_Нет комментария в базе. Добавьте: \`COMMENT ON TABLE ${t} IS '…';\`_\n\n`

      if (cols.length > SHIROKAYA_TABLICA) {
        // Широкая таблица читается только группами. Префикс до первого
        // подчёркивания — это и есть вкладка Payload, из которой колонка выросла.
        const gruppy = new Map<string, Kolonka[]>()
        for (const c of cols) {
          const g = c.name.includes('_') ? c.name.split('_')[0] : '(без группы)'
          gruppy.set(g, [...(gruppy.get(g) ?? []), c])
        }
        md += `Колонок ${cols.length}, показаны группами по префиксу.\n\n`
        md += '| Группа | Колонок | Состав |\n| --- | --- | --- |\n'
        for (const [g, list] of [...gruppy].sort((a, b) => b[1].length - a[1].length)) {
          md += `| \`${g}\` | ${list.length} | ${list.map((c) => c.name).join(', ')} |\n`
        }
        md += '\n'
      } else {
        md += '| Колонка | Тип | Обяз. | Смысл |\n| --- | --- | --- | --- |\n'
        for (const c of cols) {
          md += `| \`${c.name}\` | ${c.type} | ${c.notnull ? 'да' : ''} | ${c.comment ?? ''} |\n`
        }
        md += '\n'
      }
    }
    await writeFile(join(OUT_DIR, `${k.slug}.md`), md)
  }

  console.log(`Готово: ${OUT_DIR}/00-obzor.md и ${KONTURY.length} файлов по контурам`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
