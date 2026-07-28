import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * ОДНОРАЗОВЫЙ seed демо-контента для тенанта `nietzsche` (витрина платформы).
 * Создаёт через Local API: оформление (серифная тема + hero), 4 категории,
 * 7 публикаций (оригинальный редакторский текст о Ницше — public domain),
 * 2 тарифа подписки. Идемпотентно. Активирует тенант, чтобы домен открывался.
 *
 * Защита: заголовок `x-seed-key` (или ?key=) должен совпасть с PAYLOAD_SECRET.
 * Вызывать POST-запросом один раз после деплоя, затем роут можно удалить.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUBDOMAIN = 'nietzsche'
const TENANT_NAME = 'Фридрих Ницше'

/** Мини-конструктор Lexical richText из абзацев. */
function rt(paras: string[]) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: paras.map((text) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        textStyle: '',
        children: [
          { type: 'text', format: 0, style: '', mode: 'normal', detail: 0, text, version: 1 },
        ],
      })),
    },
  }
}

const CATS = [
  { slug: 'aforizmy', title: 'Афоризмы', order: 1 },
  { slug: 'zarathustra', title: 'Так говорил Заратустра', order: 2 },
  { slug: 'beyond-good-evil', title: 'По ту сторону добра и зла', order: 3 },
  { slug: 'biography', title: 'Биография', order: 4 },
]

const PUBS = [
  {
    slug: 'sverkhchelovek',
    title: 'Сверхчеловек: кем становится тот, кто преодолел себя',
    cat: 'zarathustra',
    featured: true,
    agoDays: 1,
    body: [
      '«Человек есть нечто, что должно быть преодолено» — с этой мысли начинается замысел о сверхчеловеке. Ницше говорит не о новой расе и не о силаче, а о том, кто научился превосходить самого себя.',
      'Сверхчеловек — не цель, данная извне, а вертикаль, которую человек выстраивает сам: из своих страстей, ошибок и воли. Он не бежит от жизни к утешению, а придаёт ей форму.',
      'Заратустра спускается с гор, чтобы поделиться этим избытком. Его учение — приглашение стать художником собственной судьбы, а не должником чужой морали.',
    ],
  },
  {
    slug: 'vechnoe-vozvrashchenie',
    title: 'Вечное возвращение: если бы эта жизнь повторялась бесконечно',
    cat: 'zarathustra',
    agoDays: 4,
    body: [
      'Представьте, что демон шепнёт вам: эту жизнь придётся прожить ещё раз и ещё — бесконечно, до мельчайшей боли и мельчайшей радости. Проклянёте вы его или назовёте божеством?',
      'Вечное возвращение у Ницше — не физическая гипотеза, а проверка. Вопрос не «правда ли это», а «как нужно жить, чтобы захотеть повторения».',
      'Тот, кто способен сказать жизни «да» даже так, обретает высшую форму любви к судьбе — amor fati.',
    ],
  },
  {
    slug: 'moral-gospod-i-rabov',
    title: 'Мораль господ и мораль рабов',
    cat: 'beyond-good-evil',
    agoDays: 6,
    body: [
      'В «По ту сторону добра и зла» Ницше различает две морали. Мораль господ рождается из силы и зовёт «хорошим» то, что возвышает; мораль рабов рождается из бессилия и объявляет добром лишь то, что безопасно.',
      'Рабская мораль — это месть слабого, ставшая ценностью: смирение, жалость и послушание возводятся в добродетель, потому что обессиливают сильного.',
      'Ницше не призывает к жестокости. Он вскрывает происхождение наших «вечных» ценностей — и спрашивает, кому они служат.',
    ],
  },
  {
    slug: 'volya-k-vlasti',
    title: 'Воля к власти: не выживание, а рост',
    cat: 'beyond-good-evil',
    agoDays: 9,
    body: [
      'Жизнь, по Ницше, стремится не к самосохранению, а к росту. Воля к власти — влечение всего живого расширяться, преодолевать, становиться большим, чем оно есть.',
      'Это в первую очередь не господство над другими, а власть над собой: над хаосом влечений, над инерцией, над страхом.',
      'Там, где другие видели идеалом покой, Ницше видел усилие — и в нём находил здоровье.',
    ],
  },
  {
    slug: 'bog-umer',
    title: '«Бог умер» — и что это на самом деле значит',
    cat: 'aforizmy',
    featured: true,
    isNews: true,
    agoDays: 2,
    body: [
      '«Бог умер» — самая известная и самая недопонятая фраза Ницше. Это не торжество атеиста, а диагноз эпохе: опора, на которой держались смысл и мораль Запада, исчезла.',
      'Ницше не радуется — он предупреждает. Если высшие ценности обесценились, человек рискует остаться в пустоте нигилизма.',
      'Выход он видит не в новом идоле, а в способности человека самому создавать ценности — и отвечать за них.',
    ],
  },
  {
    slug: 'aforizmy-molot',
    title: 'Десять строк, которые бьют как молот',
    cat: 'aforizmy',
    agoDays: 3,
    body: [
      'Ницше писал афоризмами не от нехватки системы, а из принципа: мысль должна бить точно и коротко. Вот несколько строк, переживших целые философские школы.',
      'Что не убивает меня, делает меня сильнее.',
      'Кто сражается с чудовищами, тому следует остерегаться, чтобы самому не стать чудовищем.',
      'Без музыки жизнь была бы ошибкой.',
      'И те, кто танцевал, казались безумными тем, кто не слышал музыки.',
      'У кого есть «зачем» жить, тот вынесет почти любое «как».',
      'Нужно носить в себе ещё хаос, чтобы родить танцующую звезду.',
    ],
  },
  {
    slug: 'biografiya',
    title: 'Фридрих Ницше: жизнь, уместившаяся в идеи',
    cat: 'biography',
    agoDays: 12,
    body: [
      'Фридрих Ницше (1844–1900) прожил жизнь, почти целиком ушедшую в мысль. Сын пастора, в 24 года он стал профессором классической филологии — и вскоре разочаровался в академии.',
      'Из-за болезни он оставил кафедру и годами скитался по Европе, записывая идеи между приступами боли. Именно в эти годы родились его главные книги.',
      'В 1889 году рассудок оставил его; последнее десятилетие он прожил в молчании. Слава пришла позже — и оказалась громче, чем он мог представить.',
    ],
  },
]

