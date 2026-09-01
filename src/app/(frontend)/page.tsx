import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { HeroBlock } from '@/blocks/HeroBlock'
import { LatestPublicationsBlock } from '@/blocks/LatestPublicationsBlock'
import { getHomeFeed } from '@/lib/homeFeed'
import { PosterRow } from '@/blocks/PosterRow'
import { HeroTeamBlock } from '@/blocks/HeroTeamBlock'
import { CategoriesGridBlock } from '@/blocks/CategoriesGridBlock'
import { SearchBlock } from '@/blocks/SearchBlock'
import { type HeroSlide } from '@/components/HeroFeaturedSlider'
import { WhyUsBlock } from '@/blocks/WhyUsBlock'
import { SocialLinksBlock } from '@/blocks/SocialLinksBlock'
import { BroadcastBannerBlock } from '@/blocks/BroadcastBannerBlock'
import { AuthorSpotlightBlock } from '@/blocks/AuthorSpotlightBlock'
import { CarouselBlock } from '@/blocks/CarouselBlock'
import { PosterGridBlock } from '@/blocks/PosterGridBlock'
import { PhotoShowcaseBlock } from '@/blocks/PhotoShowcaseBlock'
import { buildMetadata } from '@/lib/seo'
import { categoryHref } from '@/lib/categoryHref'
import { publishedWhere } from '@/lib/published'
import { getPublicationCardStats } from '@/lib/publicationCardStats'
import { normalizeHomeSections, type HomeSectionType, type HomeSectionConfig, type HomeSectionSource } from '@/lib/homeSections'
import { resolveWhyUs } from '@/lib/whyUs'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { planChange, type SubState } from '@/lib/subscriptionChange'
import { type PerkType } from '@/components/studio/PerkIcon'
import type { Metadata } from 'next'
import { Fragment, type ReactNode } from 'react'
import './styles.css'
import type { Payload } from 'payload'

// Страница ДИНАМИЧЕСКАЯ и иначе быть не может: и layout, и сама страница
// резолвят тенанта через headers(), а один и тот же HTML нельзя отдавать на
// разных доменах. Прежний `export const revalidate = 3600` тут не работал —
// присутствие headers() всё равно переводило рендер в динамический режим, так
// что комментарий описывал намерение, а не поведение.
//
// Кэшируется не страница, а ДАННЫЕ: getHomeFeed завёрнут в unstable_cache с
// ключом по тенанту, TTL час и тегом `home:<tenantId>` — публикация материала
// или новый комментарий сбрасывают ленту своего тенанта (см. lib/homeFeed.ts).

/**
 * Дефолтные тексты Hero — фолбэк, когда settings.hero не заполнен (мягкий
 * фолбэк 3-простой: пусто → показываем эти значения, чтобы главная не осталась
 * без слогана). Единый источник дефолта.
 */
const DEFAULT_HERO_TITLE_LINES = ['Добро пожаловать']

/** Дефолтные тексты баннера «ON AIR» — фолбэк, когда settings.banner пуст. */
const DEFAULT_BANNER_TAGLINE = 'В эфире'
const DEFAULT_BANNER_ONAIR = 'ON AIR'

/** Непустая строка → она, иначе fallback (мягкий фолбэк 3-простой). */
function textOr(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw.trim() ? raw : fallback
}

/** Строки заголовка из textarea (по \n), пустые отбрасываем; пусто → дефолт. */
function resolveHeroTitleLines(raw: unknown, fallbackName?: string): string[] {
  const fallback = fallbackName ? [fallbackName] : DEFAULT_HERO_TITLE_LINES
  if (typeof raw !== 'string') return fallback
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return lines.length > 0 ? lines : fallback
}

/**
 * Слайды новинок для карусели hero: сначала featured-публикации, если их
 * меньше 6 — добираем последними по дате (дедуп по id). До 6 слайдов.
 */
