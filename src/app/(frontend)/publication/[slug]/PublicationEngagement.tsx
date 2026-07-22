'use client'

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock, Plus, X } from 'lucide-react'
import { toggleReaction, submitComment } from './actions'

/* ============================================================================
   PublicationEngagement — реакции + комментарии под публикацией.
   Клиентский компонент. Данные приходят пропсами из серверной page.tsx,
   запись — напрямую через Server Actions (./actions).

   Реакции публикации: оптимистичное обновление (useOptimistic) — счётчик
   меняется мгновенно, экшен уходит в фон, revalidate приносит правду.
   Комментарии/ответы: вызов экшена + revalidate внутри него (правдивое
   обновление). Ответ — через основную форму сверху с пометкой «Отвечаете…».
   ============================================================================ */

export type ReactionKey = 'like' | 'love' | 'fire' | 'cry'

export const REACTION_EMOJI: Record<ReactionKey, string> = {
  like: '👍',
  love: '❤️',
  fire: '🔥',
  cry: '😢',
}

const REACTION_ORDER: ReactionKey[] = ['like', 'love', 'fire', 'cry']

export type ReactorLite = {
  id: string | number
  name: string
  color?: string | null
}

export type PublicationReaction = {
  key: ReactionKey
  count: number
  reactors: ReactorLite[]
  mine?: boolean
}

export type CommentReaction = {
  key: ReactionKey
  count: number
  mine?: boolean
}

export type CommentNode = {
  id: string | number
  authorName: string
  authorColor?: string | null
  timeLabel: string
  text: string
  reactions: CommentReaction[]
  replies?: CommentNode[]
}

export type PublicationEngagementProps = {
  isAuthed: boolean
  publicationId: string | number
  publicationSlug?: string | null
  reactions: PublicationReaction[]
  comments: CommentNode[]
  commentCount: number
  currentUser?: { name: string; color?: string | null } | null
}

type ReplyTarget = { id: string | number; authorName: string } | null

function initial(name: string): string {
  return (name.trim()[0] || '?').toUpperCase()
}

function Avatar({
  name,
  color,
  size = 36,
}: {
  name: string
  color?: string | null
  size?: number
}) {
  return (
    <div
      className="cm-av"
      style={{
        width: size,
        height: size,
        fontSize: size <= 22 ? 10 : size <= 28 ? 12 : 14,
        background: color || 'var(--brand-primary)',
      }}
      aria-hidden
    >
      {initial(name)}
    </div>
  )
}

