'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, X } from 'lucide-react'
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
export function ModerationView({ items: initial, history = [] }: { items: Item[]; history?: HistoryItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          <div className="studio-page-head__sub">Публикации от участников на проверке</div>
        </div>
      </div>

      {error && <div className="settings__err" style={{ marginBottom: 16 }}>{error}</div>}

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
                  onClick={() => approve(item, item.authorPaid ? 'feed' : 'community')}
                  title={item.authorPaid ? 'В общую ленту' : 'Общая лента — только платным'}
                >
                  {busyId === item.id ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  {item.authorPaid ? 'Одобрить в ленту' : 'Одобрить в сообщество'}
                </button>
                {item.authorPaid && (
                  <button
                    className="studio-btn studio-btn--ghost"
                    disabled={busyId === item.id}
                    onClick={() => approve(item, 'community')}
                  >
                    В сообщество
                  </button>
                )}
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
  )
}
