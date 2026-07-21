'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Lock, Plus } from 'lucide-react'

/* ============================================================================
   PublicationEngagement — реакции + комментарии под публикацией.
   Клиентский компонент (интерактив: реакции, поповер «кто», ветки, форма).
   Данные и флаг входа приходят ПРОПСАМИ из серверной page.tsx.
   Пока моки — при подключении бэкенда меняются только пропсы + колбэки,
   сама разметка/логика остаётся.
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
  /** цвет аватара-инициала (пока из мока; позже — из subscriber) */
  color?: string | null
}

export type PublicationReaction = {
  key: ReactionKey
  count: number
  /** кто поставил — для поповера (может быть усечён на бэке) */
  reactors: ReactorLite[]
  /** поставил ли текущий пользователь эту реакцию */
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
  /** ответы — ровно один уровень вложенности */
  replies?: CommentNode[]
}

export type PublicationEngagementProps = {
  isAuthed: boolean
  reactions: PublicationReaction[]
  comments: CommentNode[]
  commentCount: number
  /** куда ведёт кнопка входа/подписки */
  loginHref?: string
  /** имя/цвет текущего пользователя для формы (если вошёл) */
  currentUser?: { name: string; color?: string | null } | null
  /* Колбэки — заглушки на этапе моков; подключатся к серверным экшенам позже. */
  onToggleReaction?: (key: ReactionKey) => void
  onToggleCommentReaction?: (commentId: string | number, key: ReactionKey) => void
  onReply?: (commentId: string | number) => void
  onSubmitComment?: (text: string) => void
}

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

/* ── Реакция публикации: пилюля + стрелка-поповер «кто поставил» ── */
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
  onToggle?: (k: ReactionKey) => void
}) {
  const open = openPop === r.key
  return (
    <div className="rx-pop-wrap">
      <div className={`rx-pill${r.mine ? ' is-active' : ''}`}>
        <button
          type="button"
          className="rx-main"
          onClick={() => isAuthed && onToggle?.(r.key)}
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
            setOpenPop(open ? null : r.key)
          }}
        >
          ▾
        </button>
      </div>

      {open && (
        <div className="rx-pop" role="dialog">
          <div className="rx-pop__head">
            {REACTION_EMOJI[r.key]} {r.reactors.length}
          </div>
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

/* ── Панель действий под комментарием: реакции + добавить + ответить ── */
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
  onToggleCommentReaction?: (id: string | number, key: ReactionKey) => void
  onReply?: (id: string | number) => void
}) {
  return (
    <div className="cm-actions">
      {node.reactions.map((cr) => (
        <button
          type="button"
          key={cr.key}
          className={`cm-rx${cr.mine ? ' is-active' : ''}`}
          onClick={() => isAuthed && onToggleCommentReaction?.(node.id, cr.key)}
          disabled={!isAuthed}
        >
          <span>{REACTION_EMOJI[cr.key]}</span>
          <span>{cr.count}</span>
        </button>
      ))}
      {isAuthed && (
        <button
          type="button"
          className="cm-rx cm-rx--add"
          title="Добавить реакцию"
          aria-label="Добавить реакцию"
          onClick={() => onToggleCommentReaction?.(node.id, 'like')}
        >
          <Plus size={14} />
        </button>
      )}
      {!isReply && isAuthed && <span className="cm-sep">·</span>}
      {!isReply && (
        <button type="button" className="cm-reply" onClick={() => onReply?.(node.id)}>
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
  onToggleCommentReaction?: (id: string | number, key: ReactionKey) => void
  onReply?: (id: string | number) => void
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

export function PublicationEngagement({
  isAuthed,
  reactions,
  comments,
  commentCount,
  loginHref = '/subscribe',
  currentUser,
  onToggleReaction,
  onToggleCommentReaction,
  onReply,
  onSubmitComment,
}: PublicationEngagementProps) {
  const [openPop, setOpenPop] = useState<ReactionKey | null>(null)
  const [draft, setDraft] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  // упорядочиваем реакции стабильно (like, love, fire, cry)
  const ordered = REACTION_ORDER.map((k) => reactions.find((r) => r.key === k)).filter(
    (r): r is PublicationReaction => Boolean(r),
  )

  // клик вне поповера — закрыть
  useEffect(() => {
    if (!openPop) return
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.rx-pop-wrap')) setOpenPop(null)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [openPop])

  const visibleComments = isAuthed ? comments : comments.slice(0, 2)

  return (
    <section ref={rootRef} className="engage" aria-label="Реакции и комментарии">
      {/* ── РЕАКЦИИ (видны всем — тизер) ── */}
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
              onToggle={onToggleReaction}
            />
          ))}
        </div>
        {!isAuthed && <div className="rx-hint">Войдите, чтобы поставить реакцию</div>}
      </div>

      {/* ── КОММЕНТАРИИ ── */}
      <div className="cm-head">
        <span className="cm-title">Комментарии</span>
        <span className="cm-count">· {commentCount}</span>
      </div>

      {isAuthed && (
        <div className="cm-form">
          <Avatar name={currentUser?.name ?? 'Вы'} color={currentUser?.color} size={36} />
          <div className="cm-form__field">
            <textarea
              className="cm-input"
              placeholder="Поделитесь впечатлением…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
            />
            {draft.trim() && (
              <button
                type="button"
                className="cm-submit"
                onClick={() => {
                  onSubmitComment?.(draft.trim())
                  setDraft('')
                }}
              >
                Отправить
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
              onToggleCommentReaction={onToggleCommentReaction}
              onReply={onReply}
            />
          ))}
        </div>

        {!isAuthed && (
          <div className="cm-gate">
            <div className="cm-gate__card">
              <div className="cm-gate__icon">
                <Lock size={20} />
              </div>
              <div className="cm-gate__title">Здесь обсуждают ARMY</div>
              <div className="cm-gate__sub">
                Комментарии доступны подписчикам. Войдите, чтобы читать и оставлять свои.
              </div>
              <Link href={loginHref} className="cm-gate__btn">
                Войти или подписаться
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
