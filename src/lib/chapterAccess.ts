import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { tierWeight } from '@/lib/tierWeight'

/**
 * Доступ подписчика к главе книги. Глава бесплатна, если выполнено ХОТЯ БЫ ОДНО:
 *  1) chapter.isPreview — глава помечена бесплатной;
 *  2) order <= book.freeChapters — входит в первые бесплатные главы книги;
 *  3) нет эффективного minTier (ни у главы, ни у книги).
 * Иначе — по подписке: weight(active) >= weight(minTier), где minTier =
 * chapter.minTier ?? book.minTier.
 *
 * Тенант обязателен: поиск строго в его пределах.
 */

export type ChapterAccessResult =
  | { allowed: true; chapter: any; book: any; subscriber: any | null }
  | {
      allowed: false
      reason: 'not-found' | 'need-login' | 'need-subscription' | 'expired' | 'blocked'
      chapter?: any
      book?: any
      requiredTierName?: string | null
    }

export async function checkChapterAccess(input: {
  id?: string | number
  tenantId: number | string
}): Promise<ChapterAccessResult> {
  const payload = await getPayload({ config: await config })
  const tenantId = String(input.tenantId)
  if (!tenantId || input.id == null) return { allowed: false, reason: 'not-found' }

  let chapter: any = null
  try {
    const found = await payload.findByID({ collection: 'chapters' as any, id: input.id, depth: 2, overrideAccess: true })
    chapter = relId((found as any)?.tenant) === tenantId ? found : null
  } catch {
    chapter = null
  }
  if (!chapter) return { allowed: false, reason: 'not-found' }

  const book = chapter.book && typeof chapter.book === 'object' ? chapter.book : null
  // Книга должна быть того же тенанта.
  if (book && relId(book.tenant) !== tenantId) return { allowed: false, reason: 'not-found' }

  // Эффективный уровень: глава переопределяет книгу.
  const chapterTier = chapter.minTier
  const bookTier = book?.minTier
  const effTier = chapterTier ?? bookTier ?? null
  const effTierId = effTier ? (typeof effTier === 'object' ? effTier.id : effTier) : null

  const freeChapters = Number(book?.freeChapters || 0)
  const order = Number(chapter.order || 0)
  const withinFree = freeChapters > 0 && order > 0 && order <= freeChapters

  if (chapter.isPreview || withinFree || !effTierId) {
    const subscriber = await getCurrentSubscriber(tenantId)
    return { allowed: true, chapter, book, subscriber }
  }

  const subscriber = await getCurrentSubscriber(tenantId)
  const requiredTierName = effTier && typeof effTier === 'object' ? effTier.name || effTier.slug : null

  if (!subscriber) return { allowed: false, reason: 'need-login', chapter, book, requiredTierName }
  if (subscriber.isBlocked) return { allowed: false, reason: 'blocked', chapter, book, requiredTierName }

  const until = subscriber.subscriptionUntil ? new Date(subscriber.subscriptionUntil) : null
  if (!until || until.getTime() <= Date.now()) {
    return { allowed: false, reason: 'expired', chapter, book, requiredTierName }
  }

  const activeTier = subscriber.activeTier
  const activeTierId = activeTier ? (typeof activeTier === 'object' ? activeTier.id : activeTier) : null
  if (!activeTierId) return { allowed: false, reason: 'need-subscription', chapter, book, requiredTierName }

  const [minWeight, activeWeight] = await Promise.all([
    tierWeight(payload, effTierId, tenantId),
    tierWeight(payload, activeTierId, tenantId),
  ])
  if (activeWeight == null || minWeight == null) {
    return { allowed: false, reason: 'need-subscription', chapter, book, requiredTierName }
  }
  if (activeWeight >= minWeight) return { allowed: true, chapter, book, subscriber }

  return { allowed: false, reason: 'need-subscription', chapter, book, requiredTierName }
}

/** id связи, независимо от depth. */
function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'object') {
    const id = (v as { id?: string | number }).id
    return id == null ? null : String(id)
  }
  return String(v)
}
