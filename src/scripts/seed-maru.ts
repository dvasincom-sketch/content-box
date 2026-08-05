import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { htmlToLexical } from '../lib/lexical'

/**
 * Быстрое создание нового проекта «Маруся Озвучка» БЕЗ студии/онбординга.
 *
 * Создаёт: тенант (subdomain=maruozvuchka → maruozvuchka.contentbox.site),
 * настройки сайта (тема по умолчанию) и страницу «О проекте» (в меню).
 * Каталог из 265 работ (ссылки Boosty) НЕ трогаем — это отдельная задача.
 *
 * ─── БЕЗОПАСНОСТЬ ────────────────────────────────────────────────────────
 *  • По умолчанию DRY-RUN: печатает, что будет создано, ничего не пишет.
 *  • Реальное создание — только с CONFIRM=CREATE.
 *  • Идемпотентно: если subdomain уже занят — выходит, ничего не делая.
 *
 * ─── ЗАПУСК (прод-база) ──────────────────────────────────────────────────
 *   # 1) Посмотреть план (безопасно):
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-maru.ts
 *
 *   # 2) Создать:
 *   CONFIRM=CREATE DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-maru.ts
 *
 * После создания: настроить DNS/SSL для maruozvuchka.contentbox.site (как для bts) —
 * тенант резолвится по subdomain при status=active И domainVerified=true (оба ставим тут).
 */

const SUB = 'maruozvuchka'
const NAME = 'Маруся Озвучка'
const DOMAIN = `${SUB}.contentbox.site`
const THEME_PRESET = 'neon-dawn' // DEFAULT_PRESET_ID

// Контент «О проекте». Без каталога (265 ссылок Boosty) и без Boosty-инструкций —
// они интерфейс Boosty и к платформе неприменимы; каталог решаем отдельно.
const ABOUT_HTML = `
<p>Добро пожаловать в мир историй от «Маруся Озвучка»!</p>
<p>Здесь собрана большая библиотека озвученных произведений по фандому BTS — уже более 260 законченных историй в аудио- и видеоформате. Романтика, драма, юмор, сложные отношения, необычные сюжеты и многочасовые истории, в которые можно погрузиться надолго.</p>
<p>Новые озвучки выходят регулярно, а по вечерам мы встречаемся на прямых эфирах: общаемся, обсуждаем истории и просто проводим время вместе. Также на странице выходят личные видео и влоги из Южной Кореи.</p>
<p>Подписка открывает доступ не просто к отдельным публикациям, а к целой постоянно растущей библиотеке, которую можно слушать в удобное время.</p>
<h3>🎧 Более 260 озвученных историй</h3>
<p>Большой архив завершённых и многосерийных работ.</p>
<h3>🎙 Новые озвучки</h3>
<p>Свежие главы и новые произведения по мере их выхода.</p>
<h3>📺 Прямые эфиры</h3>
<p>Регулярные вечерние встречи, общение и обсуждение проектов.</p>
<h3>🇰🇷 Влоги из Южной Кореи</h3>
<p>Путешествия, впечатления и личные видео Маруси.</p>
<h3>💜 Тёплое сообщество</h3>
<p>Место для тех, кто любит хорошие истории и уютную атмосферу.</p>
<h3>Только для взрослых · 18+</h3>
<p>Все материалы на странице предназначены исключительно для совершеннолетней аудитории 18+.</p>
<p>Произведения являются художественным вымыслом и созданы в развлекательных целях. Сюжеты, события и отношения между персонажами не являются утверждениями о реальных людях и не отражают их настоящую личную жизнь.</p>
`

async function main() {
  const doWrite = process.env.CONFIRM === 'CREATE'
  const payload = await getPayload({ config })

  // Идемпотентность: subdomain уже занят?
  const existing = await payload.find({
    collection: 'tenants',
    where: { subdomain: { equals: SUB } },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    const t = existing.docs[0] as any
    console.error(`Поддомен "${SUB}" уже занят тенантом #${t.id} "${t.name}". Ничего не делаю.`)
    process.exit(1)
  }

  if (!doWrite) {
    console.log('DRY-RUN (ничего не создано). Будет создано:')
    console.log(`  • Тенант: "${NAME}"  subdomain=${SUB}  domain=${DOMAIN}  status=active  domainVerified=true`)
    console.log(`  • Настройки сайта: тема "${THEME_PRESET}"`)
    console.log(`  • Страница: «О проекте» (slug=o-proekte, в меню)`)
    console.log('')
    console.log('Запусти с CONFIRM=CREATE, чтобы создать.')
    process.exit(0)
  }

  // 1) Тенант
  const tenant = (await payload.create({
    collection: 'tenants',
    data: {
      name: NAME,
      subdomain: SUB,
      domain: DOMAIN,
      status: 'active',
      domainVerified: true,
      plan: 'free',
      category: 'podcaster',
      description: 'Озвученные истории по фандому BTS — большая библиотека в аудио- и видеоформате.',
      onboardingComplete: true,
      onboardingStep: 99,
    } as any,
    overrideAccess: true,
  })) as any
  console.log(`OK тенант #${tenant.id} "${tenant.name}" (${DOMAIN})`)

  // 2) Настройки сайта (одна запись на тенант; тема по умолчанию)
  const settings = (await payload.create({
    collection: 'site-settings',
    data: { tenant: tenant.id, themePreset: THEME_PRESET } as any,
    overrideAccess: true,
  })) as any
  console.log(`OK настройки #${settings.id} (тема ${THEME_PRESET})`)

  // 3) Страница «О проекте» (в меню шапки)
  const page = (await payload.create({
    collection: 'pages',
    data: {
      tenant: tenant.id,
      title: 'О проекте',
      slug: 'o-proekte',
      content: htmlToLexical(ABOUT_HTML),
      showInMenu: true,
      menuOrder: 1,
    } as any,
    overrideAccess: true,
  })) as any
  console.log(`OK страница #${page.id} «О проекте» → /page/o-proekte`)

  console.log('')
  console.log('Готово. Дальше:')
  console.log(`  1. Настрой DNS/SSL для ${DOMAIN} (как для bts).`)
  console.log(`  2. Открой https://${DOMAIN} — в шапке будет «О проекте».`)
  console.log('  3. Каталог (265 работ) и аккаунт автора — отдельной задачей.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
