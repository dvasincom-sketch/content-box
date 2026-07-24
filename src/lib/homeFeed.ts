import { getPayload } from 'payload'
import config from '@/payload.config'
import { getPublicationCardStats } from '@/lib/publicationCardStats'
import { categoryHref } from '@/lib/categoryHref'
import type { PublicationCard } from '@/blocks/LatestPublicationsBlock'
import type { Publication, Category } from '@/payload-types'

/**
 * Данные секций главной. Все наборы публикаций — с исключением дублей
 * «сверху вниз»: что показано в верхней секции, не повторяется в нижних.
 *
 * Секции:
 *  - news       — публикации с признаком isNews (свежие)
 *  - latest     — последние по дате (минус показанное)
 *  - popular    — «сейчас популярно»: реакции+комменты за POPULAR_WINDOW_DAYS
 *  - discussed  — «обсуждаемое»: по числу комментов за всё время
 *  - popularCategories — категории по суммарной активности их публикаций,
 *                        исключая переданные ручные (manualCategoryIds)
 *  - posterRows — киноряды: категории-контейнеры (posterLayout) → ряд АФИШ
 *                 их дочерних категорий (обложка категории, ссылка в раздел)
 *
 * Замечание по масштабу: агрегации считаются в JS (Payload не сортирует по
 * count). На текущих объёмах дёшево; при росте — кандидат на SQL-агрегацию.
 */

const SECTION_SIZE = 8
const POPULAR_WINDOW_DAYS = 3

export type CategoryCard = {
  id: string | number
  title: string
  href: string
  cover?: { url?: string | null; alt?: string | null } | string | number | null
  activity: number
}

export type PosterItem = {
  id: string | number
  href: string
  title: string
  posterUrl: string | null
}

export type PosterRowData = {
  id: string | number
  title: string
  href: string
  items: PosterItem[]
}

export type HomeFeed = {
  news: PublicationCard[]
  latest: PublicationCard[]
  popular: PublicationCard[]
  discussed: PublicationCard[]
  popularCategories: CategoryCard[]
  posterRows: PosterRowData[]
}

function relId(val: number | { id?: string | number } | null | undefined): string | number | null {
  if (val == null) return null
  return typeof val === 'object' ? (val.id ?? null) : val
}

// Публикация → карточка (общая форма для всех секций).
function toCard(p: Publication, stats?: { comments: number; reactions: number }): PublicationCard {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    publishedAt: p.publishedAt,
    minTierName:
      p.minTier && typeof p.minTier === 'object'
        ? p.minTier.name || p.minTier.slug || null
        : null,
    cover: p.cover,
    commentCount: stats?.comments ?? 0,
    reactionCount: stats?.reactions ?? 0,
    hasVideo: Array.isArray(p.relatedVideos) && p.relatedVideos.length > 0,
    hasGallery: Array.isArray(p.gallery) && p.gallery.length > 0,
  }
}

