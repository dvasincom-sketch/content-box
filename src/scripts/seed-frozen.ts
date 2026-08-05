import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { htmlToLexical } from '../lib/lexical'

/**
 * Быстрый запуск демо-проекта «Frozen» (фанфики по «Холодному сердцу»).
 *
 * Создаёт: тенант (subdomain=frozen → frozen.contentbox.site), настройки сайта
 * (ледяная тема 'frost') и страницу «О проекте» (в меню). Каталог историй —
 * отдельной задачей (сид демо-контента), как и у Маруси.
 *
 * ─── БЕЗОПАСНОСТЬ ────────────────────────────────────────────────────────
 *  • По умолчанию DRY-RUN: печатает план, ничего не пишет.
 *  • Реальное создание — только с CONFIRM=CREATE.
 *  • Идемпотентно: если subdomain уже занят — выходит, ничего не делая.
 *
 * ─── ВАЖНО: тема 'frost' ─────────────────────────────────────────────────
 *  Пресет 'frost' добавляется миграцией 20260805_250000_add_frost_preset
 *  (ALTER TYPE ... ADD VALUE). Миграция ДОЛЖНА быть применена к БД ДО запуска
 *  этого сида (иначе INSERT с theme_preset='frost' упадёт). Порядок:
 *  build → push (Timeweb применит миграцию на старте) → затем этот сид.
 *
 * ─── ЗАПУСК (прод-база, с Mac) ───────────────────────────────────────────
 *   # 1) План (безопасно):
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-frozen.ts
 *   # 2) Создать:
 *   CONFIRM=CREATE DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-frozen.ts
 *
 * После создания: настроить DNS/SSL для frozen.contentbox.site (как для bts/maru).
 */

const SUB = 'frozen'
const NAME = 'Frozen · Истории Эренделла'
const DOMAIN = `${SUB}.contentbox.site`
const THEME_PRESET = 'frost'

const ABOUT_HTML = `
<p>Добро пожаловать в мир историй по вселенной «Холодного сердца»!</p>
<p>Это дом для фанфиков и рассказов об Эренделле: приключения, романтика, семья, магия льда и северное сияние. Здесь читатели находят новые главы, а авторы — благодарную аудиторию.</p>
<p>Истории собраны по разделам и меткам — жанрам, пейрингам и тропам, — чтобы легко найти своё: от лёгкого флаффа до больших саг.</p>
<h3>❄️ Разделы</h3>
<p>Приключения и AU · Романтика · Джен и Семья · Кроссоверы · Мини · Макси.</p>
<h3>💙 Метки</h3>
<p>Пейринги, жанры и тропы — навигация в один клик.</p>
<h3>✍️ Авторам</h3>
<p>Публикуйте истории главами, собирайте отзывы и подписчиков, участвуйте в фестах и челленджах сообщества.</p>
<h3>Возрастные ограничения</h3>
<p>Материалы для взрослых публикуются под соответствующей возрастной пометкой и доступны только совершеннолетним.</p>
`

async function main() {
  const doWrite = process.env.CONFIRM === 'CREATE'
  const payload = await getPayload({ config })

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
    console.log(`  • Настройки сайта: тема "${THEME_PRESET}" (Ледяной иней)`)
    console.log(`  • Страница: «О проекте» (slug=o-proekte, в меню)`)
    console.log('')
    console.log('ВАЖНО: миграция frost должна быть применена к БД до запуска (см. шапку файла).')
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
      category: 'other',
      description: 'Фанфики и истории по вселенной «Холодного сердца»: приключения, романтика, магия льда.',
      onboardingComplete: true,
      onboardingStep: 99,
    } as any,
    overrideAccess: true,
  })) as any
  console.log(`OK тенант #${tenant.id} "${tenant.name}" (${DOMAIN})`)

  // 2) Настройки сайта (одна запись на тенант; ледяная тема)
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
  console.log(`  1. Настрой DNS/SSL для ${DOMAIN} (как для bts/maru).`)
  console.log(`  2. Открой https://${DOMAIN} — в шапке будет «О проекте», тема ледяная.`)
  console.log('  3. Демо-каталог историй + аккаунт автора — отдельной задачей (сид контента).')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
