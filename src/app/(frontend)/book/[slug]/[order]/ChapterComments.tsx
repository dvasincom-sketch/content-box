'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, CornerDownRight, EyeOff, Loader2, Send } from 'lucide-react'
import { submitChapterComment, hideChapterComment } from './comment-actions'

export type CommentNode = { id: number | string; authorName: string; text: string; date: string; own: boolean; replies: CommentNode[] }

/** Комментарии к главе: список (один уровень веток) + форма. Логин обязателен
 *  для отправки; модерация (скрыть) — уровню «Знаток»+ (canModerate). */
export function ChapterComments({
  chapterId, slug, order, comments, canComment, canModerate, total,
}: {
  chapterId: number | string
  slug: string
  order: number | string
  comments: CommentNode[]
  canComment: boolean
  canModerate: boolean
  total: number
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<number | string | null>(null)

  async function send(parentId: number | string | null, value: string, clear: () => void) {
    if (!value.trim()) return
    setBusy(true); setError(null)
    const r = await submitChapterComment({ chapterId, text: value, parentId, slug, order })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    clear(); setReplyTo(null); router.refresh()
  }

  async function hide(id: number | string) {
    if (!confirm('Скрыть этот комментарий?')) return
    const r = await hideChapterComment({ commentId: id, slug, order })
    if (r.ok) router.refresh(); else alert(r.error)
  }

  return (
    <section style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid color-mix(in srgb, var(--brand-text) 10%, transparent)' }}>
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--brand-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageCircle size={20} /> Комментарии <span style={{ color: 'var(--brand-muted)', fontWeight: 400 }}>{total}</span>
      </h2>

      {canComment ? (
        <div style={{ marginBottom: 20 }}>
          <textarea
            className="w-full rounded-xl p-3" rows={3} placeholder="Оставить комментарий…"
            style={{ background: 'var(--brand-surface)', border: '1px solid color-mix(in srgb, var(--brand-text) 12%, transparent)', color: 'var(--brand-text)', resize: 'vertical' }}
            value={text} onChange={(e) => setText(e.target.value)}
          />
          {error && !replyTo && <div style={{ color: '#e5484d', fontSize: 13, marginTop: 6 }}>{error}</div>}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => send(null, text, () => setText(''))} disabled={busy || !text.trim()}
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl"
              style={{ background: 'var(--brand-primary)', color: '#fff', opacity: busy || !text.trim() ? 0.6 : 1 }}>
              {busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Отправить
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: 'var(--brand-muted)', marginBottom: 20 }}>Войдите, чтобы комментировать.</p>
      )}

      {comments.length === 0 ? (
        <p style={{ color: 'var(--brand-muted)' }}>Пока нет комментариев. Будьте первым.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {comments.map((c) => (
            <div key={c.id}>
              <CommentView c={c} canComment={canComment} canModerate={canModerate} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} onHide={() => hide(c.id)} />
              {replyTo === c.id && canComment && (
                <ReplyForm busy={busy} error={error} onSend={(v, clear) => send(c.id, v, clear)} />
              )}
              {c.replies.length > 0 && (
                <div style={{ marginLeft: 28, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '2px solid color-mix(in srgb, var(--brand-text) 8%, transparent)', paddingLeft: 12 }}>
                  {c.replies.map((r) => (
                    <CommentView key={r.id} c={r} canComment={false} canModerate={canModerate} onHide={() => hide(r.id)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CommentView({ c, canComment, canModerate, onReply, onHide }: { c: CommentNode; canComment: boolean; canModerate: boolean; onReply?: () => void; onHide?: () => void }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--brand-surface)', border: '1px solid color-mix(in srgb, var(--brand-text) 8%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: 'var(--brand-text)' }}>{c.authorName}</span>
        <span style={{ color: 'var(--brand-muted)' }}>{c.date}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {canComment && onReply && (
            <button onClick={onReply} style={{ color: 'var(--brand-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 0, cursor: 'pointer', fontSize: 12 }}><CornerDownRight size={13} /> Ответить</button>
          )}
          {canModerate && !c.own && onHide && (
            <button onClick={onHide} title="Скрыть" style={{ color: 'var(--brand-muted)', background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><EyeOff size={13} /></button>
          )}
        </div>
      </div>
      <div style={{ color: 'var(--brand-text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{c.text}</div>
    </div>
  )
}

function ReplyForm({ busy, error, onSend }: { busy: boolean; error: string | null; onSend: (v: string, clear: () => void) => void }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ marginLeft: 28, marginTop: 10 }}>
      <textarea className="w-full rounded-xl p-3" rows={2} placeholder="Ваш ответ…"
        style={{ background: 'var(--brand-surface)', border: '1px solid color-mix(in srgb, var(--brand-text) 12%, transparent)', color: 'var(--brand-text)', resize: 'vertical' }}
        value={val} onChange={(e) => setVal(e.target.value)} />
      {error && <div style={{ color: '#e5484d', fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ marginTop: 6 }}>
        <button onClick={() => onSend(val, () => setVal(''))} disabled={busy || !val.trim()}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ background: 'var(--brand-primary)', color: '#fff', opacity: busy || !val.trim() ? 0.6 : 1 }}>
          {busy ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Ответить
        </button>
      </div>
    </div>
  )
}
