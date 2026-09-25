'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Radio, Copy, Check, Trash2, Upload, X, ExternalLink } from 'lucide-react'

type Tier = { id: string; name: string }

type Item = {
  id: number | string
  title: string
  slug: string
  scheduledAt: string | null
  endsAt: string | null
  coverId: string
  coverUrl: string | null
  minTierId: string
  minTierName: string | null
  chatEnabled: boolean
  saveRecording: boolean
  playbackUrl: string
  ingestServer: string
  ingestKey: string
  recordingUrl: string
}

type Form = {
  id: number | string | null
  title: string
  scheduledAt: string // datetime-local
  endsAt: string // datetime-local
  coverId: string
  coverUrl: string | null
  minTierId: string
  chatEnabled: boolean
  saveRecording: boolean
  playbackUrl: string
  ingestServer: string
  ingestKey: string
  recordingUrl: string
}

// ISO ↔ значение <input type="datetime-local"> (в часовом поясе браузера).
function isoToLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function localToIso(local: string): string {
  if (!local) return ''
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

function statusOf(s: { scheduledAt: string | null; endsAt: string | null }): { k: string; label: string; color: string } {
  const now = Date.now()
  const a = s.scheduledAt ? Date.parse(s.scheduledAt) : 0
  const b = s.endsAt ? Date.parse(s.endsAt) : 0
  if (a && now < a) return { k: 'soon', label: 'Скоро', color: '#2563eb' }
  if (a && b && now >= a && now < b) return { k: 'live', label: 'В эфире', color: '#dc2626' }
  if (b && now >= b) return { k: 'ended', label: 'Завершена', color: 'var(--st-text-muted)' }
  return { k: 'draft', label: 'Черновик', color: 'var(--st-text-muted)' }
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

const emptyForm: Form = {
  id: null, title: '', scheduledAt: '', endsAt: '', coverId: '', coverUrl: null,
  minTierId: '', chatEnabled: true, saveRecording: false, playbackUrl: '',
  ingestServer: '', ingestKey: '', recordingUrl: '',
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  if (!text) return null
  return (
    <button
      type="button"
      className="studio-btn studio-btn--ghost"
      style={{ padding: '6px 10px' }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) } catch {}
      }}
      title="Скопировать"
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

export function StreamsManager({ tiers }: { tiers: Tier[] }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState<number | string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true); setListError(null)
    try {
      const res = await fetch('/studio/api/streams', { credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setListError(j.error || 'Не удалось загрузить')
      else setItems(j.items || [])
    } catch { setListError('Ошибка соединения') } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  function openNew() {
    setFormError(null)
    setForm({ ...emptyForm, minTierId: tiers[0]?.id || '' })
  }
  function openEdit(it: Item) {
    setFormError(null)
    setForm({
      id: it.id, title: it.title, scheduledAt: isoToLocal(it.scheduledAt), endsAt: isoToLocal(it.endsAt),
      coverId: it.coverId, coverUrl: it.coverUrl, minTierId: it.minTierId, chatEnabled: it.chatEnabled,
      saveRecording: it.saveRecording, playbackUrl: it.playbackUrl, ingestServer: it.ingestServer,
      ingestKey: it.ingestKey, recordingUrl: it.recordingUrl,
    })
  }
  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f))

  async function uploadCover(file: File) {
    setCoverBusy(true); setFormError(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/studio/api/upload-cover', { method: 'POST', credentials: 'include', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setFormError(j.error || 'Не удалось загрузить обложку')
      else patch({ coverId: String(j.id), coverUrl: j.url || null })
    } catch { setFormError('Ошибка загрузки обложки') } finally { setCoverBusy(false) }
  }

  async function save() {
    if (!form || busy) return
    setBusy(true); setFormError(null)
    const payload = {
      id: form.id ?? undefined,
      title: form.title,
      scheduledAt: localToIso(form.scheduledAt),
      endsAt: localToIso(form.endsAt),
      minTierId: form.minTierId,
      playbackUrl: form.playbackUrl,
      coverId: form.coverId || null,
      chatEnabled: form.chatEnabled,
      saveRecording: form.saveRecording,
      ingestServer: form.ingestServer,
      ingestKey: form.ingestKey,
      recordingUrl: form.recordingUrl,
    }
    try {
      const url = form.id ? '/studio/api/streams/update' : '/studio/api/streams'
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setFormError(j.error || 'Не удалось сохранить'); setBusy(false); return }
      setForm(null)
      await refresh()
    } catch { setFormError('Ошибка соединения') } finally { setBusy(false) }
  }

  async function remove(id: number | string) {
    setBusy(true)
    try {
      const res = await fetch('/studio/api/streams/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id }),
      })
      if (res.ok) { setConfirmDel(null); await refresh() }
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, color: 'var(--st-text)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <Radio size={22} /> Трансляции
        </h1>
        {!form && <button type="button" className="studio-btn studio-btn--primary" onClick={openNew}><Plus size={16} /> Новая трансляция</button>}
      </div>

      {tiers.length === 0 && (
        <div className="studio-notice studio-notice--warn" style={{ marginBottom: 16 }}>
          Сначала создайте платный уровень подписки — трансляции доступны только по подписке.
        </div>
      )}

      {form ? (
        <StreamForm
          form={form} tiers={tiers} busy={busy} error={formError} coverBusy={coverBusy}
          fileInput={fileInput} onPatch={patch} onCover={uploadCover} onSave={save} onCancel={() => setForm(null)}
        />
      ) : loading ? (
        <div className="uk-empty"><Loader2 size={18} className="spin" /> Загрузка…</div>
      ) : listError ? (
        <div className="settings__err">{listError}</div>
      ) : !items || items.length === 0 ? (
        <div className="uk-empty">Трансляций пока нет. Нажмите «Новая трансляция».</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it) => {
            const st = statusOf(it)
            return (
              <div key={it.id} className="studio-card" style={{ padding: 14, borderRadius: 14, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 96, height: 54, borderRadius: 8, overflow: 'hidden', flex: 'none', background: 'color-mix(in srgb, var(--st-text) 8%, transparent)' }}>
                  {it.coverUrl && <img src={it.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--st-text)' }}>{it.title}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>● {st.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--st-text-muted)', marginTop: 3 }}>
                    {fmt(it.scheduledAt)} — {fmt(it.endsAt)} · {it.minTierName || 'без уровня'}
                    {it.chatEnabled ? ' · чат' : ''}{it.saveRecording ? ' · запись' : ''}
                  </div>
                  {it.ingestServer || it.ingestKey ? (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--st-text-muted)' }}>Данные для OBS</div>
                      {it.ingestServer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input readOnly value={it.ingestServer} className="studio-input" style={{ fontSize: 13 }} />
                          <CopyBtn text={it.ingestServer} />
                        </div>
                      )}
                      {it.ingestKey && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input readOnly value={it.ingestKey} className="studio-input" style={{ fontSize: 13 }} />
                          <CopyBtn text={it.ingestKey} />
                        </div>
                      )}
                    </div>
                  ) : null}
                  {it.slug && (
                    <a href={`/stream/${it.slug}`} target="_blank" rel="noopener noreferrer" className="studio-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, marginTop: 8 }}>
                      <ExternalLink size={13} /> Страница трансляции
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
                  <button type="button" className="studio-btn studio-btn--ghost" onClick={() => openEdit(it)}>Редактировать</button>
                  {confirmDel === it.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="studio-btn studio-btn--danger" disabled={busy} onClick={() => remove(it.id)}>{busy ? <Loader2 size={14} className="spin" /> : 'Удалить'}</button>
                      <button type="button" className="studio-btn studio-btn--ghost" disabled={busy} onClick={() => setConfirmDel(null)}>Отмена</button>
                    </div>
                  ) : (
                    <button type="button" className="studio-btn studio-btn--ghost" onClick={() => setConfirmDel(it.id)}><Trash2 size={14} /> Удалить</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StreamForm({
  form, tiers, busy, error, coverBusy, fileInput, onPatch, onCover, onSave, onCancel,
}: {
  form: Form; tiers: Tier[]; busy: boolean; error: string | null; coverBusy: boolean
  fileInput: React.RefObject<HTMLInputElement | null>
  onPatch: (p: Partial<Form>) => void; onCover: (f: File) => void; onSave: () => void; onCancel: () => void
}) {
  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <label className="studio-field">
      <span className="studio-field__label">{label}</span>
      {node}
      {hint && <span className="studio-field__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{hint}</span>}
    </label>
  )
  return (
    <div className="studio-card" style={{ padding: 20, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, color: 'var(--st-text)', margin: 0 }}>{form.id ? 'Редактирование трансляции' : 'Новая трансляция'}</h2>
        <button type="button" className="catmgr__icon-btn" onClick={onCancel} aria-label="Закрыть"><X size={18} /></button>
      </div>

      {field('Название', <input className="studio-input" value={form.title} onChange={(e) => onPatch({ title: e.target.value })} />)}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'start' }}>
        {field('Начало', <input type="datetime-local" className="studio-input" value={form.scheduledAt} onChange={(e) => onPatch({ scheduledAt: e.target.value })} />)}
        {field('Окончание', <input type="datetime-local" className="studio-input" value={form.endsAt} onChange={(e) => onPatch({ endsAt: e.target.value })} />, 'После этого времени эфир считается завершённым.')}
      </div>

      {field('Уровень доступа',
        <select className="studio-input" value={form.minTierId} onChange={(e) => onPatch({ minTierId: e.target.value })}>
          <option value="">{tiers.length ? '— выберите уровень —' : 'Сначала создайте уровень подписки'}</option>
          {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} и выше</option>)}
        </select>,
        'Трансляция доступна только по подписке.')}

      {field('Обложка',
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 120, height: 68, borderRadius: 8, overflow: 'hidden', background: 'color-mix(in srgb, var(--st-text) 8%, transparent)', flex: 'none' }}>
            {form.coverUrl && <img src={form.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <button type="button" className="studio-btn studio-btn--ghost" disabled={coverBusy} onClick={() => fileInput.current?.click()}>
            {coverBusy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} {form.coverUrl ? 'Заменить' : 'Загрузить'}
          </button>
          <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onCover(f); if (fileInput.current) fileInput.current.value = '' }} />
        </div>)}

      {field('Ссылка просмотра (Castr)', <input className="studio-input" placeholder="https://player.castr.com/..." value={form.playbackUrl} onChange={(e) => onPatch({ playbackUrl: e.target.value })} />, 'Ссылка/embed от Castr — по ней зрители смотрят эфир у нас.')}

      <div style={{ borderTop: '1px solid var(--st-border, rgba(0,0,0,.1))', paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--st-text-muted)', marginBottom: 4 }}>Данные для OBS (из Castr)</div>
        <div style={{ fontSize: 12, color: 'var(--st-text-muted)', marginBottom: 10 }}>
          Вставьте сюда сервер и ключ, которые Castr показывает для OBS. Хранятся у нас, чтобы было удобно копировать. Виден только вам.
        </div>
        {field('Сервер (RTMP)', <input className="studio-input" placeholder="rtmp://live.castr.io/static" value={form.ingestServer} onChange={(e) => onPatch({ ingestServer: e.target.value })} />)}
        {field('Ключ трансляции', <input className="studio-input" value={form.ingestKey} onChange={(e) => onPatch({ ingestKey: e.target.value })} />)}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <label className="studio-field studio-field--check">
          <input type="checkbox" checked={form.chatEnabled} onChange={(e) => onPatch({ chatEnabled: e.target.checked })} />
          <span style={{ color: 'var(--st-text)' }}>Чат включён</span>
        </label>
        <label className="studio-field studio-field--check">
          <input type="checkbox" checked={form.saveRecording} onChange={(e) => onPatch({ saveRecording: e.target.checked })} />
          <span style={{ color: 'var(--st-text)' }}>Сохранить запись</span>
        </label>
      </div>

      {field('Ссылка на запись (Castr VOD)', <input className="studio-input" value={form.recordingUrl} onChange={(e) => onPatch({ recordingUrl: e.target.value })} />, 'Заполните после эфира, если сохраняли запись — покажем повтор.')}

      {error && <div className="studio-login__error">{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="studio-btn studio-btn--primary" disabled={busy} onClick={onSave}>
          {busy ? <Loader2 size={16} className="spin" /> : null} Сохранить
        </button>
        <button type="button" className="studio-btn studio-btn--ghost" disabled={busy} onClick={onCancel}>Отмена</button>
      </div>
    </div>
  )
}
