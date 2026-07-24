import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * Разовый скрипт: привязать поддомен `bts` к действующему проекту Coco Jambo,
 * чтобы сайт открывался на bts.contentbox.site (резолвинг по subdomain в proxy.ts).
 *
 * Запуск (прод-база):
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/set-bts-subdomain.ts
 *
 * Безопасно: находит тенант по имени ~"coco", не трогает домен/статус, только
 * ставит subdomain. Если найдено не одно — печатает кандидатов и выходит.
 */
const SUB = 'bts'
const NAME_LIKE = 'coco' // при необходимости поменяйте на реальное имя тенанта

async function main() {
  const payload = await getPayload({ config })

  const res = await payload.find({
    collection: 'tenants',
    where: { name: { like: NAME_LIKE } },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })

  if (res.docs.length === 0) {
    console.error(`Тенант с именем ~"${NAME_LIKE}" не найден. Уточните NAME_LIKE в скрипте.`)
    process.exit(1)
  }
  if (res.docs.length > 1) {
    console.error('Найдено несколько тенантов — уточните имя:')
    for (const d of res.docs as any[]) console.error(`  #${d.id}  ${d.name}  (subdomain=${d.subdomain ?? '—'}, domain=${d.domain})`)
    process.exit(1)
  }

  const t = res.docs[0] as any

  const taken = await payload.find({
    collection: 'tenants',
    where: { and: [{ subdomain: { equals: SUB } }, { id: { not_equals: t.id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (taken.docs.length > 0) {
    console.error(`Поддомен "${SUB}" уже занят тенантом #${(taken.docs[0] as any).id}.`)
    process.exit(1)
  }

  const updated = (await payload.update({
    collection: 'tenants',
    id: t.id,
    data: { subdomain: SUB } as any,
    overrideAccess: true,
  })) as any

  console.log(`OK: тенант #${updated.id} "${updated.name}" → subdomain="${updated.subdomain}"`)
  console.log(`    status=${updated.status}, domainVerified=${updated.domainVerified}, domain=${updated.domain}`)
  if (updated.status !== 'active' || !updated.domainVerified) {
    console.log('ВНИМАНИЕ: для резолвинга bts.contentbox.site нужен status=active И domainVerified=true.')
    console.log('Выставьте их в /admin → Проекты → этот тенант, затем настройте DNS/SSL.')
  } else {
    console.log('Готово. После настройки DNS + SSL сайт откроется на https://bts.contentbox.site')
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
