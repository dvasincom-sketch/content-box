'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, Check, Trash2, Captions, Upload, Plus, Sparkles, List } from 'lucide-react'

/**
 * Общие секции редактора видео: субтитры / аналитика / саммари / главы.
 * Раньше жили внутри выдвижной панели (VideoEditModal); вынесены сюда, чтобы
 * их переиспользовала страница-редактор с табами (/studio/videos/<id>).
 */

export type Tier = { id: number | string; name: string }

export type EditableVideo = {
  id: number | string
  title: string
  minTierId: string
  season: number | null
  episode: number | null
  categoryId: string
  tags: string[]
  usedIn: { id: number | string; title: string }[]
  /** 'stream' | 'kinescope' | 'embed' | 'self' — у embed можно править исходную ссылку. */
  provider?: string
  embedProvider?: string | null
  embedSrc?: string | null
  playbackId?: string | null
  subtitles?: { lang: string; label: string }[]
  summary?: { tldr?: string; at?: string } | null
  chapters?: { start: number; title: string }[]
}

/* -------------------------------------------------------------------------- */
/* Субтитры своего видео: загрузка VTT/SRT + список дорожек                     */
/* -------------------------------------------------------------------------- */
export function SubtitlesSection({
  videoId,
  playbackId,
  initial,
}: {
  videoId: number | string
  playbackId: string | null
  initial: { lang: string; label: string }[]
}) {
  const [tracks, setTracks] = useState<{ lang: string; label: string }[]>(initial)
  const [lang, setLang] = useState('')
  const [label, setLabel] = useState('')
  const [content, setContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [gen, setGen] = useState<'idle' | 'busy' | 'queued'>('idle')

  async function genAuto() {
    setErr(null); setGen('busy')
    try {
      const res = await fetch('/studio/api/videos/subtitles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId, action: 'generate' }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || 'Не удалось'); setGen('idle') }
      else setGen('queued')
    } catch { setErr('Ошибка соединения'); setGen('idle') }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setErr('Файл больше 2 МБ'); return }
    const text = await file.text()
    setContent(text)
    setFileName(file.name)
    if (!lang) { const m = file.name.toLowerCase().match(/[._-]([a-z]{2,3})\.(vtt|srt)$/); if (m) setLang(m[1]) }
    setErr(null)
  }

  async function add() {
    setErr(null)
    if (!content) { setErr('Выберите файл .vtt или .srt'); return }
    if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(lang.trim().toLowerCase())) { setErr('Код языка: ru, en, pt-br…'); return }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/videos/subtitles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId, action: 'add', lang: lang.trim().toLowerCase(), label: label.trim(), content }),
      })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Не удалось сохранить')
      else { setTracks(j.subtitles || []); setContent(null); setFileName(''); setLang(''); setLabel('') }
    } catch { setErr('Ошибка соединения') } finally { setBusy(false) }
  }

  async function remove(l: string) {
    setBusy(true)
    try {
      const res = await fetch('/studio/api/videos/subtitles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId, action: 'remove', lang: l }),
      })
      const j = await res.json()
      if (res.ok) setTracks(j.subtitles || [])
    } catch { /* no-op */ } finally { setBusy(false) }
  }

  return (
    <div className="studio-field">
      <span className="studio-field__label">Субтитры</span>
      {!playbackId ? (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7 }}>Дорожки можно добавить, когда видео обработается.</div>
      ) : (
        <>
          {tracks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {tracks.map((t) => (
                <div key={t.lang} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Captions size={14} />
                  <span style={{ fontSize: 13 }}>{t.label} <span style={{ opacity: 0.6 }}>({t.lang})</span></span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="catmgr__icon-btn catmgr__icon-btn--danger" onClick={() => remove(t.lang)} disabled={busy} title="Удалить"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label className="studio-btn studio-btn--ghost" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> {fileName || 'Файл .vtt / .srt'}
              <input type="file" accept=".vtt,.srt,text/vtt" onChange={onFile} style={{ display: 'none' }} />
            </label>
            <input className="studio-input" style={{ width: 90 }} placeholder="ru" value={lang} onChange={(e) => setLang(e.target.value)} />
            <input className="studio-input" style={{ width: 150 }} placeholder="Русские" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button type="button" className="studio-btn studio-btn--primary" onClick={add} disabled={busy || !content}>
              {busy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Добавить
            </button>
          </div>
          {err && <div className="studio-login__error" style={{ marginTop: 6 }}>{err}</div>}
          <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Формат VTT или SRT (SRT конвертируется автоматически). Код языка — ru, en и т.п.</div>

          <div style={{ borderTop: '1px solid var(--brand-border, rgba(128,128,128,.2))', margin: '12px 0 8px' }} />
          {gen === 'queued' ? (
            <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.85 }}>
              <Check size={13} style={{ verticalAlign: '-2px' }} /> Задача поставлена — субтитры и главы появятся через несколько минут (обновите позже).
            </div>
          ) : (
            <>
              <button type="button" className="studio-btn studio-btn--ghost" onClick={genAuto} disabled={gen === 'busy'}>
                {gen === 'busy' ? <Loader2 size={14} className="spin" /> : <Captions size={14} />} Сгенерировать автоматически (Whisper)
              </button>
              <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Распознаём речь и делаем субтитры + главы. Работает и для старых видео (аудио берётся из HLS).</div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Аналитика просмотров своего видео: кривая удержания / тепловая карта         */
/* -------------------------------------------------------------------------- */
export function AnalyticsSection({ videoId }: { videoId: number | string }) {
  const [data, setData] = useState<{ buckets: number[]; starts: number; plays: number; viewers: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stop = false
    fetch(`/studio/api/videos/heatmap?videoId=${videoId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (!stop && Array.isArray(j?.buckets)) setData({ buckets: j.buckets, starts: j.starts || 0, plays: j.plays || 0, viewers: j.viewers || 0 }) })
      .catch(() => {})
      .finally(() => { if (!stop) setLoading(false) })
    return () => { stop = true }
  }, [videoId])

  const max = data ? Math.max(1, ...data.buckets) : 1
  const avgPct = data && data.starts > 0 ? Math.round(data.plays / data.starts) : 0
  const at = (p: number) => (data && data.starts > 0 ? Math.round((data.buckets[p] / data.starts) * 100) : 0)
  const hasData = !!data && (data.starts > 0 || data.viewers > 0)

  return (
    <div className="studio-field">
      <span className="studio-field__label">Аналитика просмотров</span>
      {loading ? (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7 }}>Загрузка…</div>
      ) : !hasData ? (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7 }}>Пока нет данных о просмотрах. Появятся, когда видео начнут смотреть.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{data!.viewers}</div><div style={{ fontSize: 12, opacity: 0.7 }}>зрителей</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{data!.starts}</div><div style={{ fontSize: 12, opacity: 0.7 }}>проигрываний</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgPct}%</div><div style={{ fontSize: 12, opacity: 0.7 }}>ср. досмотр</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{at(50)}%</div><div style={{ fontSize: 12, opacity: 0.7 }}>до середины</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{at(99)}%</div><div style={{ fontSize: 12, opacity: 0.7 }}>до конца</div></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 64, background: 'var(--surface-2, rgba(128,128,128,0.08))', borderRadius: 8, padding: '6px 6px 0', overflow: 'hidden' }}>
            {data!.buckets.map((v, i) => (
              <div key={i} title={`${i}% — ${v}`} style={{ flex: 1, height: `${Math.max(3, (v / max) * 100)}%`, background: 'var(--brand-primary, #7c3aed)', opacity: 0.35 + 0.65 * (v / max), borderRadius: '2px 2px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            <span>начало</span><span>середина</span><span>конец</span>
          </div>
          <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Высота столбца — как часто смотрят этот участок. Провалы — где перематывают или уходят.</div>
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Саммари от Аси: (пере)генерация краткого содержания по субтитрам             */
/* -------------------------------------------------------------------------- */
export function SummarySection({ videoId, initial, hasSubtitles }: { videoId: number | string; initial: { tldr?: string; at?: string } | null; hasSubtitles: boolean }) {
  const [summary, setSummary] = useState<{ tldr?: string; at?: string } | null>(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function refresh() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/studio/api/videos/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId }),
      })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Не удалось')
      else setSummary(j.summary)
    } catch { setErr('Ошибка соединения') } finally { setBusy(false) }
  }

  return (
    <div className="studio-field">
      {/* Отдельная сущность — своя карточка с фирменным акцентом Аси. */}
      <div style={{ borderRadius: 14, border: '1px solid color-mix(in srgb, #b79aef 42%, var(--brand-border, rgba(128,128,128,.25)))', background: 'linear-gradient(135deg, rgba(247,161,188,.07), rgba(183,154,239,.07))', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle at 34% 30%, #ffffff, #ffb3cc 42%, #c3a0f2 70%, #8fb8ff)', boxShadow: '0 0 9px 1px rgba(199,150,240,.75), 0 0 0 1px rgba(255,255,255,.5)' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand-text)' }}>Саммари от <a href="https://ася.online" target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline' }}>Аси</a></span>
        </div>
        {summary?.tldr ? (
          <div className="videdit__hint" style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>{summary.tldr}</div>
        ) : (
          <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>{hasSubtitles ? 'Саммари ещё не сгенерировано.' : 'Саммари появится, когда будут субтитры.'}</div>
        )}
        <button type="button" className="studio-btn studio-btn--ghost" onClick={refresh} disabled={busy || !hasSubtitles} title={!hasSubtitles ? 'Сначала нужны субтитры' : undefined}>
          {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {summary?.tldr ? 'Обновить саммари' : 'Сгенерировать саммари'}
        </button>
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          {hasSubtitles
            ? 'Ася делает краткое содержание по субтитрам. Обновите после смены или дозагрузки субтитров.'
            : 'Сначала сгенерируйте автоматические субтитры или загрузите файл выше — затем можно собрать саммари.'}
        </div>
        {err && <div className="studio-login__error" style={{ marginTop: 6 }}>{err}</div>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Главы: ручная правка + полировка авто-заголовков через Асю                   */
/* -------------------------------------------------------------------------- */
function fmtTs(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

// "m:ss" | "h:mm:ss" | "123" → секунды (или NaN).
function parseTs(str: string): number {
  const t = String(str).trim()
  if (/^\d+$/.test(t)) return Number(t)
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/)
  if (!m) return NaN
  const h = m[1] ? Number(m[1]) : 0
  return h * 3600 + Number(m[2]) * 60 + Number(m[3])
}

type ChapterRow = { startStr: string; title: string }

export function ChaptersSection({ videoId, initial }: { videoId: number | string; initial: { start: number; title: string }[] }) {
  const [rows, setRows] = useState<ChapterRow[]>(initial.map((c) => ({ startStr: fmtTs(c.start), title: c.title })))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const setRow = (i: number, patch: Partial<ChapterRow>) => {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)))
    setDirty(true); setSaved(false)
  }
  const removeRow = (i: number) => { setRows((rs) => rs.filter((_, k) => k !== i)); setDirty(true); setSaved(false) }
  const addRow = () => { setRows((rs) => [...rs, { startStr: fmtTs(0), title: '' }]); setDirty(true); setSaved(false) }

  async function save() {
    // Собираем и валидируем на клиенте (тайминги парсим из строк).
    const chapters: { start: number; title: string }[] = []
    for (const r of rows) {
      const title = r.title.trim()
      if (!title) continue
      const start = parseTs(r.startStr)
      if (!Number.isFinite(start)) { setErr(`Неверное время: «${r.startStr}» (формат мм:сс)`); return }
      chapters.push({ start, title })
    }
    setBusy(true); setErr(null); setSaved(false)
    try {
      const res = await fetch('/studio/api/videos/chapters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId, chapters }),
      })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Не удалось сохранить')
      else if (Array.isArray(j.chapters)) {
        setRows(j.chapters.map((c: any) => ({ startStr: fmtTs(c.start), title: c.title })))
        setDirty(false); setSaved(true)
      }
    } catch { setErr('Ошибка соединения') } finally { setBusy(false) }
  }

  async function polish() {
    setPolishing(true); setErr(null); setSaved(false)
    try {
      const res = await fetch('/studio/api/videos/polish-chapters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId }),
      })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Не удалось')
      else if (Array.isArray(j.chapters)) {
        setRows(j.chapters.map((c: any) => ({ startStr: fmtTs(c.start), title: c.title })))
        setDirty(false) // роут уже записал результат в видео
      }
    } catch { setErr('Ошибка соединения') } finally { setPolishing(false) }
  }

  const anyBusy = busy || polishing

  return (
    <div className="studio-field">
      <span className="studio-field__label">Главы</span>
      {rows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="studio-input"
                style={{ width: 78, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
                value={r.startStr}
                onChange={(e) => setRow(i, { startStr: e.target.value })}
                placeholder="0:00"
                aria-label="Время начала главы"
              />
              <input
                className="studio-input"
                style={{ flex: 1 }}
                value={r.title}
                onChange={(e) => setRow(i, { title: e.target.value })}
                placeholder="Название главы"
                maxLength={120}
              />
              <button type="button" className="catmgr__icon-btn catmgr__icon-btn--danger" onClick={() => removeRow(i)} disabled={anyBusy} title="Удалить главу"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Глав пока нет — сгенерируйте субтитры (Whisper) или добавьте вручную.</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="button" className="studio-btn studio-btn--ghost" onClick={addRow} disabled={anyBusy}>
          <Plus size={14} /> Добавить главу
        </button>
        <button type="button" className="studio-btn studio-btn--primary" onClick={save} disabled={anyBusy || !dirty}>
          {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Сохранить
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="studio-btn studio-btn--ghost" onClick={polish} disabled={anyBusy || dirty || rows.length < 2} title={dirty ? 'Сначала сохраните изменения' : rows.length < 2 ? 'Нужны субтитры и главы' : undefined}>
          {polishing ? <Loader2 size={14} className="spin" /> : <List size={14} />} Улучшить через Асю
        </button>
      </div>

      <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Время — в формате мм:сс (или ч:мм:сс). Первая глава автоматически ставится с 0:00. «Улучшить через Асю» заменит заголовки короткими осмысленными (по субтитрам).
      </div>
      {saved && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--success, #22c55e)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={14} /> Сохранено</div>}
      {err && <div className="studio-login__error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  )
}