const TIERS = [
  { slug: 'reader', name: 'Читатель', weight: 1, priceRub: 199, description: 'Полный доступ ко всем статьям и афоризмам.' },
  { slug: 'ally', name: 'Соратник', weight: 2, priceRub: 499, description: 'Всё из «Читателя» плюс ранний доступ и закрытые разборы.' },
]

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const key = req.headers.get('x-seed-key') || url.searchParams.get('key')
  if (!process.env.PAYLOAD_SECRET || key !== process.env.PAYLOAD_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config: await config })

  // 1) тенант
  const tRes = await payload.find({
    collection: 'tenants',
    where: { subdomain: { equals: SUBDOMAIN } },
    limit: 1,
    overrideAccess: true,
  })
  const tenant = tRes.docs[0] as any
  if (!tenant) {
    return Response.json({ error: `tenant "${SUBDOMAIN}" not found — create it first` }, { status: 404 })
  }
  const tenantId = tenant.id

  // идемпотентность
  const already = await payload.find({
    collection: 'categories',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'aforizmy' } }] },
    limit: 1,
    overrideAccess: true,
  })
  if (already.docs[0]) {
    return Response.json({ ok: true, already: true, message: 'демо уже засеяно' })
  }

  // активируем тенант + имя
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { name: TENANT_NAME, status: 'active', domainVerified: true } as any,
    overrideAccess: true,
  })

  // 2) категории
  const catId: Record<string, number> = {}
  for (const c of CATS) {
    const doc = await payload.create({
      collection: 'categories',
      data: { tenant: tenantId, title: c.title, slug: c.slug, order: c.order, showInHeader: true } as any,
      overrideAccess: true,
    })
    catId[c.slug] = (doc as any).id
  }

  // 3) тарифы
  let tiers = 0
  for (const t of TIERS) {
    await payload.create({
      collection: 'subscription-tiers',
      data: { tenant: tenantId, name: t.name, slug: t.slug, weight: t.weight, priceRub: t.priceRub, description: t.description, isActive: true } as any,
      overrideAccess: true,
    })
    tiers++
  }

  // 4) публикации
  let pubs = 0
  for (const p of PUBS) {
    await payload.create({
      collection: 'publications',
      data: {
        tenant: tenantId,
        title: p.title,
        slug: p.slug,
        section: 'feed',
        category: catId[p.cat],
        publishedAt: new Date(Date.now() - p.agoDays * 86400000).toISOString(),
        featured: Boolean((p as any).featured),
        isNews: Boolean((p as any).isNews),
        description: rt(p.body),
      } as any,
      overrideAccess: true,
    })
    pubs++
  }

  // 5) оформление (серифная тема + hero + курированные секции главной)
  const catList = CATS.map((c) => catId[c.slug])
  const settingsData = {
    tenant: tenantId,
    themePreset: 'velvet-resonance',
    hero: {
      eyebrow: 'Наследие Фридриха Ницше',
      titleLines: 'Мысль, которая\nбьёт как молот',
    },
    homeSections: [
      { type: 'hero', enabled: true },
      { type: 'search', enabled: true },
      { type: 'latest', enabled: true },
      { type: 'categories', enabled: true },
    ],
    homeCategories: catList,
    heroChips: catList,
  }
  const sRes = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
  })
  if (sRes.docs[0]) {
    await payload.update({ collection: 'site-settings', id: (sRes.docs[0] as any).id, data: settingsData as any, overrideAccess: true })
  } else {
    await payload.create({ collection: 'site-settings', data: settingsData as any, overrideAccess: true })
  }

  return Response.json({ ok: true, tenant: TENANT_NAME, categories: CATS.length, publications: pubs, tiers })
}
