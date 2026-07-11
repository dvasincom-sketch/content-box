import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import fs from 'fs'
import path from 'path'

/**
 * Импорт описаний категорий из markdown-файлов в поле description (Lexical).
 * Имя файла = путь категории через двойное подчёркивание:
 *   bts__members__rm.md → категория bts/members/rm
 *
 * Запуск:
 *   npx tsx src/scripts/import-descriptions.ts            (локально)
 *   DATABASE_URL="$PROD_DB" npx tsx src/scripts/import-descriptions.ts   (прод)
 *   npx tsx src/scripts/import-descriptions.ts --only bts__members__rm
 *   npx tsx src/scripts/import-descriptions.ts --only run-bts,run-jin   (несколько через запятую)
 *   npx tsx src/scripts/import-descriptions.ts --skip-filled   (не трогать категории с непустым description)
 *   npx tsx src/scripts/import-descriptions.ts --dir content/translated
 */

const DEFAULT_DIR = 'content/translated'

function stripFrontComment(md: string): string {
  // Убираем HTML-комментарий-шапку <!-- ... --> в начале файла.
  return md.replace(/^<!--[\s\S]*?-->\s*/, '').trim()
}

function pathFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/__/g, '/')
}

/**
 * Есть ли в Lexical-значении хоть какой-то текст.
 * Пустой richText — это не null, а { root: { children: [{ type: 'paragraph', children: [] }] } },
 * поэтому проверяем не на null, а на наличие непробельного текста в дереве.
 */
function richTextHasContent(value: any): boolean {
  if (!value || !value.root) return false
  let found = false
  const walk = (node: any) => {
    if (found || !node) return
    if (typeof node.text === 'string' && node.text.trim() !== '') {
      found = true
      return
    }
    if (Array.isArray(node.children)) node.children.forEach(walk)
  }
  walk(value.root)
  return found
}

async function main() {
  const args = process.argv.slice(2)
  const onlyIdx = args.indexOf('--only')
  const only =
    onlyIdx >= 0 && args[onlyIdx + 1]
      ? args[onlyIdx + 1]
          .split(',')
          .map((s) => s.trim().replace(/\.md$/, ''))
          .filter(Boolean)
      : null
  const skipFilled = args.includes('--skip-filled')
  const dirIdx = args.indexOf('--dir')
  const dir = dirIdx >= 0 ? args[dirIdx + 1] : DEFAULT_DIR

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const tenants = await payload.find({ collection: 'tenants', limit: 1, overrideAccess: true })
  const tenant = tenants.docs[0] as any
  if (!tenant) throw new Error('Тенант не найден.')
  console.log(`Тенант: ${tenant.name} (id ${tenant.id})`)

  // Конфиг редактора — тот же, что у поля description.
  const editorConfig = await editorConfigFactory.default({ config: payloadConfig })

  const absDir = path.resolve(process.cwd(), dir)
  if (!fs.existsSync(absDir)) throw new Error(`Нет папки ${dir}`)

  let files = fs.readdirSync(absDir).filter((f) => f.endsWith('.md'))
  if (only) {
    files = files.filter((f) => {
      const base = f.replace(/\.md$/, '')
      const lastSeg = base.split('__').pop() as string
      // Совпадение по полному имени файла или по последнему сегменту пути.
      return only.some((o) => o === base || o === lastSeg)
    })
  }

  console.log(`Файлов к импорту: ${files.length}`)
  if (skipFilled) console.log('Режим: --skip-filled (категории с непустым description пропускаются)')
  console.log('')

  let updated = 0
  let notFound = 0
  let failed = 0
  let skipped = 0

  for (const file of files) {
    const catPath = pathFromFilename(file)
    const slug = catPath.split('/').pop() as string

    // Ищем категорию по последнему сегменту + проверяем полный путь по breadcrumbs.
    const res = await payload.find({
      collection: 'categories',
      where: {
        and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }],
      },
      limit: 10,
      depth: 1,
      overrideAccess: true,
    })

    // Среди совпадений по slug выбираем ту, чей путь совпадает.
    const wantUrl = '/' + catPath
    const category = (res.docs as any[]).find((doc) => {
      const crumbs = doc.breadcrumbs
      if (!Array.isArray(crumbs) || crumbs.length === 0) return false
      return crumbs[crumbs.length - 1]?.url === wantUrl
    }) || (res.docs as any[])[0]

    if (!category) {
      console.log(`  ✗ ${catPath}: категория не найдена`)
      notFound++
      continue
    }

    if (skipFilled && richTextHasContent(category.description)) {
      console.log(`  ⊘ ${catPath} → "${category.title}" (уже заполнено, пропуск)`)
      skipped++
      continue
    }

    try {
      const raw = fs.readFileSync(path.join(absDir, file), 'utf-8')
      const markdown = stripFrontComment(raw)
      const lexical = convertMarkdownToLexical({ editorConfig, markdown })

      await payload.update({
        collection: 'categories',
        id: category.id,
        data: { description: lexical },
        depth: 0,
        overrideAccess: true,
      })
      console.log(`  ✓ ${catPath} → "${category.title}"`)
      updated++
    } catch (e: any) {
      console.log(`  ✗ ${catPath}: ${e.message}`)
      failed++
    }
  }

  console.log(
    `\nГотово. Обновлено: ${updated}, пропущено: ${skipped}, не найдено: ${notFound}, ошибок: ${failed}.`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('Ошибка импорта:', err?.message ?? err)
  process.exit(1)
})
