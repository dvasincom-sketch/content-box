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
import { buildMetadata } from '@/lib/seo'
import { categoryHref } from '@/lib/categoryHref'
import { publishedWhere } from '@/lib/published'
import { normalizeHomeSections, type HomeSectionType } from '@/lib/homeSections'
import type { Metadata } from 'next'
import { Fragment, type ReactNode } from 'react'
import './styles.css'

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
async function getHeroSlides(payload: any, tenantId: number): Promise<HeroSlide[]> {
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
    activeTypes.has('posterRows')

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

  // Маппинг type → рендер секции. Пропсы собраны ровно как в прежнем JSX;
  // авто-скрытие при пустых данных остаётся внутри блок-компонентов.
  const renderers: Record<HomeSectionType, () => ReactNode> = {
    hero: () => (
      <HeroBlock
        eyebrow={settings?.hero?.eyebrow || undefined}
        titleLines={resolveHeroTitleLines(settings?.hero?.titleLines, tenant?.name)}
        slides={heroSlides}
      />
    ),
    heroTeam: () => (
      <HeroTeamBlock
        members={(settings?.heroTeam?.members ?? []) as any[]}
        caption={settings?.heroTeam?.caption}
        avatarSize={settings?.heroTeam?.avatarSize}
      />
    ),
    news: () => <LatestPublicationsBlock heading="Новости" items={feed.news} />,
    latest: () => <LatestPublicationsBlock heading="Последние публикации" items={feed.latest} />,
    search: () => {
      // Быстрые чипсы: популярные разделы (авто); если их нет — фолбэк на
      // hero-чипсы тенанта, чтобы ряд не пропадал.
      const popular = feed.popularCategories
        .slice(0, 6)
        .map((c) => ({ title: c.title, href: c.href }))
      const heroChipList = ((settings?.heroChips ?? []) as any[])
        .filter((c) => c && typeof c === 'object' && c.slug)
        .map((c) => ({ title: c.title, href: categoryHref(c) }))
      return <SearchBlock chips={popular.length ? popular : heroChipList} />
    },
    popular: () => <LatestPublicationsBlock heading="Сейчас популярно" items={feed.popular} />,
    discussed: () => <LatestPublicationsBlock heading="Обсуждаемое" items={feed.discussed} />,
    posterRows: () => (
      <>
        {feed.posterRows.map((row) => (
          <PosterRow key={row.id} title={row.title} href={row.href} items={row.items} />
        ))}
      </>
    ),
    popularCategories: () => (
      <CategoriesGridBlock
        heading="Популярные разделы"
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
        items={[
          { icon: 'library', title: 'Эксклюзивный контент', text: 'Материалы, которых нет в открытом доступе — только для вашей аудитории.' },
          { icon: 'zap', title: 'Регулярные обновления', text: 'Новые публикации и видео выходят стабильно, а подписчики узнают о них первыми.' },
          { icon: 'globe', title: 'Доступ по подписке', text: 'Гибкие уровни доступа: часть материалов открыта всем, часть — для подписчиков.' },
          { icon: 'heart', title: 'Живое сообщество', text: 'Комментарии, реакции и обсуждения объединяют читателей вокруг вашего проекта.' },
        ]}
      />
    ),
    socials: () => <SocialLinksBlock items={(settings?.socials ?? []) as any[]} />,
    broadcast: () => (
      <BroadcastBannerBlock
        tagline={textOr(settings?.banner?.tagline, DEFAULT_BANNER_TAGLINE)}
        onAirText={textOr(settings?.banner?.onAirText, DEFAULT_BANNER_ONAIR)}
      />
    ),
  }

  return (
    <main className="page-canvas page-canvas--home" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {sections
          .filter((s) => s.enabled)
          .map((s) => <Fragment key={s.type}>{renderers[s.type]()}</Fragment>)}
      </div>
    </main>
  )
}