async function getHeroSlides(payload: Payload, tenantId: number): Promise<HeroSlide[]> {
  const N = 6
  const seen = new Set<string | number>()
  const out: HeroSlide[] = []
  const push = (d: any) => {
    if (out.length >= N || seen.has(d.id)) return
    seen.add(d.id)
    out.push({
      id: d.id,
      title: d.title,
      coverUrl: d.cover && typeof d.cover === 'object' ? (d.cover.url ?? null) : null,
      href: `/publication/${d.slug}`,
      badge: 'Новинка',
    })
  }
  // Черновик (publishedAt = null) в слайдер попадать не должен — и тем более
  // не должен стоять первым, а именно это давал NULLS FIRST при '-publishedAt'.
  const published = publishedWhere()

  const feat = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenantId } }, { featured: { equals: true } }, published] },
    sort: '-publishedAt', depth: 1, limit: N, overrideAccess: true,
  })
  ;(feat.docs as any[]).forEach(push)
  if (out.length < N) {
    const latest = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenantId } }, published] },
      sort: '-publishedAt', depth: 1, limit: N, overrideAccess: true,
    })
    ;(latest.docs as any[]).forEach(push)
  }
  return out
}

/**
 * Данные секции «Об авторе и подписка»: bio из тенанта, лого/соцсети из настроек,
 * активные тарифы и счётчики контента/подписчиков (пер-тенант). Счётчики берём
 * лениво — только когда секция включена. Нулевые статы не показываем.
 */
async function getAuthorSpotlight(payload: Payload, tenant: any, settings: any) {
  const tenantId = tenant.id as number
  const [media, subs, tiersRes] = await Promise.all([
    payload.find({ collection: 'videos', where: { tenant: { equals: tenantId } }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'subscribers', where: { tenant: { equals: tenantId } }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'subscription-tiers', where: { and: [{ tenant: { equals: tenantId } }, { isActive: { equals: true } }] }, sort: 'weight', depth: 0, limit: 10, overrideAccess: true }),
  ])
  // Счётчики витрины — управляемые (settings.authorStats), с фолбэком на реальные
  // числа. Значение — строка (можно «800+», «100 тыс+»).
  const st = (settings?.authorStats ?? {}) as { videosValue?: string; videosLabel?: string; membersValue?: string; membersLabel?: string }
  const stats: { value: string; label: string }[] = []
  const videosVal = (st.videosValue && st.videosValue.trim()) || (media.totalDocs > 0 ? String(media.totalDocs) : '')
  if (videosVal) stats.push({ value: videosVal, label: (st.videosLabel && st.videosLabel.trim()) || 'озвученных видео' })
  const membersVal = (st.membersValue && st.membersValue.trim()) || (subs.totalDocs > 0 ? String(subs.totalDocs) : '')
  if (membersVal) stats.push({ value: membersVal, label: (st.membersLabel && st.membersLabel.trim()) || 'участников' })

  // Текущее состояние подписки (если вошёл) — чтобы карточки на главной знали:
  // «уже есть подписка» / «повысить» / «понизить», а не всегда «Оформить».
  const sub = await getCurrentSubscriber(tenantId).catch(() => null)
  let subState: SubState = { activeTierId: null, activePriceRub: 0, until: null }
  if (sub) {
    const rel = (sub as any).activeTier
    const activeTierId = ((): number | null => {
      const id = rel && typeof rel === 'object' ? rel.id : rel
      return id != null ? Number(id) : null
    })()
    const until = (sub as any).subscriptionUntil ? new Date((sub as any).subscriptionUntil) : null
    let activePriceRub = activeTierId != null ? Number((tiersRes.docs as any[]).find((t) => String(t.id) === String(activeTierId))?.priceRub || 0) : 0
    if (activeTierId != null && activePriceRub === 0) {
      const at: any = await payload.findByID({ collection: 'subscription-tiers', id: activeTierId, depth: 0, overrideAccess: true }).catch(() => null)
      activePriceRub = Number(at?.priceRub || 0)
    }
    subState = { activeTierId, activePriceRub, until }
  }
  const now = new Date()

  const tiers = (tiersRes.docs as any[]).map((t) => ({
    id: t.id as number | string,
    name: t.name as string,
    priceRub: Number(t.priceRub ?? 0),
    badge: typeof t.badge === 'string' && t.badge.trim() ? t.badge.trim() : null,
    description: typeof t.description === 'string' && t.description.trim() ? t.description.trim() : null,
    perks: Array.isArray(t.perks)
      ? (t.perks as any[])
          .map((pk) => ({ type: (pk?.type || 'included') as PerkType, text: String(pk?.text || '') }))
          .filter((p) => p.text.trim().length > 0)
      : [],
    plan: planChange({ id: t.id, priceRub: Number(t.priceRub ?? 0) }, subState, now),
  }))

  const appIconM = settings?.appIcon && typeof settings.appIcon === 'object' ? settings.appIcon : null
  const logoM = settings?.logo && typeof settings.logo === 'object' ? settings.logo : null
  const logoUrl = (appIconM?.url as string | undefined) ?? (logoM?.url as string | undefined) ?? null
  const bio = typeof tenant.description === 'string' && tenant.description.trim() ? tenant.description : null

  return {
    name: (tenant.name as string) ?? '',
    bio,
    logoUrl,
    stats,
    socials: ((settings?.socials ?? []) as any[]).filter((so) => so && so.url).map((so) => ({ platform: so.platform, url: so.url })),
    tiers,
    subscribeHref: '/subscribe',
  }
}

