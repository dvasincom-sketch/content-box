import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getPublicationCardStats } from '@/lib/publicationCardStats'
import { categoryHref } from '@/lib/categoryHref'
import { publishedWhere } from '@/lib/published'
import { sqlRows } from '@/lib/sql'
import { homeFeedTag } from '@/lib/cacheTags'
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
 * Агрегации (popular, discussed, счётчики карточек) считаются в БД через
 * GROUP BY — Payload такого не умеет, поэтому здесь прямой SQL (см. lib/sql.ts).
 * Раньше они делались выгрузкой всех строк в память и подсчётом в JS, что на
 * горячем пути главной разъезжалось линейно по мере роста базы.
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
      p.minTier && typeof p.minTier === 'object' ? p.minTier.name || p.minTier.slug || null : null,
    cover: p.cover,
    commentCount: stats?.comments ?? 0,
    reactionCount: stats?.reactions ?? 0,
    hasVideo: Array.isArray(p.relatedVideos) && p.relatedVideos.length > 0,
    hasGallery: Array.isArray(p.gallery) && p.gallery.length > 0,
  }
}

/**
 * Кэш ленты — ПО ТЕНАНТУ.
 *
 * `export const revalidate = 3600` на самой странице не работал и работать не
 * мог: и layout, и page вызывают `getTenantFromHeaders()` → `headers()`, что
 * переводит рендер в динамический режим. Комментарий там описывал намерение, а
 * не поведение — каждый заход на главную выполнял весь набор запросов заново.
 *
 * Кэшируем не страницу, а ДАННЫЕ: страница остаётся динамической (иначе
 * мультитенантность не работает — один HTML на все домены), но сама лента
 * кэшируется (TTL ниже). Ключ включает tenantId и список ручных категорий, тег —
 * `home:<tenantId>`, поэтому публикация материала, комментарий или правка
 * категории сбрасывают ленту только своего тенанта (см. revalidateHomeFeed).
 */
export async function getHomeFeed(
  tenantId: string | number,
  manualCategoryIds: Array<string | number> = [],
): Promise<HomeFeed> {
  const key = [String(tenantId), manualCategoryIds.map(String).sort().join(',')]
  try {
    return await unstable_cache(
      () => buildHomeFeed(tenantId, manualCategoryIds),
      ['home-feed', ...key],
      { revalidate: HOME_FEED_TTL_SECONDS, tags: [homeFeedTag(tenantId)] },
    )()
  } catch (err) {
    // ВАЖНО, что try/catch снаружи кэша, а не внутри buildHomeFeed.
    // unstable_cache кэширует ЛЮБОЙ успешно зарезолвленный результат, не
    // разбирая, ошибка это или данные. Поэтому если фолбэк на пустую ленту
    // отдавать изнутри, то одна секундная недоступность Postgres в момент
    // cache miss закэширует ПУСТУЮ главную для всех посетителей тенанта на
    // весь TTL, и само оно не починится — тег сбрасывается только на запись
    // контента, а её на тихом тенанте может не быть.
    //
    // Бросая наружу, мы оставляем кэш пустым и просто отдаём деградированный
    // ответ на этот один запрос; следующий попробует снова.
    console.error('[homeFeed] не удалось собрать ленту тенанта', tenantId, err)
    return EMPTY_FEED
  }
}

const EMPTY_FEED: HomeFeed = {
  news: [],
  latest: [],
  popular: [],
  discussed: [],
  popularCategories: [],
  posterRows: [],
}

/**
 * TTL кэша ленты.
 *
 * 5 минут, а не час: отложенная публикация появляется на сайте в момент
 * наступления даты, но никакой ЗАПИСИ в БД при этом не происходит — значит и
 * сброс тега не срабатывает, и материал ждал бы истечения TTL. Час такого
 * ожидания заметен, пять минут — нет. Нагрузку это всё равно снимает: с
 * «каждый заход» до «раз в 5 минут на тенанта».
 */
const HOME_FEED_TTL_SECONDS = 300

