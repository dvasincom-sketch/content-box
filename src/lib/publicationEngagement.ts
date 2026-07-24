import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import type { Reaction } from '@/payload-types'
import type {
  PublicationReaction,
  CommentNode,
  CommentReaction,
  ReactionKey,
  ReactorLite,
} from '@/app/(frontend)/publication/[slug]/PublicationEngagement'

/**
 * Данные блока реакций + комментариев для страницы публикации.
 *
 * Серверная выборка (RSC): тянет комментарии и реакции публикации, агрегирует
 * реакции по эмодзи (счётчик, «кто поставил», mine), собирает одноуровневое
 * дерево комментариев и возвращает готовые пропсы для PublicationEngagement.
 *
 * Устойчиво к пустоте: если таблиц/данных нет — вернёт пустые массивы, страница
 * не падает.
 */

const REACTION_KEYS: ReactionKey[] = ['like', 'love', 'fire', 'cry']

// Детерминированный цвет аватара из id (без хранения поля).
// Палитра — в брендовой гамме проекта.
const AVATAR_PALETTE = [
  '#7C3AED',
  '#EC4899',
  '#3C3489',
  '#0EA5E9',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#8B5CF6',
]

export function avatarColor(id: string | number): string {
  const str = String(id)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

type SubscriberLite = { id: string | number; displayName?: string | null } | null

function subName(sub: any): string {
  return (sub?.displayName as string) || 'Аноним'
}

function relID(val: any): string | number | null {
  if (val == null) return null
  return typeof val === 'object' ? (val.id ?? null) : val
}

export type EngagementData = {
  isAuthed: boolean
  currentUser: { name: string; color?: string | null } | null
  reactions: PublicationReaction[]
  comments: CommentNode[]
  commentCount: number
}

export async function getPublicationEngagement(
  publicationId: string | number,
  tenantId: string | number,
): Promise<EngagementData> {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const subscriber = (await getCurrentSubscriber().catch(() => null)) as SubscriberLite
  const meId = subscriber?.id ?? null
  const isAuthed = Boolean(meId)

  const empty: EngagementData = {
    isAuthed,
    currentUser: isAuthed
      ? { name: subName(subscriber), color: avatarColor(meId as string | number) }
      : null,
    reactions: REACTION_KEYS.map((key) => ({ key, count: 0, reactors: [], mine: false })),
    comments: [],
    commentCount: 0,
  }

  try {
    // ── Комментарии публикации (только опубликованные), с авторами ──
    const commentsRes = await payload.find({
      collection: 'comments',
      where: {
        and: [
          { publication: { equals: publicationId } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'published' } },
        ],
      },
      sort: 'createdAt',
      depth: 1, // подтянуть author
      limit: 500,
      overrideAccess: true,
    })
    const commentDocs = commentsRes.docs

    // ── Реакции публикации ──
    const pubReactionsRes = await payload.find({
      collection: 'reactions',
      where: {
        and: [
          { targetType: { equals: 'publication' } },
          { publication: { equals: publicationId } },
          { tenant: { equals: tenantId } },
        ],
      },
      depth: 1, // подтянуть subscriber
      limit: 2000,
      overrideAccess: true,
    })
    const pubReactionDocs = pubReactionsRes.docs

    // ── Реакции на комментарии этой публикации ──
    const commentIds = commentDocs.map((c: any) => c.id)
    let commentReactionDocs: Reaction[] = []
    if (commentIds.length > 0) {
      const cRes = await payload.find({
        collection: 'reactions',
        where: {
          and: [
            { targetType: { equals: 'comment' } },
            { comment: { in: commentIds } },
            { tenant: { equals: tenantId } },
          ],
        },
        depth: 0,
        limit: 5000,
        overrideAccess: true,
      })
      commentReactionDocs = cRes.docs
    }

    // ── Агрегация реакций публикации по эмодзи ──
    const pubReactions: PublicationReaction[] = REACTION_KEYS.map((key) => {
      const forKey = pubReactionDocs.filter((r: any) => r.emoji === key)
      const reactors: ReactorLite[] = forKey.slice(0, 50).map((r: any) => {
        const sub = r.subscriber
        const sid = relID(sub)
        return {
          id: sid ?? Math.random(),
          name: subName(typeof sub === 'object' ? sub : null),
          color: sid != null ? avatarColor(sid) : null,
        }
      })
      const mine = meId != null && forKey.some((r: any) => relID(r.subscriber) === meId)
      return { key, count: forKey.length, reactors, mine }
    })

    // ── Агрегация реакций комментариев: commentId → эмодзи → count/mine ──
    const cReactionMap = new Map<string, Map<ReactionKey, { count: number; mine: boolean }>>()
    for (const r of commentReactionDocs) {
      const cid = String(relID(r.comment))
      const key = r.emoji as ReactionKey
      if (!REACTION_KEYS.includes(key)) continue
      if (!cReactionMap.has(cid)) cReactionMap.set(cid, new Map())
      const inner = cReactionMap.get(cid)!
      const cur = inner.get(key) ?? { count: 0, mine: false }
      cur.count += 1
      if (meId != null && relID(r.subscriber) === meId) cur.mine = true
      inner.set(key, cur)
    }

    function commentReactionsFor(commentId: string | number): CommentReaction[] {
      const inner = cReactionMap.get(String(commentId))
      if (!inner) return []
      return REACTION_KEYS.filter((k) => inner.has(k)).map((k) => {
        const v = inner.get(k)!
        return { key: k, count: v.count, mine: v.mine }
      })
    }

    // ── Сборка одноуровневого дерева ──
    function toNode(doc: any): CommentNode {
      const authorSub = doc.author
      const aid = relID(authorSub)
      return {
        id: doc.id,
        authorName: subName(typeof authorSub === 'object' ? authorSub : null),
        authorColor: aid != null ? avatarColor(aid) : null,
        timeLabel: formatWhen(doc.createdAt),
        text: doc.text ?? '',
        reactions: commentReactionsFor(doc.id),
        replies: [],
      }
    }

    const roots: CommentNode[] = []
    const rootById = new Map<string, CommentNode>()
    for (const doc of commentDocs) {
      if (!doc.parent) {
        const node = toNode(doc)
        roots.push(node)
        rootById.set(String(doc.id), node)
      }
    }
    for (const doc of commentDocs) {
      if (!doc.parent) continue
      const parentId = String(relID(doc.parent))
      const parent = rootById.get(parentId)
      if (parent) {
        parent.replies = parent.replies ?? []
        parent.replies.push(toNode(doc))
      }
      // если родитель не найден (скрыт/удалён) — ответ не показываем
    }

    return {
      isAuthed,
      currentUser: empty.currentUser,
      reactions: pubReactions,
      comments: roots,
      commentCount: commentDocs.length,
    }
  } catch {
    // Таблиц ещё нет (миграция не применена) или иная ошибка выборки —
    // отдаём пустое состояние, страница остаётся рабочей.
    return empty
  }
}

// Относительное время по-русски, компактно.
function formatWhen(iso?: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн назад`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
