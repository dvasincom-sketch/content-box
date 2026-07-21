import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { HeroBlock } from '@/blocks/HeroBlock'
import { LatestPublicationsBlock } from '@/blocks/LatestPublicationsBlock'
import { getHomeFeed } from '@/lib/homeFeed'
import { HeroTeamBlock } from '@/blocks/HeroTeamBlock'
import { CategoriesGridBlock } from '@/blocks/CategoriesGridBlock'
import { WhyUsBlock } from '@/blocks/WhyUsBlock'
import { SocialLinksBlock } from '@/blocks/SocialLinksBlock'
import { BroadcastBannerBlock } from '@/blocks/BroadcastBannerBlock'
import { buildMetadata } from '@/lib/seo'
import { categoryHref } from '@/lib/categoryHref'
import { normalizeHomeSections, type HomeSectionType } from '@/lib/homeSections'
import type { Metadata } from 'next'
import { Fragment, type ReactNode } from 'react'
import './styles.css'

// Главная кэшируется и ревалидируется раз в час: «Сейчас популярно» (за 3 дня)
// и «Обсуждаемое» обновляются, без персонализации страница остаётся статикой.
export const revalidate = 3600

/**
 * Дефолтные тексты Hero — фолбэк, когда settings.hero не заполнен (мягкий
 * фолбэк 3-простой: пусто → показываем эти значения, чтобы главная не осталась
 * без слогана). Единый источник дефолта.
 */
const DEFAULT_HERO_EYEBROW = 'BTS TV · 24/7 Broadcast'
const DEFAULT_HERO_TITLE_LINES = ['Полные выпуски BTS', 'с русской озвучкой']

/** Дефолтные тексты баннера «ON AIR» — фолбэк, когда settings.banner пуст. */
const DEFAULT_BANNER_TAGLINE = 'BTS TV'
const DEFAULT_BANNER_ONAIR = 'ON AIR'

/** Непустая строка → она, иначе fallback (мягкий фолбэк 3-простой). */
function textOr(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw.trim() ? raw : fallback
}

/** Строки заголовка из textarea (по \n), пустые отбрасываем; пусто → дефолт. */
function resolveHeroTitleLines(raw: unknown): string[] {
  if (typeof raw !== 'string') return DEFAULT_HERO_TITLE_LINES
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return lines.length > 0 ? lines : DEFAULT_HERO_TITLE_LINES
}

/** SEO главной (ТЗ §6): только дефолты тенанта, без titleTemplate. */
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx
  const defaults = (settings as any)?.seoDefaults

  // На главной шаблон "%s — Бренд" не применяем, иначе выйдет "Бренд — Бренд".
  return buildMetadata({
    defaults: { ...defaults, titleTemplate: null },
    fallbackTitle: (tenant as any)?.name,
    brandName: (tenant as any)?.name,
  })
}