/** SEO главной (ТЗ §6): только дефолты тенанта, без titleTemplate. */
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx
  const defaults = settings?.seoDefaults

  // На главной шаблон "%s — Бренд" не применяем, иначе выйдет "Бренд — Бренд".
  return buildMetadata({
    defaults: { ...defaults, titleTemplate: null },
    fallbackTitle: tenant.name,
    brandName: tenant.name,
  })
}


function mapPubCard(p: any, stats?: { comments: number; reactions: number }) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    publishedAt: p.publishedAt,
    minTierName: p.minTier && typeof p.minTier === 'object' ? (p.minTier.name || p.minTier.slug || null) : null,
    cover: p.cover,
    commentCount: stats?.comments ?? 0,
    reactionCount: stats?.reactions ?? 0,
    hasVideo: Array.isArray(p.relatedVideos) && p.relatedVideos.length > 0,
    hasGallery: Array.isArray(p.gallery) && p.gallery.length > 0,
  }
}

/** Данные списочной секции по источнику. auto/нет → слот общей ленты; иначе —
 * публикации по категории/тегу/ручному списку. Ошибка источника → fallback. */
async function resolveListItems(
  payload: Payload,
  tenantId: number,
  source: HomeSectionSource | undefined,
  fallback: any[],
): Promise<any[]> {
  if (!source || source.kind === 'auto') {
    // «Авто» тянет готовый слот общей ленты (с дедупом между секциями). Поле
    // «Сколько показывать» тут раньше игнорировалось — теперь режем ленту до
    // заданного числа (ограничено размером слота ленты).
    const lim = source?.limit && source.limit > 0 ? Math.min(source.limit, 50) : null
    return lim ? fallback.slice(0, lim) : fallback
  }
  const limit = source.limit && source.limit > 0 ? Math.min(source.limit, 50) : 12
  let where: any = null
  if (source.kind === 'category' && source.categoryId) {
    where = { or: [{ category: { equals: source.categoryId } }, { extraCategories: { in: [source.categoryId] } }] }
  } else if (source.kind === 'tag' && source.tagId) {
    where = { tags: { in: [source.tagId] } }
  } else if (source.kind === 'manual' && source.manualIds && source.manualIds.length) {
    where = { id: { in: source.manualIds } }
  } else {
    return fallback
  }
  try {
    const res = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenantId } }, publishedWhere(), where] },
      sort: '-publishedAt',
      depth: 1,
      limit,
      overrideAccess: true,
    })
    let docs = res.docs as any[]
    if (source.kind === 'manual' && source.manualIds) {
      const order = new Map(source.manualIds.map((id, i) => [Number(id), i]))
      docs = [...docs].sort((a, b) => (order.get(Number(a.id)) ?? 999) - (order.get(Number(b.id)) ?? 999))
    }
    const stats = await getPublicationCardStats(docs.map((d) => d.id), tenantId)
    return docs.map((d) => mapPubCard(d, stats.get(String(d.id))))
  } catch {
    return fallback
  }
}

