/**
 * Разовый бэкфилл репутации (Фаза 2 «Сообщество»): начисляет очки за уже
 * существующие ОПУБЛИКОВАННЫЕ комментарии и ПОЛУЧЕННЫЕ реакции.
 *
 * Идемпотентно (awardActivity пропускает уже начисленное) — можно запускать
 * повторно без задваивания.
 *
 * Запуск (прод — только с явным DATABASE_URL):
 *   cd ~/content-box && npx tsx src/scripts/backfill-reputation.ts [--tenant N]
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { awardActivity } from '../lib/reputation'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? (process.argv[i + 1] ?? '') : undefined
}
const TENANT = arg('--tenant')
const tenantCond = TENANT ? [{ tenant: { equals: Number(TENANT) } }] : []

async function main() {
  const payload = await getPayload({ config })

  const comments = await payload.find({
    collection: 'comments',
    where: { and: [{ status: { equals: 'published' } }, ...tenantCond] },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  let c = 0
  for (const doc of comments.docs as any[]) {
    const authorId = doc.author && typeof doc.author === 'object' ? doc.author.id : doc.author
    await awardActivity(payload, { subscriberId: authorId, type: 'comment', refType: 'comment', refId: doc.id })
    c++
  }
  console.log(`Комментарии (опубликованные): обработано ${c}`)

  const reactions = await payload.find({
    collection: 'reactions',
    where: { and: [{ targetType: { equals: 'comment' } }, ...tenantCond] },
    limit: 0,
    depth: 2, // reaction.comment.author
    overrideAccess: true,
  })
  let r = 0
  for (const doc of reactions.docs as any[]) {
    const reactorId = doc.subscriber && typeof doc.subscriber === 'object' ? doc.subscriber.id : doc.subscriber
    const comment = doc.comment && typeof doc.comment === 'object' ? doc.comment : null
    const recipientId =
      comment?.author && typeof comment.author === 'object' ? comment.author.id : comment?.author
    if (recipientId && Number(recipientId) !== Number(reactorId)) {
      await awardActivity(payload, { subscriberId: recipientId, type: 'reaction_received', refType: 'reaction', refId: doc.id })
      r++
    }
  }
  console.log(`Реакции на комментарии (полученные): начислено ${r}`)
  console.log('Бэкофилл репутации завершён.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
