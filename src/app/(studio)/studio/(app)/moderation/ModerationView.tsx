'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, X, EyeOff, Eye, Trash2, Ban, ExternalLink } from 'lucide-react'
import { RichText } from '@payloadcms/richtext-lexical/react'

type Item = {
  id: number
  title: string
  body: any
  authorName: string
  authorPaid: boolean
  categoryName: string | null
}

type HistoryItem = {
  id: number
  title: string
  authorName: string
  status: 'approved' | 'rejected'
  section: 'feed' | 'community' | null
  reviewerName: string | null
  reviewedAt: string | null
  rejectReason: string | null
  publicationSlug: string | null
}

type CommentItem = {
  id: number
  text: string
  status: 'published' | 'hidden'
  isReply: boolean
  createdAt: string | null
  authorId: number | null
  authorName: string
  authorPaid: boolean
  authorBanned: boolean
  targetTitle: string | null
  targetHref: string | null
}

/** Дата модерации (МСК, чтобы не ловить рассинхрон серверной таймзоны). */
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  })
}

const SECTION_LABEL: Record<'feed' | 'community', string> = {
  feed: 'Общая лента',
  community: 'Сообщество',
}

/** Очередь модерации: одобрить (выбор раздела; общая лента только платным) / отклонить. */
export function ModerationView({
  items: initial,
  history = [],
  comments: initialComments = [],
}: {
  items: Item[]
  history?: HistoryItem[]
  comments?: CommentItem[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'submissions' | 'comments'>(initialComments.length && !initial.length ? 'comments' : 'submissions')
  const [items, setItems] = useState(initial)
  const [comments, setComments] = useState(initialComments)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [cBusyId, setCBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cAction(url: string, body: any): Promise<boolean> {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error || 'Не удалось'); return false }
      return true
    } catch { setError('Ошибка соединения'); return false }
  }

  async function toggleHideComment(c: CommentItem) {
    setError(null); setCBusyId(c.id)
    const ok = await cAction('/studio/api/comments/hide', { id: c.id, hidden: c.status !== 'hidden' })
    if (ok) setComments((xs) => xs.map((x) => (x.id === c.id ? { ...x, status: x.status === 'hidden' ? 'published' : 'hidden' } : x)))
    setCBusyId(null)
  }

  async function deleteComment(c: CommentItem) {
    if (!window.confirm('Удалить комментарий безвозвратно? Ответы на него тоже удалятся.')) return
    setError(null); setCBusyId(c.id)
    const ok = await cAction('/studio/api/comments/delete', { id: c.id })
    if (ok) setComments((xs) => xs.filter((x) => x.id !== c.id))
    setCBusyId(null)
  }

  async function toggleBanAuthor(c: CommentItem) {
    if (c.authorId == null) return
    setError(null); setCBusyId(c.id)
    const banned = !c.authorBanned
    const ok = await cAction('/studio/api/comments/ban', { subscriber: c.authorId, banned })
    if (ok) setComments((xs) => xs.map((x) => (x.authorId === c.authorId ? { ...x, authorBanned: banned } : x)))
    setCBusyId(null)
  }

  async function approve(item: Item, section: 'feed' | 'community') {
    setError(null)
    setBusyId(item.id)
    try {
      const res = await fetch('/studio/api/submissions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: item.id, section }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json.error || 'Не удалось одобрить')
      else {
        setItems((xs) => xs.filter((x) => x.id !== item.id))
        router.refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(item: Item) {
    const reason = window.prompt('Причина отклонения (необязательно):') ?? ''
    setError(null)
    setBusyId(item.id)
    try {
      const res = await fetch('/studio/api/submissions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: item.id, reason }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json.error || 'Не удалось отклонить')
      else {
        setItems((xs) => xs.filter((x) => x.id !== item.id))
        router.refresh()
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Модерация</h1>
          <div className="studio-page-head__sub">Заявки участников и комментарии зрителей</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button type="button" className={`studio-btn ${tab === 'submissions' ? 'studio-btn--primary' : 'studio-btn--ghost'}`} onClick={() => setTab('submissions')}>
          Публикации{items.length ? ` · ${items.length}` : ''}
        </button>
        <button type="button" className={`studio-btn ${tab === 'comments' ? 'studio-btn--primary' : 'studio-btn--ghost'}`} onClick={() => setTab('comments')}>
          Комментарии{comments.length ? ` · ${comments.length}` : ''}
        </button>
      </div>

      {error && <div className="settings__err" style={{ marginBottom: 16 }}>{error}</div>}

      {tab === 'submissions' && (
      <>
      {items.length === 0 ? (
        <p className="settings__hint">Очередь пуста — новых заявок нет.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.map((item) => (
            <section key={item.id} className="settings__block">
              <div className="settings__block-head" style={{ marginBottom: 12 }}>
                <h2 style={{ marginBottom: 4 }}>{item.title}</h2>
                <p style={{ margin: 0 }}>
                  Автор: {item.authorName}
                  {item.authorPaid ? ' · подписчик' : ' · бесплатный'}
                  {item.categoryName ? ` · ${item.categoryName}` : ''}
                </p>
              </div>

              <div className="ugc-preview" style={{ marginBottom: 16 }}>
                {item.body ? <RichText data={item.body} /> : <span className="settings__hint">Без текста</span>}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="studio-btn studio-btn--primary"
                  disabled={busyId === item.id}
                  onClick={() => approve(item, 'community')}
                  title="Опубликовать в ленте сообщества (видна зарегистрированным пользователям)"
                >
                  {busyId === item.id ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  Одобрить
                </button>
                <button
                  className="studio-btn studio-btn--ghost"
                  disabled={busyId === item.id}
                  onClick={() => reject(item)}
                >
                  <X size={16} /> Отклонить
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="studio-page-head" style={{ marginTop: 40 }}>
        <div>
          <h2 style={{ fontSize: 'var(--st-text-lg)' }}>История модерации</h2>
          <div className="studio-page-head__sub">Уже обработанные заявки — кто и когда проверил</div>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="settings__hint">Пока ничего не обработано.</p>
      ) : (
        <div className="mod-history">
          {history.map((h) => (
            <div key={h.id} className="mod-history__row">
              <span className={`mod-history__status mod-history__status--${h.status}`}>
                {h.status === 'approved' ? 'Одобрена' : 'Отклонена'}
              </span>
              <div className="mod-history__main">
                <div className="mod-history__title">
                  {h.status === 'approved' && h.publicationSlug ? (
                    <a href={`/publication/${h.publicationSlug}`} target="_blank" rel="noreferrer">
                      {h.title}
                    </a>
                  ) : (
                    h.title
                  )}
                  {h.status === 'approved' && h.section ? (
                    <span className="mod-history__section"> · {SECTION_LABEL[h.section]}</span>
                  ) : null}
                </div>
                <div className="mod-history__meta">
                  Автор: {h.authorName}
                  {' · '}
                  Проверил: {h.reviewerName || '—'}
                  {' · '}
                  {fmtDateTime(h.reviewedAt)}
                </div>
                {h.status === 'rejected' && h.rejectReason ? (
                  <div className="mod-history__reason">Причина: {h.rejectReason}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {tab === 'comments' && (
        comments.length === 0 ? (
          <p className="settings__hint">Комментариев пока нет.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {comments.map((c) => (
              <div key={c.id} className="settings__block" style={{ padding: 14, opacity: c.status === 'hidden' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--st-text)' }}>{c.authorName}</span>
                  {c.authorPaid && <span style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>· подписчик</span>}
                  {c.isReply && <span style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>· ответ</span>}
                  {c.status === 'hidden' && <span style={{ fontSize: 12, color: '#b45309' }}>· скрыт</span>}
                  {c.authorBanned && <span style={{ fontSize: 12, color: '#dc2626' }}>· заблокирован в комментариях</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--st-text-muted)' }}>{fmtDateTime(c.createdAt)}</span>
                </div>
                <div style={{ color: 'var(--st-text)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{c.text}</div>
                {c.targetTitle && (
                  <div style={{ fontSize: 12.5, color: 'var(--st-text-muted)', marginBottom: 10 }}>
                    К:{' '}
                    {c.targetHref ? (
                      <a href={c.targetHref} target="_blank" rel="noreferrer" className="studio-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {c.targetTitle} <ExternalLink size={12} />
                      </a>
                    ) : (
                      c.targetTitle
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="studio-btn studio-btn--ghost" disabled={cBusyId === c.id} onClick={() => toggleHideComment(c)}>
                    {c.status === 'hidden' ? <><Eye size={15} /> Показать</> : <><EyeOff size={15} /> Скрыть</>}
                  </button>
                  <button className="studio-btn studio-btn--danger" disabled={cBusyId === c.id} onClick={() => deleteComment(c)}>
                    {cBusyId === c.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Удалить
                  </button>
                  {c.authorId != null && (
                    <button className="studio-btn studio-btn--ghost" disabled={cBusyId === c.id} onClick={() => toggleBanAuthor(c)} style={c.authorBanned ? undefined : { color: '#dc2626' }}>
                      <Ban size={15} /> {c.authorBanned ? 'Разблокировать автора' : 'Заблокировать автора'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </>
  )
}