export default async function HomePage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) {
    return <div className="p-8">Тенант не определён. Открой сайт по адресу тенанта, напр. http://bts.localhost:3000/</div>
  }
  const { tenant, settings } = ctx

  // Конфиг секций главной: порядок + видимость. Пусто/мусор → дефолт (все 7
  // в текущем порядке) — обратная совместимость. Рендерим только enabled.
  const sections = normalizeHomeSections((settings as any)?.homeSections)
  const activeTypes = new Set<HomeSectionType>(
    sections.filter((s) => s.enabled).map((s) => s.type),
  )

  // Лениво: запросы к БД только под реально активные секции.
  const needsFeatured = activeTypes.has('hero')
  const needsFeed =
    activeTypes.has('news') ||
    activeTypes.has('latest') ||
    activeTypes.has('popular') ||
    activeTypes.has('discussed') ||
    activeTypes.has('popularCategories')

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const featured = needsFeatured
    ? ((
        await payload.find({
          collection: 'publications',
          where: { and: [{ tenant: { equals: tenant.id } }, { featured: { equals: true } }] },
          sort: '-publishedAt', depth: 1, limit: 1, overrideAccess: true,
        })
      ).docs[0] as any)
    : null

  // Ручные категории (для секции categories) — их id исключаем из «Популярных разделов».
  const manualCategoryIds = (((settings as any)?.homeCategories ?? []) as any[])
    .map((c) => (c && typeof c === 'object' ? c.id : c))
    .filter((id) => id != null)

  // Лента главной: новости / последние / популярное / обсуждаемое / популярные
  // разделы — одним хелпером, с исключением дублей «сверху вниз».
  const feed = needsFeed
    ? await getHomeFeed(tenant.id as number, manualCategoryIds)
    : { news: [], latest: [], popular: [], discussed: [], popularCategories: [] }

  // Маппинг type → рендер секции. Пропсы собраны ровно как в прежнем JSX;
  // авто-скрытие при пустых данных остаётся внутри блок-компонентов.
  const renderers: Record<HomeSectionType, () => ReactNode> = {
    hero: () => (
      <HeroBlock
        eyebrow={textOr((settings as any)?.hero?.eyebrow, DEFAULT_HERO_EYEBROW)}
        titleLines={resolveHeroTitleLines((settings as any)?.hero?.titleLines)}
        chips={(((settings as any)?.heroChips ?? []) as any[])
          .filter((c) => c && typeof c === 'object' && c.slug)
          .map((c) => ({ title: c.title, href: categoryHref(c) }))}
        featured={featured ? { title: featured.title, badge: 'Новинка', cover: featured.cover } : null}
      />
    ),
    heroTeam: () => (
      <HeroTeamBlock
        members={((settings as any)?.heroTeam?.members ?? []) as any[]}
        caption={(settings as any)?.heroTeam?.caption}
        avatarSize={(settings as any)?.heroTeam?.avatarSize}
      />
    ),
    news: () => <LatestPublicationsBlock heading="Новости" items={feed.news} />,
    latest: () => <LatestPublicationsBlock heading="Последние публикации" items={feed.latest} />,
    popular: () => <LatestPublicationsBlock heading="Сейчас популярно" items={feed.popular} />,
    discussed: () => <LatestPublicationsBlock heading="Обсуждаемое" items={feed.discussed} />,
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
        items={(((settings as any)?.homeCategories ?? []) as any[])
          .filter((c) => c && typeof c === 'object' && c.slug)
          .map((c) => ({ id: c.id, title: c.title, href: categoryHref(c), cover: c.cover }))}
      />
    ),
    whyUs: () => (
      <WhyUsBlock
        heading="Почему COCO JAMBO"
        items={[
          { icon: 'mic', title: 'Русская озвучка живым голосом', text: 'Качественный перевод и естественная озвучка' },
          { icon: 'screen', title: 'Тысячи часов контента', text: 'Концерты, шоу, лайвы и эксклюзивы' },
          { icon: 'clock', title: 'Новые видео каждую неделю', text: 'Мы постоянно работаем для вас' },
          { icon: 'heart', title: 'Проект от ARMY для ARMY', text: 'С любовью к BTS и каждому зрителю' },
        ]}
      />
    ),
    socials: () => <SocialLinksBlock items={(settings?.socials ?? []) as any[]} />,
    broadcast: () => (
      <BroadcastBannerBlock
        tagline={textOr((settings as any)?.banner?.tagline, DEFAULT_BANNER_TAGLINE)}
        onAirText={textOr((settings as any)?.banner?.onAirText, DEFAULT_BANNER_ONAIR)}
      />
    ),
  }

  return (
    <main style={{ ...brandVars(settings?.theme, settings?.typography), background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {sections
          .filter((s) => s.enabled)
          .map((s) => <Fragment key={s.type}>{renderers[s.type]()}</Fragment>)}
      </div>
    </main>
  )
}
