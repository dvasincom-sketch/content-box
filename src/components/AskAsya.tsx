'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X, ArrowUp, Lock } from 'lucide-react'
import { getAsyaVideo, subAsyaVideo, type AsyaVideo } from '@/lib/asyaVideo'

/**
 * Единая точка входа Аси — плавающая кнопка справа снизу → выезжающая панель.
 * Заголовок кнопки динамический: на странице видео — «Что в этом видео», на
 * подписке — «Выбрать подписку», иначе — «Спросить Асю». При скролле кнопка
 * сжимается до круга. На странице видео панель показывает саммари (открыто всем
 * как тизер), а интерактивные вопросы — по подписке (/api/ask).
 */
type Match = { title: string | null; url: string | null; source: string }
type Msg = { role: 'me' | 'asya'; text: string; matches?: Match[] }

const CHIPS = [
  'Где момент про демобилизацию?',
  'О чём последний влог?',
  'Найди, где Чонгук и Чимин вместе',
]

export function AskAsya({ subscribeHref = '/subscribe', loginHref = '/login' }: { subscribeHref?: string; loginHref?: string }) {
  const [open, setOpen] = useState(false)
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [video, setVideo] = useState<AsyaVideo>(null)
  const [sum, setSum] = useState<{ tldr?: string; points?: string[] } | null>(null)
  const [sumStatus, setSumStatus] = useState<'idle' | 'loading' | 'ready' | 'upsell' | 'none'>('idle')
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    setVideo(getAsyaVideo())
    return subAsyaVideo(() => setVideo(getAsyaVideo()))
  }, [])

  useEffect(() => { setSum(null); setSumStatus('idle') }, [video?.id])

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open || eligible !== null) return
    let stop = false
    fetch('/api/ask', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (!stop) setEligible(Boolean(j?.eligible)) })
      .catch(() => { if (!stop) setEligible(false) })
    return () => { stop = true }
  }, [open, eligible])

  useEffect(() => {
    if (!open || !video || sumStatus !== 'idle') return
    let stop = false
    setSumStatus('loading')
    fetch('/api/video-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ videoId: video.id }) })
      .then(async (r) => {
        if (stop) return
        if (r.status === 402) { setSumStatus('upsell'); return }
        const j = await r.json().catch(() => null)
        if (r.ok && j?.ok && j.summary && (j.summary.tldr || (j.summary.points && j.summary.points.length))) {
          setSum({ tldr: j.summary.tldr, points: j.summary.points }); setSumStatus('ready')
        } else { setSumStatus('none') }
      })
      .catch(() => { if (!stop) setSumStatus('none') })
    return () => { stop = true }
  }, [open, video, sumStatus])

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight }, [msgs, loading])

  async function ask(q: string) {
    const query = q.trim()
    if (!query || loading) return
    setInput('')
    setMsgs((m) => [...m, { role: 'me', text: query }])
    setLoading(true)
    try {
      const r = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ q: query }),
      })
      if (r.status === 402) { setEligible(false); return }
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.ok) setMsgs((m) => [...m, { role: 'asya', text: 'Не получилось ответить сейчас — попробуйте ещё раз чуть позже.' }])
      else setMsgs((m) => [...m, { role: 'asya', text: String(j.answer || ''), matches: Array.isArray(j.matches) ? j.matches : [] }])
    } catch {
      setMsgs((m) => [...m, { role: 'asya', text: 'Ошибка соединения.' }])
    } finally {
      setLoading(false)
    }
  }

  const orb = (size: number, strong = false) => (
    <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-block',
      background: strong
        ? 'radial-gradient(circle at 34% 30%, #ffffff, #f78fb3 40%, #8a5cf0 68%, #4f6fd8)'
        : 'radial-gradient(circle at 34% 30%, #ffffff, #ffb3cc 42%, #c3a0f2 70%, #8fb8ff)',
      boxShadow: strong
        ? '0 0 0 1.5px rgba(74,58,150,.6), 0 0 10px 1px rgba(150,108,240,.5)'
        : '0 0 12px 2px rgba(255,214,238,.85), 0 0 0 1px rgba(255,255,255,.5)',
      animation: 'asya-orb 3s ease-in-out infinite' }} />
  )

  const label = video ? 'Что в этом видео' : (pathname && pathname.startsWith('/subscribe') ? 'Выбрать подписку' : 'Спросить Асю')

  return (
    <>
      <style>{`
        @keyframes asya-orb { 0%,100%{ transform: scale(1) } 50%{ transform: scale(1.12) } }
        @keyframes asya-fab { 0%,100%{ box-shadow: 0 16px 40px -14px #7a52c8 } 50%{ box-shadow: 0 20px 52px -10px #9a6cf0 } }
        .askasya-fab:hover{ transform: translateY(-2px) }
        .askasya-chip:hover{ border-color: color-mix(in srgb, var(--brand-accent, #5b57c9) 45%, var(--brand-border, rgba(0,0,0,.1))); background: color-mix(in srgb, var(--brand-accent, #5b57c9) 5%, #fff) }
      `}</style>

      {!open && (
        <button className="askasya-fab" onClick={() => setOpen(true)} aria-label={label}
          style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 40, display: 'inline-flex', alignItems: 'center', gap: collapsed ? 0 : 11,
            padding: collapsed ? 13 : '13px 20px 13px 15px', border: 'none', cursor: 'pointer', borderRadius: 32, color: '#fff', fontWeight: 700, fontSize: 15,
            background: 'linear-gradient(135deg, #7e3a67, #4c3c9c)', boxShadow: '0 16px 40px -14px #7a52c8', animation: 'asya-fab 3.6s ease-in-out infinite', transition: 'padding .45s cubic-bezier(.22,1,.36,1), gap .45s cubic-bezier(.22,1,.36,1)' }}>
          {orb(24)}<span style={{ maxWidth: collapsed ? 0 : 220, minWidth: 0, opacity: collapsed ? 0 : 1, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'max-width .45s cubic-bezier(.22,1,.36,1), opacity .3s ease' }}>{label}</span>
        </button>
      )}

      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,14,25,.30)', backdropFilter: 'blur(2px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .25s', zIndex: 50 }} />

      <aside aria-hidden={!open} style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 420, maxWidth: '92vw', zIndex: 60,
        background: 'var(--brand-surface, #fff)', borderLeft: '1px solid var(--brand-border, rgba(0,0,0,.1))',
        boxShadow: '-24px 0 60px -30px rgba(0,0,0,.5)', transform: open ? 'none' : 'translateX(102%)',
        transition: 'transform .32s cubic-bezier(.22,1,.36,1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 16px 14px', borderBottom: '1px solid var(--brand-border, rgba(0,0,0,.1))' }}>
          {orb(30, true)}
          <div style={{ lineHeight: 1.15 }}><div style={{ fontWeight: 800, fontSize: 15, color: 'var(--brand-text)' }}>Ася</div>
            <div style={{ fontSize: 12, color: 'var(--brand-muted)', marginTop: 1 }}>Виртуальная поддержка</div></div>
          <button onClick={() => setOpen(false)} aria-label="Закрыть" style={{ marginLeft: 'auto', width: 34, height: 34, border: 'none', background: 'transparent', color: 'var(--brand-muted)', borderRadius: 9, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>
        </div>

        <div ref={bodyRef} style={{ flex: 1, overflow: 'auto', padding: '18px 16px' }}>
          {video && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: 'var(--brand-text)', marginBottom: 8 }}>{orb(20)} Что в этом видео</div>
              {sumStatus === 'loading' && <div style={{ fontSize: 14, color: 'var(--brand-muted)' }}>Ася читает субтитры…</div>}
              {sumStatus === 'ready' && sum && (
                <div style={{ background: 'color-mix(in srgb, var(--brand-accent, #5b57c9) 6%, #f6f5fb)', borderRadius: 14, padding: '12px 14px', fontSize: 14, lineHeight: 1.5, color: 'var(--brand-text)' }}>
                  {sum.tldr && <div style={{ marginBottom: sum.points && sum.points.length ? 8 : 0 }}>{sum.tldr}</div>}
                  {sum.points && sum.points.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>{sum.points.slice(0, 5).map((pt, i) => <li key={i}>{pt}</li>)}</ul>
                  )}
                </div>
              )}
              {sumStatus === 'upsell' && <div style={{ fontSize: 13.5, color: 'var(--brand-muted)', lineHeight: 1.5 }}>Краткое содержание собирает Ася по субтитрам — оформите подписку ниже, и она расскажет суть этого видео.</div>}
              {sumStatus === 'none' && <div style={{ fontSize: 13.5, color: 'var(--brand-muted)' }}>Саммари появится, когда будут субтитры.</div>}
              <div style={{ height: 1, background: 'var(--brand-border, rgba(0,0,0,.08))', margin: '16px 0 2px' }} />
            </div>
          )}

          {eligible === null && (
            <div style={{ textAlign: 'center', color: 'var(--brand-muted)', fontSize: 14, paddingTop: video ? 8 : 30 }}>Загрузка…</div>
          )}

          {eligible === false && (
            <div style={{ textAlign: 'center', padding: '10px 4px' }}>
              <div style={{ width: 60, height: 60, margin: '8px auto 14px', borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff',
                background: 'linear-gradient(135deg, var(--brand-primary, #e86a33), var(--brand-accent, #5b57c9))' }}><Lock size={24} /></div>
              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6, color: 'var(--brand-text)' }}>Ася знает этот сайт</div>
              <p style={{ margin: '0 auto 16px', maxWidth: 300, color: 'var(--brand-muted)', fontSize: 14, lineHeight: 1.55 }}>
                Ася понимает наше фан-сообщество и как устроен сайт. Подскажет по видео и материалам, найдёт нужный момент, поможет войти или что-то отыскать. Входит в подписку.
              </p>
              <a href={subscribeHref} style={{ display: 'inline-block', padding: '12px 22px', borderRadius: 26, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 14.5, background: 'linear-gradient(135deg, var(--brand-primary, #e86a33), #f19a5b)' }}>Оформить подписку</a>
              <div style={{ marginTop: 14 }}>
                <a href={`${loginHref}?redirect=${encodeURIComponent(pathname || '/')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--brand-accent, #5b57c9)', fontWeight: 600, fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 4 }}>Есть подписка — войти <ArrowUp size={15} style={{ transform: 'rotate(90deg)' }} /></a>
              </div>
            </div>
          )}

          {eligible === true && msgs.length === 0 && (
            <div>
              <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
                {!video && <div style={{ margin: '0 auto 12px' }}>{orb(52)}</div>}
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--brand-text)' }}>Чем помочь?</div>
                <p style={{ margin: '4px 0 0', color: 'var(--brand-muted)', fontSize: 14 }}>Спросите про любое видео — найду момент и тайм-код.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                {CHIPS.map((c) => (
                  <button key={c} className="askasya-chip" onClick={() => ask(c)}
                    style={{ textAlign: 'left', padding: '13px 14px', borderRadius: 13, border: '1px solid var(--brand-border, rgba(0,0,0,.1))', background: 'var(--brand-surface, #fff)', cursor: 'pointer', font: 'inherit', fontSize: 14, color: 'var(--brand-text)', fontWeight: 600 }}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {eligible === true && msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, margin: '16px 0', flexDirection: m.role === 'me' ? 'row-reverse' : 'row' }}>
              {m.role === 'asya' ? orb(26) : <span style={{ width: 26, height: 26, borderRadius: '50%', flex: 'none', background: 'var(--brand-primary, #e86a33)' }} />}
              <div style={{ maxWidth: '80%' }}>
                <div style={{ padding: '11px 14px', borderRadius: 15, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  ...(m.role === 'me'
                    ? { background: 'var(--brand-primary, #e86a33)', color: '#fff', borderBottomRightRadius: 5 }
                    : { background: 'color-mix(in srgb, var(--brand-accent, #5b57c9) 7%, #f4f2f8)', color: 'var(--brand-text)', borderBottomLeftRadius: 5 }) }}>
                  {m.text}
                </div>
                {m.matches && m.matches.filter((x) => x.url).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {m.matches.filter((x) => x.url).slice(0, 3).map((x, k) => (
                      <a key={k} href={x.url as string} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--brand-primary, #e86a33)', textDecoration: 'none', border: '1px solid var(--brand-border, rgba(0,0,0,.1))', borderRadius: 10, padding: '7px 10px' }}>▶ {x.title || 'Смотреть видео'}</a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {eligible === true && loading && (
            <div style={{ display: 'flex', gap: 10, margin: '16px 0' }}>{orb(26)}<div style={{ padding: '11px 14px', borderRadius: 15, background: 'color-mix(in srgb, var(--brand-accent, #5b57c9) 7%, #f4f2f8)', color: 'var(--brand-muted)', fontSize: 14 }}>Ася ищет…</div></div>
          )}
        </div>

        {eligible === true && (
          <div style={{ borderTop: '1px solid var(--brand-border, rgba(0,0,0,.1))', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--brand-border, rgba(0,0,0,.1))', borderRadius: 14, padding: '8px 8px 8px 14px', background: 'var(--brand-surface, #fff)' }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask(input) }}
                placeholder="Спросите про видео…" disabled={loading}
                style={{ flex: 1, border: 'none', outline: 'none', font: 'inherit', fontSize: 14, background: 'transparent', color: 'var(--brand-text)' }} />
              <button onClick={() => ask(input)} disabled={loading || !input.trim()} aria-label="Отправить"
                style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: loading || !input.trim() ? 'default' : 'pointer', color: '#fff', flex: 'none', display: 'grid', placeItems: 'center', opacity: loading || !input.trim() ? 0.5 : 1, background: 'linear-gradient(135deg, #7e3a67, #4c3c9c)' }}><ArrowUp size={17} /></button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