export async function getHomeFeed(
  tenantId: string | number,
  manualCategoryIds: Array<string | number> = [],
): Promise<HomeFeed> {
  const empty: HomeFeed = {
    news: [],
    latest: [],
    popular: [],
    discussed: [],
    popularCategories: [],
    posterRows: [],
  }

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const shown = new Set<string>() // id уже показанных публикаций (дубли сверху вниз)
    const takeNew = (docs: Publication[], n: number): Publication[] => {
      const out: Publication[] = []
      for (const d of docs) {
        const id = String(d.id)
        if (shown.has(id)) continue
        out.push(d)
        shown.add(id)
        if (out.length >= n) break
      }
      return out
    }

    // Хелпер для статистики набора → карточки.
    const cardsFor = async (docs: Publication[]): Promise<PublicationCard[]> => {
      if (docs.length === 0) return []
      const stats = await getPublicationCardStats(
        docs.map((d) => d.id),
        tenantId,
      )
      return docs.map((d) => toCard(d, stats.get(String(d.id))))
    }

    // ── 1. Новости (isNews), свежие ──
    const newsRes = await payload.find({
      collection: 'publications',
      where: {
        and: [{ tenant: { equals: tenantId } }, { isNews: { equals: true } }],
      },
      sort: '-publishedAt',
      depth: 1,
      limit: SECTION_SIZE,
      overrideAccess: true,
    })
    const newsDocs = takeNew(newsRes.docs, SECTION_SIZE)

    // ── 2. Последние (минус показанное) ──
    // Берём с запасом, чтобы после исключения дублей осталось до SECTION_SIZE.
    const latestRes = await payload.find({
      collection: 'publications',
      where: { tenant: { equals: tenantId } },
      sort: '-publishedAt',
      depth: 1,
      limit: SECTION_SIZE * 2,
      overrideAccess: true,
    })
    const latestDocs = takeNew(latestRes.docs, SECTION_SIZE)

    // ── 3. Сейчас популярно: реакции+комменты за окно, топ по сумме ──
    const since = new Date(
      Date.now() - POPULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()
    const activity = new Map<string, number>() // pubId → счёт активности за окно

    const recentReactions = await payload.find({
      collection: 'reactions',
      where: {
        and: [
          { targetType: { equals: 'publication' } },
          { tenant: { equals: tenantId } },
          { createdAt: { greater_than: since } },
        ],
      },
      depth: 0,
      limit: 20000,
      overrideAccess: true,
    })
    for (const r of recentReactions.docs) {
      const pid = String(relId(r.publication))
      if (pid !== 'null') activity.set(pid, (activity.get(pid) ?? 0) + 1)
    }

    const recentComments = await payload.find({
      collection: 'comments',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { status: { equals: 'published' } },
          { createdAt: { greater_than: since } },
        ],
      },
      depth: 0,
      limit: 20000,
      overrideAccess: true,
    })
    for (const c of recentComments.docs) {
      const pid = String(relId(c.publication))
      if (pid !== 'null') activity.set(pid, (activity.get(pid) ?? 0) + 1)
    }

    // Топ id по активности, исключая показанное, добираем реальные документы.
    const popularIds = [...activity.entries()]
      .filter(([id]) => !shown.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, SECTION_SIZE)
      .map(([id]) => id)

    let popularDocs: Publication[] = []
    if (popularIds.length > 0) {
      const popRes = await payload.find({
        collection: 'publications',
        where: {
          and: [{ tenant: { equals: tenantId } }, { id: { in: popularIds } }],
        },
        depth: 1,
        limit: SECTION_SIZE,
        overrideAccess: true,
      })
      // сохранить порядок по активности
      const byId = new Map(popRes.docs.map((d) => [String(d.id), d]))
      popularDocs = popularIds
        .map((id) => byId.get(id))
        .filter((d): d is Publication => Boolean(d))
      popularDocs.forEach((d) => shown.add(String(d.id)))
    }

    // ── 4. Обсуждаемое: топ по числу комментов за всё время ──
    const allComments = await payload.find({
      collection: 'comments',
      where: {
        and: [{ tenant: { equals: tenantId } }, { status: { equals: 'published' } }],
      },
      depth: 0,
      limit: 50000,
      overrideAccess: true,
    })
    const commentCounts = new Map<string, number>()
    for (const c of allComments.docs) {
      const pid = String(relId(c.publication))
      if (pid !== 'null') commentCounts.set(pid, (commentCounts.get(pid) ?? 0) + 1)
    }
    const discussedIds = [...commentCounts.entries()]
      .filter(([id]) => !shown.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, SECTION_SIZE)
      .map(([id]) => id)

    let discussedDocs: Publication[] = []
    if (discussedIds.length > 0) {
      const dRes = await payload.find({
        collection: 'publications',
        where: {
          and: [{ tenant: { equals: tenantId } }, { id: { in: discussedIds } }],
        },
        depth: 1,
        limit: SECTION_SIZE,
        overrideAccess: true,
      })
      const byId = new Map(dRes.docs.map((d) => [String(d.id), d]))
      discussedDocs = discussedIds
        .map((id) => byId.get(id))
        .filter((d): d is Publication => Boolean(d))
      discussedDocs.forEach((d) => shown.add(String(d.id)))
    }

    // ── 5. Категории по активности (для «Популярных разделов») ──
    // Активность категории = сумма активности за окно её публикаций.
    // Публикацию → категорию берём из latest/popular/discussed/news, но чтобы
    // покрыть больше, дособерём категории из всех публикаций с активностью.
    const manualSet = new Set(manualCategoryIds.map((x) => String(x)))
    const catActivity = new Map<string, number>()

    // Нужны категории публикаций, у которых есть активность за окно.
    const activePubIds = [...activity.keys()]
    if (activePubIds.length > 0) {
      const actPubsRes = await payload.find({
        collection: 'publications',
        where: {
          and: [{ tenant: { equals: tenantId } }, { id: { in: activePubIds } }],
        },
        depth: 1,
        limit: 1000,
        overrideAccess: true,
      })
      for (const p of actPubsRes.docs) {
        const catId = relId(p.category)
        if (catId == null) continue
        const key = String(catId)
        if (manualSet.has(key)) continue // не дублируем ручные
        const add = activity.get(String(p.id)) ?? 0
        catActivity.set(key, (catActivity.get(key) ?? 0) + add)
      }
    }

    const topCatIds = [...catActivity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SECTION_SIZE)
      .map(([id]) => id)

    let popularCategories: CategoryCard[] = []
    if (topCatIds.length > 0) {
      const catsRes = await payload.find({
        collection: 'categories',
        where: {
          and: [{ tenant: { equals: tenantId } }, { id: { in: topCatIds } }],
        },
        depth: 1,
        limit: SECTION_SIZE,
        overrideAccess: true,
      })
      const byId = new Map(catsRes.docs.map((c) => [String(c.id), c]))
      popularCategories = topCatIds
        .map((id) => {
          const c = byId.get(id)
          if (!c) return null
          const crumbs = c.breadcrumbs ?? []
          const href = crumbs.length
            ? `/category${crumbs[crumbs.length - 1].url ?? ''}`
            : `/category/${c.slug}`
          return {
            id: c.id,
            title: c.title,
            href,
            cover: c.cover,
            activity: catActivity.get(id) ?? 0,
          } as CategoryCard
        })
        .filter((c): c is CategoryCard => Boolean(c))
    }

    // ── 6. Киноряды: категории-контейнеры (posterLayout) → ряд АФИШ детей ──
    // Новая модель: постер = обложка ДОЧЕРНЕЙ категории (афиша фильма/сериала),
    // клик по афише ведёт в саму дочернюю категорию, а не в публикацию. Ряд
    // группируется по родителю-контейнеру: заголовок = контейнер, элементы =
    // его прямые дети. Дёшево по памяти: 1 запрос контейнеров + по 1 запросу
    // детей на контейнер (обычно единицы контейнеров).
    const containerRes = await payload.find({
      collection: 'categories',
      where: {
        and: [{ tenant: { equals: tenantId } }, { posterLayout: { equals: true } }],
      },
      sort: 'order',
      depth: 0, // нужны только id/title/slug/breadcrumbs (breadcrumbs — хранимое поле)
      limit: 50,
      overrideAccess: true,
    })
    const containers = containerRes.docs

    const posterRows: PosterRowData[] = []
    for (const container of containers) {
      // Прямые дочерние категории контейнера = афиши. depth:1 — нужен cover.
      const childrenRes = await payload.find({
        collection: 'categories',
        where: {
          and: [{ tenant: { equals: tenantId } }, { parent: { equals: container.id } }],
        },
        sort: 'order',
        depth: 1,
        limit: 100,
        overrideAccess: true,
      })

      const items: PosterItem[] = childrenRes.docs.map((c) => {
        const cover = c.cover && typeof c.cover === 'object' ? c.cover : null
        const posterUrl = cover?.sizes?.poster?.url || cover?.url || null
        return { id: c.id, href: categoryHref(c), title: c.title, posterUrl }
      })

      if (items.length === 0) continue // контейнер без детей не показываем

      posterRows.push({
        id: container.id,
        title: container.title,
        href: categoryHref(container),
        items,
      })
    }

    // ── Собираем карточки со статистикой ──
    const [news, latest, popular, discussed] = await Promise.all([
      cardsFor(newsDocs),
      cardsFor(latestDocs),
      cardsFor(popularDocs),
      cardsFor(discussedDocs),
    ])

    return { news, latest, popular, discussed, popularCategories, posterRows }
  } catch {
    return empty
  }
}