async function buildHomeFeed(
  tenantId: string | number,
  manualCategoryIds: Array<string | number> = [],
): Promise<HomeFeed> {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Одна метка времени на весь сбор ленты: иначе секции считались бы по чуть
  // разным «сейчас» и материал на границе мог попасть в одну и пропасть в другой.
  const published = publishedWhere()

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
      and: [
        { tenant: { equals: tenantId } },
        { isNews: { equals: true } },
        { section: { not_equals: 'community' } },
        published,
      ],
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
    where: {
      and: [{ tenant: { equals: tenantId } }, { section: { not_equals: 'community' } }, published],
    },
    sort: '-publishedAt',
    depth: 1,
    limit: SECTION_SIZE * 2,
    overrideAccess: true,
  })
  const latestDocs = takeNew(latestRes.docs, SECTION_SIZE)

  // ── 3. Сейчас популярно: реакции+комменты за окно, топ по сумме ──
  //
  // Один агрегат вместо двух выгрузок по 20 000 строк с подсчётом в JS.
  // GROUP BY отдаёт по строке на публикацию, у которой была активность за
  // окно, — величина того же порядка, что и сама лента, а не размер таблицы.
  const since = new Date(Date.now() - POPULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const activityRows = await sqlRows<{ id: number; n: number }>(
    payload,
    `SELECT publication_id AS id, count(*)::int AS n
       FROM (
         SELECT publication_id
           FROM reactions
          WHERE tenant_id = $1
            AND target_type = 'publication'
            AND publication_id IS NOT NULL
            AND created_at > $2
         UNION ALL
         SELECT publication_id
           FROM comments
          WHERE tenant_id = $1
            AND status = 'published'
            AND publication_id IS NOT NULL
            AND created_at > $2
       ) t
      GROUP BY publication_id`,
    [Number(tenantId), since],
  )

  // pubId → счёт активности за окно
  const activity = new Map<string, number>(
    activityRows.map((r) => [String(r.id), Number(r.n) || 0]),
  )

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
        and: [
          { tenant: { equals: tenantId } },
          { id: { in: popularIds } },
          { section: { not_equals: 'community' } },
          published,
        ],
      },
      depth: 1,
      limit: SECTION_SIZE,
      overrideAccess: true,
    })
    // сохранить порядок по активности
    const byId = new Map(popRes.docs.map((d) => [String(d.id), d]))
    popularDocs = popularIds.map((id) => byId.get(id)).filter((d): d is Publication => Boolean(d))
    popularDocs.forEach((d) => shown.add(String(d.id)))
  }

  // ── 4. Обсуждаемое: топ по числу комментов за всё время ──
  //
  // Здесь была самая тяжёлая выгрузка проекта: `limit: 50000` по ВСЕМ
  // комментариям тенанта за всё время, на каждый рендер главной. Теперь
  // GROUP BY + ORDER BY + LIMIT, а фильтры по разделу и публикации ушли в
  // JOIN — раньше они применялись уже ПОСЛЕ отбора топа, и топ мог целиком
  // состоять из community-постов, оставляя секцию пустой.
  //
  // Берём с запасом (×4), потому что часть верхних позиций уже показана в
  // секциях выше и отсеется по `shown`.
  const discussedRows = await sqlRows<{ id: number; n: number }>(
    payload,
    `SELECT c.publication_id AS id, count(*)::int AS n
       FROM comments c
       JOIN publications p ON p.id = c.publication_id
      WHERE c.tenant_id = $1
        AND c.status = 'published'
        AND c.publication_id IS NOT NULL
        AND p.tenant_id = $1
        AND (p.section IS NULL OR p.section <> 'community')
        AND p.published_at IS NOT NULL
        AND p.published_at <= $2
      GROUP BY c.publication_id
      -- Тайбрейкер обязателен: без него на хвосте распределения (масса
      -- публикаций с 1–2 комментариями) Postgres на границе LIMIT выбирает
      -- произвольное подмножество, и секция «прыгает» между рендерами.
      ORDER BY n DESC, c.publication_id DESC
      LIMIT $3`,
    // Запас считаем от фактически показанного, а не множителем «на глаз»:
    // всё, что уже попало в секции выше, отсеется фильтром по `shown` ниже.
    [Number(tenantId), new Date().toISOString(), shown.size + SECTION_SIZE],
  )
  const discussedIds = discussedRows
    .map((r) => String(r.id))
    .filter((id) => !shown.has(id))
    .slice(0, SECTION_SIZE)

  let discussedDocs: Publication[] = []
  if (discussedIds.length > 0) {
    const dRes = await payload.find({
      collection: 'publications',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { id: { in: discussedIds } },
          { section: { not_equals: 'community' } },
          published,
        ],
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
        and: [{ tenant: { equals: tenantId } }, { id: { in: activePubIds } }, published],
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
}
