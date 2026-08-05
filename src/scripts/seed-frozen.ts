import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { htmlToLexical } from '../lib/lexical'

/**
 * Быстрый запуск демо-проекта «Frozen» (фанфики по «Холодному сердцу»).
 * ВОЗОБНОВЛЯЕМЫЙ: переиспользует уже созданный тенант и до-создаёт недостающие
 * настройки/страницу (безопасно перезапускать после частичного прогона).
 *
 * Тема по умолчанию — 'frost' («Ледяной иней»), добавляется миграцией
 * 20260805_250000_add_frost_preset. Если в БД её ещё нет — ставим временно
 * 'digital-monolith' (без падения), позже переключишь на «Ледяной иней» в студии.
 * Тему можно задать явно через THEME=<id>.
 *
 * DRY-RUN по умолчанию; реальные изменения — только с CONFIRM=CREATE.
 *
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-frozen.ts
 *   CONFIRM=CREATE DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/seed-frozen.ts
 */

const SUB = 'frozen'
const NAME = 'Frozen · Истории Эренделла'
const DOMAIN = `${SUB}.contentbox.site`
const THEME_PRESET = process.env.THEME || 'frost'
const THEME_FALLBACK = 'digital-monolith'
const PAGE_SLUG = 'o-proekte'

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

  // 1) Тенант — найти существующий или создать.
  const found = await payload.find({
    collection: 'tenants',
    where: { subdomain: { equals: SUB } },
    limit: 1, depth: 0, overrideAccess: true,
  })
  let tenant = found.docs[0] as any

  // 2) Настройки и страница — проверить наличие (если тенант уже есть).
  let hasSettings = false
  let hasPage = false
  if (tenant) {
    const s = await payload.find({ collection: 'site-settings', where: { tenant: { equals: tenant.id } }, limit: 1, depth: 0, overrideAccess: true })
    hasSettings = s.docs.length > 0
    const pg = await payload.find({ collection: 'pages', where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: PAGE_SLUG } }] }, limit: 1, depth: 0, overrideAccess: true })
    hasPage = pg.docs.length > 0
  }

  if (!doWrite) {
    console.log('DRY-RUN (ничего не меняю). Текущее состояние / план:')
    console.log(`  • Тенант "${NAME}" (${SUB}): ${tenant ? `есть #${tenant.id}` : 'будет создан'}`)
    console.log(`  • Настройки сайта (тема "${THEME_PRESET}"): ${tenant ? (hasSettings ? 'есть' : 'будут созданы') : 'будут созданы'}`)
    console.log(`  • Страница «О проекте» (/page/${PAGE_SLUG}): ${tenant ? (hasPage ? 'есть' : 'будет создана') : 'будет создана'}`)
    console.log('')
    console.log('Запусти с CONFIRM=CREATE, чтобы применить.')
    process.exit(0)
  }

  // Создание/дозаполнение
  if (!tenant) {
    tenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: NAME, subdomain: SUB, domain: DOMAIN, status: 'active', domainVerified: true,
        plan: 'free', category: 'other',
        description: 'Фанфики и истории по вселенной «Холодного сердца»: приключения, романтика, магия льда.',
        onboardingComplete: true, onboardingStep: 99,
      } as any,
      overrideAccess: true,
    })) as any
    console.log(`OK тенант #${tenant.id} "${tenant.name}" (${DOMAIN})`)
  } else {
    console.log(`= тенант уже есть #${tenant.id} "${tenant.name}" — переиспользую`)
  }

  if (!hasSettings) {
    let settings: any
    try {
      settings = await payload.create({ collection: 'site-settings', data: { tenant: tenant.id, themePreset: THEME_PRESET } as any, overrideAccess: true })
      console.log(`OK настройки #${settings.id} (тема ${THEME_PRESET})`)
    } catch (e) {
      console.warn(`! Тема "${THEME_PRESET}" недоступна в БД (миграция frost не применена?). Ставлю "${THEME_FALLBACK}" временно.`)
      settings = await payload.create({ collection: 'site-settings', data: { tenant: tenant.id, themePreset: THEME_FALLBACK } as any, overrideAccess: true })
      console.log(`OK настройки #${settings.id} (тема ${THEME_FALLBACK} — переключишь на «Ледяной иней» в студии после деплоя frost)`)
    }
  } else {
    console.log('= настройки уже есть — пропускаю')
  }

  if (!hasPage) {
    const page = (await payload.create({
      collection: 'pages',
      data: { tenant: tenant.id, title: 'О проекте', slug: PAGE_SLUG, content: htmlToLexical(ABOUT_HTML), showInMenu: true, menuOrder: 1 } as any,
      overrideAccess: true,
    })) as any
    console.log(`OK страница #${page.id} «О проекте» → /page/${PAGE_SLUG}`)
  } else {
    console.log('= страница «О проекте» уже есть — пропускаю')
  }

  console.log('')
  console.log('Готово. Дальше: DNS/SSL для ' + DOMAIN + ' (как для bts/maru).')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
