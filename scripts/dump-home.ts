/**
 * Разовый диагностический скрипт: печатает homeSections из site-settings
 * по всем тенантам. Запуск:
 *   node --env-file=.env --import=tsx scripts/dump-home.ts
 * Прод:
 *   DATABASE_URL="<PROD External URL ...?sslmode=require>" \
 *     node --env-file=.env --import=tsx scripts/dump-home.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'site-settings',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  if (res.docs.length === 0) {
    console.log('site-settings: записей нет')
    return
  }

  for (const doc of res.docs as any[]) {
    console.log('─'.repeat(60))
    console.log('site-settings id:', doc.id, '| tenant:', doc.tenant)
    const hs = doc.homeSections
    if (!Array.isArray(hs)) {
      console.log('  homeSections:', JSON.stringify(hs), '(не массив → на чтении будет ДЕФОЛТ, все секции)')
      continue
    }
    if (hs.length === 0) {
      console.log('  homeSections: [] (пусто → на чтении будет ДЕФОЛТ, все секции)')
      continue
    }
    console.log('  homeSections (', hs.length, 'строк ):')
    for (const row of hs) {
      const type = row?.type
      const enabled = row?.enabled
      const flag = enabled === false ? 'OFF' : 'on '
      console.log(`    [${flag}] type=${JSON.stringify(type)}  enabled=${JSON.stringify(enabled)}`)
    }
    const broadcast = hs.find((r: any) => r?.type === 'broadcast')
    console.log(
      '  → broadcast:',
      broadcast
        ? `enabled=${JSON.stringify(broadcast.enabled)}`
        : 'СТРОКИ НЕТ (тип отсутствует в конфиге)',
    )
  }
  console.log('─'.repeat(60))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
