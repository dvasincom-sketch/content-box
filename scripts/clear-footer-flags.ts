/**
 * Одноразовый скрипт: снимает флаг showInFooter у всех категорий.
 *
 * Зачем: футер переведён на ручное управление через конструктор (menu-items).
 * Старый флаг showInFooter больше не нужен для наполнения футера — снимаем его
 * массово, чтобы автоген не тянул десятки категорий в футер. После этого футер
 * пуст и наполняется вручную в конструкторе.
 *
 * Запуск (локальная база):
 *   npx tsx scripts/clear-footer-flags.ts
 *
 * Запуск против прод-базы (осторожно — укажите прод DATABASE_URL):
 *   DATABASE_URL="<PROD_EXTERNAL_URL>" npx tsx scripts/clear-footer-flags.ts
 *
 * Безопасность: меняет ТОЛЬКО поле showInFooter (true → false). Ничего больше
 * не трогает. Обратимо: нужные категории можно снова отметить или, лучше,
 * добавить в футер пунктами через конструктор.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function run() {
  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'categories',
    where: { showInFooter: { equals: true } },
    limit: 10000,
    depth: 0,
    overrideAccess: true,
  })

  const total = res.docs.length
  console.log(`Категорий с showInFooter=true: ${total}`)

  if (total === 0) {
    console.log('Нечего снимать. Готово.')
    process.exit(0)
  }

  let done = 0
  let failed = 0
  for (const cat of res.docs as any[]) {
    try {
      await payload.update({
        collection: 'categories',
        id: cat.id,
        data: { showInFooter: false },
        overrideAccess: true,
      })
      done++
      if (done % 10 === 0) console.log(`  снято: ${done}/${total}`)
    } catch (e) {
      failed++
      console.error(`  ошибка на категории id=${cat.id}:`, (e as Error).message)
    }
  }

  console.log(`Готово. Снят флаг у ${done} категорий${failed ? `, ошибок: ${failed}` : ''}.`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
