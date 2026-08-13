/**
 * Разовый сид: публикация-профиль «j-hope» (шаблон 'profile') с текстом.
 * Картинки (портрет=обложка, галерея, видео) добавляются вручную в студии.
 *
 * Запуск:
 *   node --env-file=.env --import=tsx scripts/seed-jhope-profile.ts [subdomain]
 * Тенант: аргумент/ENV SEED_TENANT (subdomain) → иначе домен *btsrussia* → иначе первый.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const SLUG = 'j-hope'
const LEAD =
  'Рэпер, танцор, автор песен и продюсер. Начинал как уличный танцор в Кванджу, стал одним из лучших перформеров современного K-pop и самостоятельным артистом мирового уровня.'

const profile = {
  eyebrow: 'Участник BTS · рэп-линия · главный танцор',
  subtitle: 'Чон Хосок · 정호석 · «солнечный свет BTS»',
  lead: LEAD,
  quickFacts: [
    { label: 'Настоящее имя', value: 'Чон Хосок (정호석)' },
    { label: 'Дата рождения', value: '18 февраля 1994' },
    { label: 'Место', value: 'Кванджу, Республика Корея' },
    { label: 'Позиции', value: 'Гл. танцор · рэпер · автор' },
    { label: 'Дебют в BTS', value: '2013' },
    { label: 'Лейбл', value: 'BIGHIT / HYBE' },
    { label: 'Собака', value: 'Микки' },
    { label: 'Фандом', value: 'ARMY' },
  ],
  sections: [
    {
      title: 'Роль в BTS',
      body:
        'Официальные позиции j-hope обычно обозначают двумя словами: рэпер и главный танцор. Но на практике он — основа сценических выступлений, эмоциональный двигатель группы и связующее звено между участниками.\n\nСтрогий профессионал на репетициях и источник энергии на сцене. Человек, без которого сцена BTS была бы другой.',
    },
    {
      title: 'Характер',
      body:
        'Публичный образ j-hope часто описывают словами «солнце», «энергия» и «надежда». За этим стоит осознанный выбор быть светлым, дисциплина, требовательность к себе и внимание к окружающим.\n\nОтдельная черта — любовь к порядку и аккуратности, а ещё чувство юмора и умение легко пугаться, но не бояться творческого риска.',
    },
    {
      title: 'Любовь к танцу и сцене',
      body:
        'Для j-hope танец никогда не был дополнительным навыком — это начало пути и способ существования. Свобода, построенная на дисциплине, и сцена как место полной честности.\n\nИменно с уличного хип-хопа в команде Neuron началась его дорога к музыке и мировым гастролям.',
    },
  ],
  timeline: [
    { year: '1994', title: 'Рождение в Кванджу', text: 'Растёт в дружной семье со старшей сестрой; с детства тянется к движению и музыке.' },
    { year: 'Подростковые годы', title: 'Танцевальная команда Neuron', text: 'Уличный хип-хоп, popping, региональные конкурсы. Умение приковывать внимание зрителя.' },
    { year: '2013', title: 'Дебют в составе BTS', text: 'Осваивает рэп и написание текстов, становится одним из самых универсальных артистов группы.' },
    { year: '2018', title: 'Микстейп «Hope World»', text: 'Первый сольный проект, высокие оценки критиков, международный успех.' },
    { year: '2022', title: 'Альбом «Jack In The Box» · Lollapalooza', text: 'Намеренно мрачный сольный альбом; первый южнокорейский хедлайнер главной сцены фестиваля.' },
    { year: '2023–2024', title: 'Военная служба', text: 'Служит помощником инструктора; второй участник BTS, завершивший службу. «HOPE ON THE STREET VOL.1» подготовлен заранее.' },
    { year: '2025', title: 'Мировой тур «HOPE ON THE STAGE»', text: 'Первый сольный мировой тур — 16 городов, стадионы; новые синглы.' },
    { year: '2026', title: 'Полноценное воссоединение BTS', text: 'Возвращение к общей работе группы.' },
  ],
  relations: [
    { name: 'RM', text: 'Взаимное уважение лидера и главного танцора; опора в рабочих и творческих решениях.' },
    { name: 'SUGA', text: 'Часть рэп-линии; разные темпераменты, дополняющие друг друга на сцене и в студии.' },
    { name: 'Jimin', text: 'Близкая дружба, общая любовь к танцу и перформансу.' },
    { name: 'Jung Kook · Jin · V', text: 'Наставничество, поддержка и та самая атмосфера «семеро вместе», которую Хосок помогает держать.' },
  ],
  releases: [
    { title: 'Hope World', meta: 'Микстейп', year: '2018' },
    { title: 'Chicken Noodle Soup', meta: 'feat. Becky G', year: '2019' },
    { title: 'Jack In The Box', meta: 'Альбом', year: '2022' },
    { title: 'on the street', meta: 'with J. Cole', year: '2023' },
    { title: 'HOPE ON THE STREET VOL.1', meta: 'Спец. альбом', year: '2024' },
    { title: 'Sweet Dreams', meta: 'Сингл', year: '2025' },
    { title: 'MONA LISA', meta: 'Сингл', year: '2025' },
    { title: "Killin' It Girl", meta: 'Сингл', year: '2025' },
  ],
  films: [
    { title: 'j-hope IN THE BOX', meta: 'Документальный', year: '2023' },
    { title: 'HOPE ON THE STREET', meta: 'Док. сериал', year: '2024' },
    { title: 'HOPE ON THE STAGE — THE MOVIE', meta: 'Концертный', year: '2025' },
  ],
  awards: [
    { title: 'MAMA Awards', subtitle: 'Сольный артист', icon: '🏆' },
    { title: 'Korean Hip-hop Awards', subtitle: 'Признание в жанре', icon: '🎤' },
    { title: 'iHeartRadio', subtitle: 'Music Awards', icon: '📻' },
    { title: 'Grammy', subtitle: 'Номинации в составе BTS', icon: '🎼' },
    { title: 'Lollapalooza', subtitle: '1-й кор. хедлайнер главной сцены', icon: '🎪' },
    { title: 'Мировой тур', subtitle: '16 городов, стадионы США', icon: '🌍' },
    { title: 'Billboard 200', subtitle: 'Hope World · Jack In The Box', icon: '📈' },
  ],
  facts: [
    'Сценическое имя связано с надеждой', 'До BTS был известен как уличный танцор',
    'Сначала он не был рэпером', 'Однажды собирался уйти из компании',
    'Танцевальный капитан BTS', 'Личность на репетициях отличается от сцены',
    'J. Cole — один из музыкальных ориентиров', 'Chicken Noodle Soup возвращает к юности',
    '1-й кор. хедлайнер Lollapalooza', 'Первый сольный альбом — намеренно мрачный',
    'Физический релиз после цифрового', 'HOPE ON THE STREET готовил ещё до армии',
    'В армии стал помощником инструктора', '2-й участник BTS, завершивший службу',
    'Первый тур охватил 16 городов', 'Известен любовью к порядку',
    'Легко пугается, но не боится творческого риска', 'У него есть собака Микки',
    'Старшая сестра работает в модной индустрии', 'В 2026 вернулся к работе в BTS',
  ],
}

const lexical = {
  root: { type: 'root', format: '', indent: 0, version: 1, direction: null as any,
    children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null as any,
      children: [{ type: 'text', text: LEAD, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] }] },
}

async function main() {
  const payload = await getPayload({ config: await (config as any) })
  const want = (process.argv[2] || process.env.SEED_TENANT || '').trim()

  const tenants = await payload.find({ collection: 'tenants', limit: 100, depth: 0, overrideAccess: true })
  let tenant: any = null
  if (want) tenant = (tenants.docs as any[]).find((t) => String(t.subdomain) === want || String(t.domain).includes(want))
  if (!tenant) tenant = (tenants.docs as any[]).find((t) => String(t.domain || '').includes('btsrussia'))
  if (!tenant) tenant = (tenants.docs as any[])[0]
  if (!tenant) { console.error('Тенант не найден'); process.exit(1) }
  console.log(`Тенант: ${tenant.name} (${tenant.subdomain}/${tenant.domain}) id=${tenant.id}`)

  const owner = (await payload.find({ collection: 'users', where: { tenant: { equals: tenant.id } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as any

  const existing = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: SLUG } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })

  const data: any = {
    title: 'j-hope', slug: SLUG, tenant: tenant.id,
    template: 'profile', profile, description: lexical,
    publishedAt: existing.docs[0]?.publishedAt || new Date().toISOString(),
  }
  if (owner && !existing.docs.length) data.owner = owner.id

  if (existing.docs.length) {
    await payload.update({ collection: 'publications', id: (existing.docs[0] as any).id, data, overrideAccess: true })
    console.log(`Обновлена публикация /publication/${SLUG}`)
  } else {
    const doc = await payload.create({ collection: 'publications', data, overrideAccess: true })
    console.log(`Создана публикация /publication/${SLUG} (id=${(doc as any).id})`)
  }
  console.log('Готово. Портрет (обложка), галерею и видео добавьте в студии.')
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