function ReactionPill({
  r,
  isAuthed,
  openPop,
  setOpenPop,
  onToggle,
}: {
  r: PublicationReaction
  isAuthed: boolean
  openPop: ReactionKey | null
  setOpenPop: (k: ReactionKey | null) => void
  onToggle: (k: ReactionKey) => void
}) {
  const open = openPop === r.key
  const wrapRef = useRef<HTMLDivElement>(null)
  // Сторона раскрытия поповера. По умолчанию влево (right:0); если пилюля в левой
  // половине экрана — раскрываем вправо (left:0), иначе поповер уезжает за левый
  // край на мобиле. Считаем в момент клика по положению пилюли — до отрисовки
  // поповера, поэтому без мигания.
  const [popAlign, setPopAlign] = useState<'right' | 'left'>('right')
  return (
    <div className="rx-pop-wrap" ref={wrapRef}>
      <div className={`rx-pill${r.mine ? ' is-active' : ''}`}>
        <button
          type="button"
          className="rx-main"
          onClick={() => isAuthed && onToggle(r.key)}
          aria-pressed={r.mine}
          disabled={!isAuthed}
        >
          <span className="rx-emo">{REACTION_EMOJI[r.key]}</span>
          <span>{r.count}</span>
        </button>
        <button
          type="button"
          className="rx-caret"
          aria-label="Кто поставил реакцию"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
            if (open) {
              setOpenPop(null)
              return
            }
            const rect = wrapRef.current?.getBoundingClientRect()
            if (rect && typeof window !== 'undefined') {
              const center = rect.left + rect.width / 2
              setPopAlign(center < window.innerWidth / 2 ? 'left' : 'right')
            }
            setOpenPop(r.key)
          }}
        >
          ▾
        </button>
      </div>

      {open && (
        <div className={`rx-pop${popAlign === 'left' ? ' rx-pop--left' : ''}`} role="dialog">
          <div className="rx-pop__head">
            {REACTION_EMOJI[r.key]} {r.reactors.length}
          </div>
          {r.reactors.length === 0 && (
            <div className="rx-pop__name" style={{ padding: '5px 6px', opacity: 0.6 }}>
              Пока никто
            </div>
          )}
          {r.reactors.map((u) => (
            <div className="rx-pop__row" key={u.id}>
              <Avatar name={u.name} color={u.color} size={22} />
              <span className="rx-pop__name">{u.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CommentActions({
  node,
  isAuthed,
  isReply,
  onToggleCommentReaction,
  onReply,
}: {
  node: CommentNode
  isAuthed: boolean
  isReply: boolean
  onToggleCommentReaction: (id: string | number, key: ReactionKey) => void
  onReply: (node: CommentNode) => void
}) {
  // Пикер эмодзи для кнопки «+»: раскрывается по клику, выбор эмодзи ставит
  // соответствующую реакцию на комментарий. Закрывается по клику вне.
  const [pickOpen, setPickOpen] = useState(false)
  const pickRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!pickRef.current?.contains(e.target as Node)) setPickOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [pickOpen])

  return (
    <div className="cm-actions">
      {node.reactions.map((cr) => (
        <button
          type="button"
          key={cr.key}
          className={`cm-rx${cr.mine ? ' is-active' : ''}`}
          onClick={() => isAuthed && onToggleCommentReaction(node.id, cr.key)}
          disabled={!isAuthed}
        >
          <span>{REACTION_EMOJI[cr.key]}</span>
          <span>{cr.count}</span>
        </button>
      ))}
      {isAuthed && (
        <div className="cm-rx-pick-wrap" ref={pickRef}>
          <button
            type="button"
            className="cm-rx cm-rx--add"
            title="Добавить реакцию"
            aria-label="Добавить реакцию"
            aria-expanded={pickOpen}
            onClick={(e) => {
              e.stopPropagation()
              setPickOpen((o) => !o)
            }}
          >
            <Plus size={14} />
          </button>
          {pickOpen && (
            <div className="cm-rx-pick" role="menu">
              {REACTION_ORDER.map((k) => (
                <button
                  type="button"
                  key={k}
                  className="cm-rx-pick__opt"
                  title={`Реакция ${REACTION_EMOJI[k]}`}
                  aria-label={`Реакция ${REACTION_EMOJI[k]}`}
                  onClick={() => {
                    onToggleCommentReaction(node.id, k)
                    setPickOpen(false)
                  }}
                >
                  {REACTION_EMOJI[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!isReply && isAuthed && <span className="cm-sep">·</span>}
      {!isReply && isAuthed && (
        <button type="button" className="cm-reply" onClick={() => onReply(node)}>
          Ответить
        </button>
      )}
    </div>
  )
}

function Comment({
  node,
  isAuthed,
  isReply,
  onToggleCommentReaction,
  onReply,
}: {
  node: CommentNode
  isAuthed: boolean
  isReply: boolean
  onToggleCommentReaction: (id: string | number, key: ReactionKey) => void
  onReply: (node: CommentNode) => void
}) {
  const replies = !isReply ? node.replies ?? [] : []
  return (
    <div className="cm-item">
      <Avatar name={node.authorName} color={node.authorColor} size={isReply ? 28 : 36} />
      <div className="cm-body">
        <div className="cm-meta">
          <span className="cm-name">{node.authorName}</span>
          <span className="cm-when">{node.timeLabel}</span>
        </div>
        <div className="cm-text">{node.text}</div>
        <CommentActions
          node={node}
          isAuthed={isAuthed}
          isReply={isReply}
          onToggleCommentReaction={onToggleCommentReaction}
          onReply={onReply}
        />
        {replies.length > 0 && (
          <div className="cm-replies">
            {replies.map((rc) => (
              <Comment
                key={rc.id}
                node={rc}
                isAuthed={isAuthed}
                isReply
                onToggleCommentReaction={onToggleCommentReaction}
                onReply={onReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type OptimisticAction = { key: ReactionKey }

function reactionsReducer(
  state: PublicationReaction[],
  action: OptimisticAction,
): PublicationReaction[] {
  return state.map((r) => {
    if (r.key !== action.key) {
      if (r.mine) return { ...r, mine: false, count: Math.max(0, r.count - 1) }
      return r
    }
    if (r.mine) return { ...r, mine: false, count: Math.max(0, r.count - 1) }
    return { ...r, mine: true, count: r.count + 1 }
  })
}

type CommentOptimisticAction = { id: string | number; key: ReactionKey }

/**
 * Тумблер реакции в списке реакций одного комментария. Семантика как у поста —
 * «одна реакция на пользователя»: выбор нового эмодзи снимает предыдущий.
 * В отличие от поста, список содержит только НЕнулевые реакции, поэтому:
 *  - новый ключ добавляем записью;
 *  - при обнулении счётчика пилюлю убираем (filter count > 0).
 * Порядок пилюль держим по REACTION_ORDER.
 */
function toggleCommentReactions(list: CommentReaction[], key: ReactionKey): CommentReaction[] {
  const mine = list.find((r) => r.mine)

  let next: CommentReaction[]
  if (mine && mine.key === key) {
    // повторный клик по своей реакции — снимаем
    next = list.map((r) =>
      r.key === key ? { ...r, mine: false, count: Math.max(0, r.count - 1) } : r,
    )
  } else {
    // снять прежнюю (если была другая) и поставить новую
    next = list.map((r) =>
      r.mine ? { ...r, mine: false, count: Math.max(0, r.count - 1) } : r,
    )
    if (next.some((r) => r.key === key)) {
      next = next.map((r) => (r.key === key ? { ...r, mine: true, count: r.count + 1 } : r))
    } else {
      next = [...next, { key, count: 1, mine: true }]
    }
  }

  return next
    .filter((r) => r.count > 0)
    .sort((a, b) => REACTION_ORDER.indexOf(a.key) - REACTION_ORDER.indexOf(b.key))
}

/** Оптимистичный редьюсер дерева комментариев: находит нужный узел (в т.ч. в
 *  ответах) и тумблерит его реакцию. */
function commentsReducer(
  state: CommentNode[],
  action: CommentOptimisticAction,
): CommentNode[] {
  const walk = (nodes: CommentNode[]): CommentNode[] =>
    nodes.map((n) => {
      if (String(n.id) === String(action.id)) {
        return { ...n, reactions: toggleCommentReactions(n.reactions, action.key) }
      }
      if (n.replies && n.replies.length > 0) {
        return { ...n, replies: walk(n.replies) }
      }
      return n
    })
  return walk(state)
}

export function PublicationEngagement({
  isAuthed,
  publicationId,
  publicationSlug,
  reactions,
  comments,
  commentCount,
  currentUser,
}: PublicationEngagementProps) {
  const [openPop, setOpenPop] = useState<ReactionKey | null>(null)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLTextAreaElement>(null)

  // «Войти» ведёт на /login с возвратом на текущую публикацию.
  // /login прочитает redirect, когда научится (сейчас параметр просто задаётся).
  const pathname = usePathname()
  const loginHref = pathname
    ? `/login?redirect=${encodeURIComponent(pathname)}`
    : '/login'

  const [optimisticReactions, applyOptimistic] = useOptimistic(reactions, reactionsReducer)
  const [optimisticComments, applyCommentOptimistic] = useOptimistic(comments, commentsReducer)

  const ordered = REACTION_ORDER.map((k) =>
    optimisticReactions.find((r) => r.key === k),
  ).filter((r): r is PublicationReaction => Boolean(r))

  useEffect(() => {
    if (!openPop) return
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.rx-pop-wrap')) setOpenPop(null)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [openPop])

  const visibleComments = isAuthed ? optimisticComments : optimisticComments.slice(0, 2)

  function handleToggleReaction(key: ReactionKey) {
    setError(null)
    startTransition(async () => {
      applyOptimistic({ key })
      const res = await toggleReaction({
        targetType: 'publication',
        targetId: publicationId,
        emoji: key,
        publicationSlug,
      })
      if (!res.ok) setError(res.error)
    })
  }

  function handleToggleCommentReaction(commentId: string | number, key: ReactionKey) {
    setError(null)
    startTransition(async () => {
      applyCommentOptimistic({ id: commentId, key })
      const res = await toggleReaction({
        targetType: 'comment',
        targetId: commentId,
        emoji: key,
        publicationSlug,
      })
      if (!res.ok) setError(res.error)
    })
  }

  function handleReply(node: CommentNode) {
    setReplyTo({ id: node.id, authorName: node.authorName })
    setError(null)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    formRef.current?.focus({ preventScroll: reduce })
    if (!reduce) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleSubmit() {
    const text = draft.trim()
    if (!text) return
    setError(null)
    startTransition(async () => {
      const res = await submitComment({
        publicationId,
        text,
        parentId: replyTo?.id ?? null,
        publicationSlug,
      })
      if (res.ok) {
        setDraft('')
        setReplyTo(null)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <section className="engage" aria-label="Реакции и комментарии">
      <div className="rx-block">
        <div className="engage__label">Реакции</div>
        <div className="rx-row">
          {ordered.map((r) => (
            <ReactionPill
              key={r.key}
              r={r}
              isAuthed={isAuthed}
              openPop={openPop}
              setOpenPop={setOpenPop}
              onToggle={handleToggleReaction}
            />
          ))}
        </div>
        {!isAuthed && <div className="rx-hint">Войдите, чтобы поставить реакцию</div>}
      </div>

      <div className="cm-head">
        <span className="cm-title">Комментарии</span>
        <span className="cm-count">· {commentCount}</span>
      </div>

      {isAuthed && (
        <div className="cm-form">
          <Avatar name={currentUser?.name ?? 'Вы'} color={currentUser?.color} size={36} />
          <div className="cm-form__field">
            {replyTo && (
              <div className="cm-replying">
                Отвечаете <b>{replyTo.authorName}</b>
                <button
                  type="button"
                  className="cm-replying__cancel"
                  aria-label="Отменить ответ"
                  onClick={() => setReplyTo(null)}
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <textarea
              ref={formRef}
              className="cm-input"
              placeholder={replyTo ? 'Ваш ответ…' : 'Поделитесь впечатлением…'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              disabled={isPending}
            />
            {error && <div className="cm-error">{error}</div>}
            {draft.trim() && (
              <button
                type="button"
                className="cm-submit"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending ? 'Отправка…' : replyTo ? 'Ответить' : 'Отправить'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`cm-gate-wrap${isAuthed ? '' : ' is-locked'}`}>
        <div className="cm-list">
          {visibleComments.map((c) => (
            <Comment
              key={c.id}
              node={c}
              isAuthed={isAuthed}
              isReply={false}
              onToggleCommentReaction={handleToggleCommentReaction}
              onReply={handleReply}
            />
          ))}
          {isAuthed && visibleComments.length === 0 && (
            <div className="cm-empty">Пока нет комментариев. Будьте первым!</div>
          )}
        </div>

        {!isAuthed && (
          <div className="cm-gate">
            <div className="cm-gate__card">
              <div className="cm-gate__icon">
                <Lock size={20} />
              </div>
              <div className="cm-gate__title">Здесь обсуждают ARMY</div>
              <div className="cm-gate__sub">
                Войдите или зарегистрируйтесь, чтобы читать комментарии и оставлять свои.
              </div>
              <Link href={loginHref} className="cm-gate__btn">
                Войти
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
