'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send, EyeOff, Eye, Loader2, Pin, PinOff, Ban } from 'lucide-react'

type Msg = { id: number; name: string; text: string; at: string; hidden: boolean; mine: boolean; pinned?: boolean; sub?: number | null }
type Pinned = { id: number; name: string; text: string }

/**
 * Чат трансляции на поллинге. Читают подписчики с доступом (и владелец —
 * для модерации). Пишут — подписчики с доступом, не заблокированные.
 * Владелец: скрыть сообщение, закрепить (один пин сверху), забанить автора.
 */
export function StreamChat({ streamId }: { streamId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [pinned, setPinned] = useState<Pinned | null>(null)
  const [bannedIds, setBannedIds] = useState<number[]>([])
  const [canPost, setCanPost] = useState(false)
  const [canModerate, setCanModerate] = useState(false)
  const [needAccess, setNeedAccess] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastId = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)

  async function poll() {
    try {
      const res = await fetch(`/api/stream/chat?stream=${encodeURIComponent(streamId)}&after=${lastId.current}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const j = await res.json().catch(() => ({}))
      setCanPost(!!j.canPost)
      setCanModerate(!!j.canModerate)
      setNeedAccess(!!j.needAccess)
      setDisabled(!!j.disabled)
      setPinned(j.pinned || null)
      if (Array.isArray(j.bannedSubscriberIds)) setBannedIds(j.bannedSubscriberIds)
      const incoming: Msg[] = Array.isArray(j.messages) ? j.messages : []
      if (incoming.length) {
        lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id))
        setMsgs((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const merged = prev.concat(incoming.filter((m) => !seen.has(m.id)))
          return merged.slice(-500)
        })
      }
    } catch {
      /* тихо, повторим на следующем тике */
    }
  }

  useEffect(() => {
    poll()
    const id = setInterval(poll, 2500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId])

  useEffect(() => {
    const el = listRef.current
    if (el && atBottom.current) el.scrollTop = el.scrollHeight
  }, [msgs])

  function onScroll() {
    const el = listRef.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setSending(true); setError(null)
    try {
      const res = await fetch('/api/stream/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ stream: streamId, text }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error || 'Не удалось отправить'); setSending(false); return }
      setInput('')
      atBottom.current = true
      if (j.message) {
        lastId.current = Math.max(lastId.current, j.message.id)
        setMsgs((prev) => (prev.some((m) => m.id === j.message.id) ? prev : prev.concat(j.message)))
      }
    } catch { setError('Ошибка соединения') } finally { setSending(false) }
  }

  async function toggleHide(m: Msg) {
    try {
      const res = await fetch('/api/stream/chat/hide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: m.id, hidden: !m.hidden }),
      })
      if (res.ok) setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, hidden: !m.hidden } : x)))
    } catch {}
  }

  async function pinMsg(m: Msg) {
    try {
      const res = await fetch('/api/stream/chat/pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: m.id, pinned: true }),
      })
      if (res.ok) setPinned({ id: m.id, name: m.name, text: m.text })
    } catch {}
  }

  async function unpinMsg() {
    if (!pinned) return
    try {
      const res = await fetch('/api/stream/chat/pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: pinned.id, pinned: false }),
      })
      if (res.ok) setPinned(null)
    } catch {}
  }

  async function toggleBan(m: Msg) {
    if (m.sub == null) return
    const banned = !bannedIds.includes(m.sub)
    try {
      const res = await fetch('/api/stream/chat/ban', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ subscriber: m.sub, banned, stream: streamId }),
      })
      if (res.ok) {
        setBannedIds((prev) => (banned ? Array.from(new Set([...prev, m.sub as number])) : prev.filter((x) => x !== m.sub)))
        if (banned) setMsgs((prev) => prev.map((x) => (x.sub === m.sub ? { ...x, hidden: true } : x)))
      }
    } catch {}
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', height: '100%', minHeight: 320,
        border: '1px solid var(--brand-border, rgba(0,0,0,.12))', borderRadius: 16, overflow: 'hidden',
        background: 'color-mix(in srgb, var(--brand-surface, #fff) 60%, transparent)',
      }}
    >
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--brand-border, rgba(0,0,0,.12))', fontWeight: 700, color: 'var(--brand-text)', fontSize: 14 }}>
        Чат
      </div>

      {pinned && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--brand-border, rgba(0,0,0,.12))', background: 'color-mix(in srgb, var(--brand-primary, #ea580c) 10%, transparent)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Pin size={14} style={{ color: 'var(--brand-primary, #ea580c)', flex: 'none', marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700, color: 'var(--brand-text)' }}>{pinned.name}</span>
            <span style={{ color: 'var(--brand-text)' }}>: {pinned.text}</span>
          </div>
          {canModerate && (
            <button type="button" onClick={unpinMsg} title="Открепить" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--brand-muted)', flex: 'none' }}>
              <PinOff size={14} />
            </button>
          )}
        </div>
      )}

      <div ref={listRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.length === 0 ? (
          <div style={{ color: 'var(--brand-muted)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>Сообщений пока нет.</div>
        ) : (
          msgs.map((m) => {
            const isBanned = m.sub != null && bannedIds.includes(m.sub)
            return (
              <div key={m.id} style={{ fontSize: 14, lineHeight: 1.4, opacity: m.hidden ? 0.5 : 1 }}>
                <span style={{ fontWeight: 700, color: m.mine ? 'var(--brand-primary, #ea580c)' : 'var(--brand-text)' }}>{m.name}</span>
                <span style={{ color: 'var(--brand-text)' }}>: {m.text}</span>
                {m.hidden && <span style={{ color: 'var(--brand-muted)', fontSize: 12 }}> · скрыто</span>}
                {isBanned && <span style={{ color: '#dc2626', fontSize: 12 }}> · в бане</span>}
                {canModerate && (
                  <span style={{ marginLeft: 6, display: 'inline-flex', gap: 4, verticalAlign: 'middle' }}>
                    <button type="button" onClick={() => pinMsg(m)} title="Закрепить" style={modBtn}><Pin size={13} /></button>
                    <button type="button" onClick={() => toggleHide(m)} title={m.hidden ? 'Показать' : 'Скрыть'} style={modBtn}>{m.hidden ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                    {m.sub != null && (
                      <button type="button" onClick={() => toggleBan(m)} title={isBanned ? 'Разбанить в чате' : 'Забанить в чате'} style={{ ...modBtn, color: isBanned ? '#dc2626' : 'var(--brand-muted)' }}><Ban size={13} /></button>
                    )}
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--brand-border, rgba(0,0,0,.12))', padding: 10 }}>
        {disabled ? (
          <div style={{ color: 'var(--brand-muted)', fontSize: 13, textAlign: 'center' }}>Чат для этой трансляции выключен.</div>
        ) : needAccess ? (
          <div style={{ color: 'var(--brand-muted)', fontSize: 13, textAlign: 'center' }}>
            Чат доступен по подписке. <Link href="/subscribe" style={{ color: 'var(--brand-primary, #ea580c)' }}>Оформить</Link>
          </div>
        ) : canPost ? (
          <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Сообщение…"
              style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--brand-border, rgba(0,0,0,.12))', background: 'var(--brand-bg, #fff)', color: 'var(--brand-text)', fontSize: 14 }}
            />
            <button type="submit" disabled={sending || !input.trim()} className="c-btn c-btn--primary" style={{ padding: '9px 12px' }} aria-label="Отправить">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        ) : (
          <div style={{ color: 'var(--brand-muted)', fontSize: 13, textAlign: 'center' }}>Чтение чата.</div>
        )}
        {error && <div style={{ color: 'var(--danger, #dc2626)', fontSize: 12, marginTop: 6, textAlign: 'center' }}>{error}</div>}
      </div>
    </div>
  )
}

const modBtn: React.CSSProperties = { border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--brand-muted)', padding: 0 }
