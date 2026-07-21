/**
 * Разовый сид: тестовые подписчики + комментарии под публикациями.
 * ТОЛЬКО ДЛЯ DEV. Создаёт реальные записи, помеченные префиксом email
 * `seed-army-…@cocojambo.local` — по нему же их убирает unseed-comments.ts.
 *
 * Запуск (dev):
 *   node --env-file=.env --import=tsx scripts/seed-comments.ts
 *
 * НЕ запускать на проде. Комментарии — оригинальные (свои), не из внешних
 * источников; тексты универсальные, подходят к BTS-публикациям.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

// ── Параметры (правь цифрами при необходимости) ─────────────────────────────
const USER_COUNT = 30 // сколько тестовых подписчиков создать
const MAX_PUBLICATIONS = 10 // по скольким последним публикациям раскидать
const SEED_PREFIX = 'seed-army-' // маркер email (для очистки)
const SEED_DOMAIN = 'cocojambo.local' // несуществующий домен
const DAYS_SPREAD = 7 // разброс дат комментариев (последние N дней)

// Отображаемые имена (латиница/кириллица вперемешку — как реальные ники).
const DISPLAY_NAMES = [
  'Мина', 'yoongi_stan', 'Deni', 'jk_lover', 'taehyung.v', 'Ари',
  'purple_heart', 'Соня', 'jimin_ah', 'RM_forever', 'hobi_sunshine', 'Кира',
  'suga_pop', 'namjoon_ie', 'Лена', 'golden_maknae', 'seokjin_worldwide', 'Даша',
  'army_ru', 'chimchim', 'Вика', 'jin_car', 'tata_bear', 'Настя',
  'kookie_bunny', 'yoonmin', 'Марина', 'joonie', 'euphoria_jk', 'Аля',
]

// Пул оригинальных корневых комментариев (универсальные эмоции по BTS).
const ROOT_COMMENTS = [
  'Это выступление я буду пересматривать вечно. Мурашки с первой секунды 💜',
  'Хореография на припеве — просто космос. Как они так синхронно двигаются?',
  'Горжусь до слёз. ARMY навсегда 🔥',
  'Вокал живьём звучит ещё сильнее, чем в студии. Невероятно.',
  'Каждый раз поражаюсь их энергетике на сцене. Заряжает на весь день!',
  'Это войдёт в историю. Спасибо, что делятся такими моментами с нами.',
  'Смотрю уже третий раз подряд и не могу оторваться 😭',
  'Сценография, свет, подача — всё на высшем уровне. Профессионалы.',
  'Их развитие за эти годы просто впечатляет. От дебюта до мировых сцен.',
  'Финальная нота — и весь зал взорвался. Я бы тоже кричала!',
  'Обожаю, как они взаимодействуют на сцене. Настоящая семья 💜',
  'Даже без слов всё понятно — эмоции считываются мгновенно.',
  'Пересматриваю ради этого момента на 2:30. Гениально поставлено.',
  'Не устану повторять: они лучшие в том, что делают.',
  'Каждая деталь продумана. Вот что значит любить своё дело.',
]

// Пул ответов (короче, диалоговые).
const REPLY_COMMENTS = [
  'Плюсую, пересматриваю уже который раз!',
  'Полностью согласна 💜',
  'Вот это точно, мурашки до сих пор.',
  'Тоже заметил этот момент, шикарно.',
  'Не могу перестать смотреть 😭',
  'Именно! Лучше не скажешь.',
  'Да, живьём это совсем другое.',
  'Согласен на все сто.',
]

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Случайная дата в пределах последних DAYS_SPREAD дней.
function randomRecentDate(): string {
  const now = Date.now()
  const back = randomInt(0, DAYS_SPREAD * 24 * 60) * 60 * 1000 // минуты → мс
  return new Date(now - back).toISOString()
}

// Простой случайный пароль (входить под ботами не нужно).
function randomPassword(): string {
  return 'Seed!' + Math.random().toString(36).slice(2, 12) + 'A1'
}

async function main() {
  const payload = await getPayload({ config: await config })

  // ── 1. Первый тенант ──
  const tenantsRes = await payload.find({
    collection: 'tenants',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = (tenantsRes.docs as any[])[0]
  if (!tenant) {
    console.log('Тенантов нет — нечего сидить. Прерываю.')
    return
  }
  console.log('Тенант:', tenant.id, '|', tenant.name ?? '(без имени)')

  // ── 2. Последние публикации этого тенанта ──
  const pubsRes = await payload.find({
    collection: 'publications',
    where: { tenant: { equals: tenant.id } },
    sort: '-createdAt',
    limit: MAX_PUBLICATIONS,
    depth: 0,
    overrideAccess: true,
  })
  const publications = pubsRes.docs as any[]
  if (publications.length === 0) {
    console.log('Публикаций у тенанта нет — комментировать нечего. Прерываю.')
    return
  }
  console.log('Публикаций задействуем:', publications.length)

  // ── 3. Создаём тестовых подписчиков ──
  console.log('─'.repeat(60))
  console.log('Создаю подписчиков…')
  const subscribers: any[] = []
  for (let i = 0; i < USER_COUNT; i++) {
    const num = String(i + 1).padStart(2, '0')
    const email = `${SEED_PREFIX}${num}@${SEED_DOMAIN}`
    const displayName = pick(DISPLAY_NAMES, i)
    try {
      // Идемпотентность: если уже есть — пропускаем.
      const existing = await payload.find({
        collection: 'subscribers',
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) {
        subscribers.push(existing.docs[0])
        continue
      }
      const sub = await payload.create({
        collection: 'subscribers',
        data: {
          email,
          password: randomPassword(),
          displayName,
          tenant: tenant.id,
        },
        overrideAccess: true,
      })
      subscribers.push(sub)
    } catch (e) {
      console.log(`  ! не удалось создать ${email}:`, (e as Error).message)
    }
  }
  console.log('Подписчиков готово:', subscribers.length)

  if (subscribers.length === 0) {
    console.log('Ни одного подписчика — прерываю.')
    return
  }

  // ── 4. Раскидываем комментарии по публикациям ──
  console.log('─'.repeat(60))
  console.log('Создаю комментарии…')
  let rootCount = 0
  let replyCount = 0
  let ci = 0 // индекс для выбора текстов/имён
  const allComments: any[] = [] // все созданные комменты (для реакций на них)

  for (const pub of publications) {
    // Сколько корневых комментов под этой публикацией — неравномерно.
    const rootsHere = randomInt(2, 5)
    const rootsForPub: any[] = []

    for (let r = 0; r < rootsHere; r++) {
      const author = pick(subscribers, ci)
      const text = pick(ROOT_COMMENTS, ci)
      ci++
      try {
        const doc = await payload.create({
          collection: 'comments',
          data: {
            publication: pub.id,
            author: author.id,
            text,
            status: 'published',
            tenant: tenant.id,
            createdAt: randomRecentDate(), // может быть перезаписан Payload — не критично
          } as any,
          overrideAccess: true,
        })
        rootsForPub.push(doc)
        allComments.push(doc)
        rootCount++
      } catch (e) {
        console.log('  ! коммент не создан:', (e as Error).message)
      }
    }

    // К части корневых — по ответу (один уровень).
    for (const root of rootsForPub) {
      if (Math.random() < 0.5) continue // не у всех
      const author = pick(subscribers, ci + 3)
      const text = pick(REPLY_COMMENTS, ci)
      ci++
      try {
        const replyDoc = await payload.create({
          collection: 'comments',
          data: {
            publication: pub.id,
            author: author.id,
            text,
            parent: root.id,
            status: 'published',
            tenant: tenant.id,
            createdAt: randomRecentDate(),
          } as any,
          overrideAccess: true,
        })
        allComments.push(replyDoc)
        replyCount++
      } catch (e) {
        console.log('  ! ответ не создан:', (e as Error).message)
      }
    }
  }

  // ── 5. Реакции на публикации и комментарии ──
  console.log('─'.repeat(60))
  console.log('Создаю реакции…')
  const EMOJIS = ['like', 'love', 'fire', 'cry'] as const
  // Трекинг уникальности на стороне скрипта: ключ `${targetType}:${targetId}:${subId}`.
  // Так каждый подписчик ставит максимум одну реакцию на объект — согласованно
  // с хуком beforeChange коллекции (он бы иначе удалил прежнюю).
  const reacted = new Set<string>()
  let pubReactions = 0
  let commentReactions = 0

  async function addReaction(
    targetType: 'publication' | 'comment',
    targetId: number,
    subId: number,
  ) {
    const key = `${targetType}:${targetId}:${subId}`
    if (reacted.has(key)) return
    reacted.add(key)
    const emoji = EMOJIS[randomInt(0, EMOJIS.length - 1)]
    try {
      await payload.create({
        collection: 'reactions',
        data: {
          targetType,
          [targetType]: targetId,
          subscriber: subId,
          emoji,
          tenant: tenant.id,
        } as any,
        overrideAccess: true,
      })
      if (targetType === 'publication') pubReactions++
      else commentReactions++
    } catch (e) {
      console.log('  ! реакция не создана:', (e as Error).message)
    }
  }

  // Реакции на публикации: по каждой — случайные 8–20 подписчиков.
  for (const pub of publications) {
    const howMany = randomInt(8, Math.min(20, subscribers.length))
    const shuffled = [...subscribers].sort(() => Math.random() - 0.5).slice(0, howMany)
    for (const sub of shuffled) {
      await addReaction('publication', pub.id, sub.id)
    }
  }

  // Реакции на комментарии: примерно у половины комментов — 1–6 реакций.
  for (const c of allComments) {
    if (Math.random() < 0.5) continue
    const howMany = randomInt(1, Math.min(6, subscribers.length))
    const shuffled = [...subscribers].sort(() => Math.random() - 0.5).slice(0, howMany)
    for (const sub of shuffled) {
      await addReaction('comment', c.id, sub.id)
    }
  }

  console.log('─'.repeat(60))
  console.log('Готово.')
  console.log('  подписчиков:', subscribers.length)
  console.log('  корневых комментариев:', rootCount)
  console.log('  ответов:', replyCount)
  console.log('  реакций на публикации:', pubReactions)
  console.log('  реакций на комментарии:', commentReactions)
  console.log('Очистить: node --env-file=.env --import=tsx scripts/unseed-comments.ts')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
