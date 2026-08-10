'use client'

import React, { useEffect, useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

type Summary = { tldr?: string; points?: string[]; text?: string }

/**
 * «Спросить Асю, что в этом видео» — премиум-фича (саммари по субтитрам). Стиль
 * Аси (лилово-розовое свечение, светящийся «орб»), показывается всем как апселл.
 * Результат раскрывается эффектом печатающей машинки — и для свежей генерации,
 * и для кэша (чтобы всегда ощущалось «живым»). Кэш с сервера НЕ передаётся —
 * только по клику через гейт.
 */
export function AsyaSummary({ videoId, minPrice = 2000 }: { videoId: number | string; minPrice?: number }) {
  const [data, setData] = useState<Summary | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState<'idle' | 'error' | 'upsell'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [typed, setTyped] = useState(0)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)

  // Восстанавливаем прошлый голос (чтобы не голосовать повторно).
  useEffect(() => {
    try {
      const v = localStorage.getItem(`asya-vote-${videoId}`)
      if (v === 'up' || v === 'down') setVote(v)
    } catch { /* no-op */ }
  }, [videoId])

  async function rate(v: 'up' | 'down') {
    if (vote) return // уже голосовал
    setVote(v)
    try { localStorage.setItem(`asya-vote-${videoId}`, v) } catch { /* no-op */ }
    try {
      await fetch('/api/video-summary/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId, vote: v }),
      })
    } catch { /* оценка не критична */ }
  }

  // Сегменты для «печатной машинки»: [tldr, ...points]. Между сегментами — 1 «шаг».
  // Пункты ограничиваем до 4 — блок должен читаться как короткий единый список.
  const segs: string[] = data
    ? [String(data.tldr || ''), ...(data.points || []).slice(0, 4).map((p) => String(p))]
    : []
  const total = segs.reduce((a, x) => a + x.length, 0) + Math.max(0, segs.length - 1)

  useEffect(() => {
    if (!data || !open) { setTyped(0); return }
    setTyped(0)
    if (total <= 0) return
    const step = Math.max(1, Math.ceil(total / 90))
    let n = 0
    const id = setInterval(() => {
      n += step
      if (n >= total) { n = total; clearInterval(id) }
      setTyped(n)
    }, 26)
    return () => clearInterval(id)
  }, [data, open, total])

  function shown(i: number): number {
    let off = 0
    for (let k = 0; k < i; k++) off += segs[k].length + 1
    return Math.max(0, Math.min(segs[i].length, typed - off))
  }
  const done = typed >= total

  async function ask() {
    if (data) { setOpen((o) => !o); return }
    setLoading(true)
    setState('idle')
    try {
      const r = await fetch('/api/video-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId }),
      })
      const j = await r.json().catch(() => null)
      if (r.status === 402 || j?.error === 'upsell') {
        setState('upsell')
      } else if (!r.ok || !j?.ok) {
        setState('error')
        setErrMsg(
          j?.error === 'no_transcript' || j?.error === 'transcript_too_short'
            ? 'Субтитры ещё не готовы — саммари появится после распознавания речи.'
            : j?.error === 'summary_disabled'
              ? 'Саммари сейчас недоступно.'
              : 'Не удалось получить саммари.',
        )
      } else {
        setData(j.summary)
        setOpen(true)
      }
    } catch {
      setState('error')
      setErrMsg('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }

  const Cursor = () => (
    <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#b79aef', marginLeft: 2, verticalAlign: '-2px', animation: 'asya-blink 1s step-end infinite' }} />
  )

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        @keyframes asya-glow { 0%,100%{ box-shadow: 0 12px 30px -12px #b79aef, 0 0 0 1px rgba(255,255,255,.14) inset } 50%{ box-shadow: 0 16px 42px -8px #c3a0f2, 0 0 0 1px rgba(255,255,255,.22) inset } }
        @keyframes asya-orb { 0%,100%{ transform: scale(1) } 50%{ transform: scale(1.14) } }
        @keyframes asya-blink { 0%,50%{ opacity: 1 } 50.01%,100%{ opacity: 0 } }
        .asya-btn:hover { filter: brightness(1.06) }
      `}</style>

      <button
        type="button"
        className="asya-btn"
        onClick={ask}
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 11, padding: '13px 22px', border: 'none',
          cursor: 'pointer', borderRadius: 30, color: '#fff', fontWeight: 700, fontSize: 15,
          background: 'linear-gradient(135deg, #7e3a67, #4c3c9c)',
          animation: 'asya-glow 3.4s ease-in-out infinite',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: 'radial-gradient(circle at 34% 30%, #ffffff, #ffb3cc 42%, #c3a0f2 70%, #8fb8ff)',
            boxShadow: '0 0 12px 2px rgba(255,214,238,.9), 0 0 0 1px rgba(255,255,255,.55)',
            animation: loading ? 'asya-orb .8s ease-in-out infinite' : 'asya-orb 3s ease-in-out infinite',
          }}
        />
        {loading ? 'Ася смотрит видео…' : data ? 'Что в этом видео' : 'Спросить Асю, что в этом видео'}
      </button>

      {loading && (
        <div style={{ marginTop: 10, color: 'var(--brand-muted)', fontSize: 13 }}>
          Читаю субтитры и собираю суть… если саммари делается впервые, это займёт чуть больше времени.
        </div>
      )}

      {state === 'upsell' && (
        <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(247,161,188,.12), rgba(183,154,239,.12))', border: '1px solid rgba(183,154,239,.4)' }}>
          <div style={{ fontWeight: 700, color: 'var(--brand-text)', marginBottom: 4 }}>Ася расскажет, что в этом видео ✨</div>
          <div style={{ color: 'var(--brand-muted)', fontSize: 14, marginBottom: 10 }}>Краткое содержание от Аси — в подписке от {minPrice} ₽ («Золотой» и выше).</div>
          <a href="/subscribe" style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 22, color: '#fff', fontWeight: 700, textDecoration: 'none', background: 'linear-gradient(135deg, #f7a1bc, #b79aef)' }}>Оформить подписку</a>
        </div>
      )}

      {state === 'error' && <div style={{ marginTop: 10, color: 'var(--brand-muted)', fontSize: 14 }}>{errMsg}</div>}

      {data && open && (
        <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(247,161,188,.07), rgba(183,154,239,.07))', border: '1px solid rgba(183,154,239,.28)' }}>
          {shown(0) > 0 && (
            <p style={{ fontWeight: 500, lineHeight: 1.4, color: 'var(--brand-text)', margin: 0, marginBottom: segs.length > 1 && shown(0) >= segs[0].length ? 8 : 0 }}>
              {segs[0].slice(0, shown(0))}
              {!done && shown(0) < segs[0].length ? <Cursor /> : null}
            </p>
          )}
          {segs.length > 1 && (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.4, color: 'var(--brand-text)' }}>
              {segs.slice(1).map((seg, idx) => {
                const si = idx + 1
                const sh = shown(si)
                if (sh <= 0) return null
                return (
                  <li key={si}>
                    {seg.slice(0, sh)}
                    {!done && sh < seg.length ? <Cursor /> : null}
                  </li>
                )
              })}
            </ul>
          )}
          {done && (
            <>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--brand-muted)' }}>{vote ? 'Спасибо за оценку!' : 'Полезное саммари?'}</span>
                <button
                  type="button"
                  onClick={() => rate('up')}
                  aria-label="Полезно"
                  disabled={!!vote}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', cursor: vote ? 'default' : 'pointer', color: vote === 'up' ? '#fff' : 'var(--brand-text)', background: vote === 'up' ? '#22c55e' : 'color-mix(in srgb, var(--brand-text) 7%, transparent)', border: '1px solid var(--brand-border)', opacity: vote && vote !== 'up' ? 0.4 : 1 }}
                >
                  <ThumbsUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => rate('down')}
                  aria-label="Не очень"
                  disabled={!!vote}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', cursor: vote ? 'default' : 'pointer', color: vote === 'down' ? '#fff' : 'var(--brand-text)', background: vote === 'down' ? '#ef4444' : 'color-mix(in srgb, var(--brand-text) 7%, transparent)', border: '1px solid var(--brand-border)', opacity: vote && vote !== 'down' ? 0.4 : 1 }}
                >
                  <ThumbsDown size={16} />
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--brand-muted)' }}>Краткое содержание сгенерировала Ася по субтитрам — возможны неточности.</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