export default async function HomePage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) {
    return <div className="p-8">Тенант не определён. Откройте сайт по адресу тенанта.</div>
  }
  const { tenant, settings } = ctx

  // Конфиг секций главной: порядок + видимость. Пусто/мусор → дефолт (все 7
  // в текущем порядке) — обратная совместимость. Рендерим только enabled.
  const sections = normalizeHomeSections(settings?.homeSections)
  const activeTypes = new Set<HomeSectionType>(
    sections.filter((s) => s.enabled).map((s) => s.type),
  )

  // Лениво: запросы к БД только под реально активные секции.
  const needsFeatured = activeTypes.has('hero')
  const needsFeed =
    activeTypes.has('news') ||
    activeTypes.has('search') ||
    activeTypes.has('latest') ||
    activeTypes.has('popular') ||
    activeTypes.has('discussed') ||
    activeTypes.has('popularCategories') ||
    activeTypes.has('posterRows') ||
    activeTypes.has('carousel') ||
    activeTypes.has('posterGrid')

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const heroSlides = needsFeatured ? await getHeroSlides(payload, tenant.id as number) : []

  // Ручные категории (для секции categories) — их id исключаем из «Популярных разделов».
  const manualCategoryIds = ((settings?.homeCategories ?? []) as any[])
    .map((c) => (c && typeof c === 'object' ? c.id : c))
    .filter((id) => id != null)

  // Лента главной: новости / последние / популярное / обсуждаемое / популярные
  // разделы — одним хелпером, с исключением дублей «сверху вниз».
  const feed = needsFeed
    ? await getHomeFeed(tenant.id as number, manualCategoryIds)
    : { news: [], latest: [], popular: [], discussed: [], popularCategories: [], posterRows: [] }

  const spotlight = activeTypes.has('authorSpotlight')
    ? await getAuthorSpotlight(payload, tenant, settings)
    : null

  // Маппинг type → рендер секции. Пропсы собраны ровно как в прежнем JSX;
  // авто-скрытие при пустых данных остаётся внутри блок-компонентов.
  const renderers: Partial<Record<HomeSectionType, (inst: HomeSectionConfig) => ReactNode>> = {
    hero: () => {
      // Категории-чипсы Hero — под заголовком (см. HeroBlock), настраиваются в
      // конструкторе главной, секция «Заголовок (Hero)».
      const heroChipList = ((settings?.heroChips ?? []) as any[])
        .filter((c) => c && typeof c === 'object' && c.slug)
        .map((c) => ({ title: c.title, href: categoryHref(c) }))
      return (
        <HeroBlock
          eyebrow={settings?.hero?.eyebrow || undefined}
          titleLines={resolveHeroTitleLines(settings?.hero?.titleLines, tenant?.name)}
          chips={heroChipList}
          slides={heroSlides}
        />
      )
    },
    heroTeam: () => (
      <HeroTeamBlock
        members={(settings?.heroTeam?.members ?? []) as any[]}
        caption={settings?.heroTeam?.caption}
        avatarSize={settings?.heroTeam?.avatarSize}
      />
    ),
    search: () => {
      // Быстрые чипсы под поиском — только «популярные разделы» (авто).
      // Hero-чипсы теперь живут под заголовком Hero (см. рендер hero выше).
      const popular = feed.popularCategories
        .slice(0, 6)
        .map((c) => ({ title: c.title, href: c.href }))
      return <SearchBlock chips={popular} />
    },
    posterRows: () => (
      <>
        {feed.posterRows.map((row) => (
          <PosterRow key={row.id} title={row.title} href={row.href} items={row.items} />
        ))}
      </>
    ),
    popularCategories: (inst) => (
      <CategoriesGridBlock
        heading={inst.config?.heading || 'Популярные разделы'}
        items={feed.popularCategories.map((c) => ({
          id: c.id,
          title: c.title,
          href: c.href,
          cover: c.cover,
        }))}
      />
    ),
    categories: () => (
      <CategoriesGridBlock
        items={((settings?.homeCategories ?? []) as any[])
          .filter((c) => c && typeof c === 'object' && c.slug)
          .map((c) => ({ id: c.id, title: c.title, href: categoryHref(c), cover: c.cover }))}
      />
    ),
    whyUs: () => (
      <WhyUsBlock
        heading={`Почему ${tenant?.name ?? 'мы'}`}
        items={resolveWhyUs((settings as any)?.whyUs)}
      />
    ),
    socials: () => <SocialLinksBlock items={(settings?.socials ?? []) as any[]} />,
    authorSpotlight: () => (spotlight ? <AuthorSpotlightBlock {...spotlight} /> : null),
    broadcast: () => (
      <BroadcastBannerBlock
        tagline={textOr(settings?.banner?.tagline, DEFAULT_BANNER_TAGLINE)}
        onAirText={textOr(settings?.banner?.onAirText, DEFAULT_BANNER_ONAIR)}
      />
    ),
  }

  // Source-driven секции: заголовок + источник берутся из config экземпляра,
  // данные — через resolveListItems (fallback — слот общей ленты). Один список
  // задаёт дефолтный заголовок, запасные данные и компонент рендера.
  const SOURCE_SECTIONS: Partial<
    Record<HomeSectionType, { heading: string; fallback: any[]; render: (heading: string, items: any[]) => ReactNode }>
  > = {
    news: { heading: 'Новости', fallback: feed.news, render: (h, i) => <LatestPublicationsBlock heading={h} items={i} /> },
    latest: { heading: 'Последние публикации', fallback: feed.latest, render: (h, i) => <LatestPublicationsBlock heading={h} items={i} /> },
    popular: { heading: 'Сейчас популярно', fallback: feed.popular, render: (h, i) => <LatestPublicationsBlock heading={h} items={i} /> },
    discussed: { heading: 'Обсуждаемое', fallback: feed.discussed, render: (h, i) => <LatestPublicationsBlock heading={h} items={i} /> },
    carousel: { heading: 'Подборка', fallback: feed.latest, render: (h, i) => <CarouselBlock heading={h} items={i} /> },
    posterGrid: { heading: 'Афиша', fallback: feed.latest, render: (h, i) => <PosterGridBlock heading={h} items={i} /> },
  }

  // Каждая секция — по своему экземпляру: заголовок/источник из config, ключ по
  // id (дубли). Source-driven секции тянут данные из источника (resolveListItems).
  const enabledSections = sections.filter((s) => s.enabled)
  const flushTop = enabledSections[0]?.type === 'photoShowcase'
  const nodes = await Promise.all(
    enabledSections.map(async (s, i) => {
      const key = s.id != null ? String(s.id) : s.type + '-' + i
      const sd = SOURCE_SECTIONS[s.type]
      if (sd) {
        const heading = s.config?.heading || sd.heading
        const items = await resolveListItems(payload, tenant.id as number, s.config?.source, sd.fallback)
        return <Fragment key={key}>{sd.render(heading, items)}</Fragment>
      }
      if (s.type === 'photoShowcase') {
        const fid = s.config?.galleryFolderId
        if (!fid) return null
        const [folderRes, imgRes] = await Promise.all([
          payload.find({ collection: 'gallery-folders', where: { and: [{ tenant: { equals: tenant.id } }, { id: { equals: fid } }] }, limit: 1, depth: 0, overrideAccess: true }),
          payload.find({ collection: 'gallery-images', where: { and: [{ tenant: { equals: tenant.id } }, { folder: { equals: fid } }] }, limit: 24, depth: 0, overrideAccess: true }),
        ])
        const folder = folderRes.docs[0] as any
        const imgs = imgRes.docs as any[]
        if (!folder || imgs.length === 0) return null
        const pick = imgs[Math.floor(Math.random() * imgs.length)] as any
        const url = pick?.sizes?.large?.url || pick?.url || null
        if (!url) return null
        return (
          <Fragment key={key}>
            <PhotoShowcaseBlock
              imageUrl={url}
              alt={pick.alt || ''}
              folderTitle={folder.title || 'Галерея'}
              folderSlug={folder.slug || String(fid)}
              heading={s.config?.heading}
              count={imgRes.totalDocs}
            />
          </Fragment>
        )
      }
      const r = renderers[s.type]
      return <Fragment key={key}>{r ? r(s) : null}</Fragment>
    }),
  )

  return (
    <main className="page-canvas page-canvas--home" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className={`max-w-6xl mx-auto px-4 ${flushTop ? 'pb-8' : 'py-8'}`}>{nodes}</div>
    </main>
  )
}
