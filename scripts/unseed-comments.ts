/**
 * Очистка сида: удаляет тестовых подписчиков (email seed-army-…@cocojambo.local)
 * и все их комментарии. Возвращает dev-базу в чистое состояние.
 *
 * Запуск (dev):
 *   node --env-file=.env --import=tsx scripts/unseed-comments.ts
 *
 * Идемпотентно: повторный запуск ничего не ломает (просто ничего не находит).
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const SEED_PREFIX = 'seed-army-'
const SEED_DOMAIN = 'cocojambo.local'

async function main() {
  const payload = await getPayload({ config: await config })

  // ── 1. Находим тестовых подписчиков по маркеру email ──
  const subsRes = await payload.find({
    collection: 'subscribers',
    where: {
      and: [
        { email: { like: SEED_PREFIX } },
        { email: { like: SEED_DOMAIN } },
      ],
    },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const subs = subsRes.docs as any[]
  console.log('Найдено тестовых подписчиков:', subs.length)

  if (subs.length === 0) {
    console.log('Нечего чистить.')
    return
  }

  const subIds = subs.map((s) => s.id)

  // ── 2. Удаляем комментарии этих авторов ──
  // Сначала находим их (для счётчика и надёжного удаления пачкой).
  const commentsRes = await payload.find({
    collection: 'comments',
    where: { author: { in: subIds } },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const comments = commentsRes.docs as any[]
  console.log('Их комментариев:', comments.length)

  let delComments = 0
  for (const c of comments) {
    try {
      await payload.delete({ collection: 'comments', id: c.id, overrideAccess: true })
      delComments++
    } catch (e) {
      console.log('  ! коммент не удалён:', c.id, (e as Error).message)
    }
  }

  // ── 3. Удаляем реакции этих подписчиков (если наставили) ──
  let delReactions = 0
  try {
    const reactionsRes = await payload.find({
      collection: 'reactions',
      where: { subscriber: { in: subIds } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    for (const r of reactionsRes.docs as any[]) {
      try {
        await payload.delete({ collection: 'reactions', id: r.id, overrideAccess: true })
        delReactions++
      } catch {
        // пропускаем единичные ошибки
      }
    }
  } catch {
    // коллекции реакций может не быть в старой схеме — не критично
  }

  // ── 4. Удаляем самих подписчиков ──
  let delSubs = 0
  for (const s of subs) {
    try {
      await payload.delete({ collection: 'subscribers', id: s.id, overrideAccess: true })
      delSubs++
    } catch (e) {
      console.log('  ! подписчик не удалён:', s.id, (e as Error).message)
    }
  }

  console.log('─'.repeat(60))
  console.log('Очистка завершена.')
  console.log('  удалено комментариев:', delComments)
  console.log('  удалено реакций:', delReactions)
  console.log('  удалено подписчиков:', delSubs)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
