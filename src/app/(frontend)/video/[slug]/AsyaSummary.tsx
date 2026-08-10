'use client'

import React, { useState } from 'react'
import { Sparkles, Loader2, ChevronDown } from 'lucide-react'

type Summary = { tldr?: string; points?: string[]; text?: string }

/**
 * «Спросить Асю, что в этом видео» — краткое содержание по субтитрам. Первый клик
 * генерит (или берёт кэш на видео), дальше просто разворачивает. Кнопка есть
 * только у видео с транскриптом; при его отсутствии показываем мягкое сообщение.
 */
export function AsyaSummary({ videoId, initial }: { videoId: number | string; initial?: Summary | null }) {
  const [data, setData] = useState<Summary | null>(initial ?? null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function ask() {
    setErr(null)
    if (data) { setOpen((o) => !o); return }
    setLoading(true)
    try {
      const r = await fetch('/api/video-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) {
        setErr(
          j.error === 'no_transcript' || j.error === 'transcript_too_short'
            ? 'Субтитры ещё не готовы — саммари появится после распознавания речи.'
            : j.error === 'summary_disabled'
              ? 'Саммари сейчас недоступно.'
              : 'Не удалось получить саммари.',
        )
      } else { setData(j.summary); setOpen(true) }
    } catch { setErr('Ошибка соединения') } finally { setLoading(false) }
  }

  return (
    <div style={{ marginBottom: 24, border: '1px solid var(--brand-border)', borderRadius: 16, background: 'var(--brand-surface)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={ask}
        disabled={loading}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-text)', font: 'inherit', textAlign: 'left' }}
      >
        <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)', color: 'var(--brand-primary)', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
        </span>
        <span style={{ fontWeight: 700 }}>Спросить Асю, что в этом видео</span>
        {data && <ChevronDown size={18} style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
      </button>

      {err && <div style={{ padding: '0 16px 14px', color: 'var(--brand-muted)', fontSize: 14 }}>{err}</div>}

      {data && open && (
        <div style={{ padding: '0 16px 16px' }}>
          {data.tldr && (
            <p style={{ fontWeight: 600, color: 'var(--brand-text)', marginBottom: data.points && data.points.length ? 12 : 0 }}>{data.tldr}</p>
          )}
          {Array.isArray(data.points) && data.points.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--brand-text)' }}>
              {data.points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--brand-muted)' }}>Краткое содержание сгенерировала Ася по субтитрам — возможны неточности.</div>
        </div>
      )}
    </div>
  )
}
