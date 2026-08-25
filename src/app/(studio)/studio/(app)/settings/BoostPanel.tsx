'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Zap, Server, AlertTriangle, Settings, Check } from 'lucide-react'

/**
 * Панель boost-обработки видео (Ф0) во вкладке «Тариф» (owner-only): аренда
 * мощного сервера Timeweb по API под прогон очереди транскода. Показывает
 * готовность, очередь, оценку, депозит, активный прогон; поллит статус.
 *
 * Параметры boost (пресет, реплики, потоки, маржа, лимиты, образ) редактируются
 * ЗДЕСЬ ЖЕ (без редеплоя) — раздел «Настройки». Токен — в env (секрет).
 */

type Cfg = {
  enabled: boolean
  presetId: string
  imageId: string
  osId: number | null
  location: string | null
  replicas: number | null
  cpusPerWorker: number
  marginPct: number
  maxLifetimeMin: number
  idleMinutes: number
  throughputPerHour: number
  whisperEnabled: boolean
  fromDb: boolean
}

type Status = {
  ready: boolean
  reason: string | null
  deposit: number
  hasToken: boolean
  queue: { queued: number; processing: number; busy: number }
  estimate: { hours: number; rub: number | null; pricePerHour: number | null }
  marginPct: number
  config: Cfg
  preset: { id: string; cpu: number | null; ramMb: number | null; pricePerHour: number | null; location: string | null } | null
  activeRun: {
    id: number; status: string; serverIp: string | null; estRub: number | null; actualRub: number | null
    pricePerHour: number | null; replicas: number | null; createdAt: string; activeAt: string | null; error: string | null
  } | null
}

type Preset = { id: string; cpu: number | null; ramGb: number | null; diskGb: number | null; location: string | null; priceMonth: number | null; pricePerHour: number | null }

const RUN_STATUS_LABEL: Record<string, string> = {
  provisioning: 'Провижининг', active: 'Кодирование', draining: 'Завершение',
  deleting: 'Гашение сервера', done: 'Готово', failed: 'Ошибка',
}
const fmtRub = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽'
function elapsed(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  return min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч ${min % 60} мин`
}

export function BoostPanel() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Настройки boost (форма).
  const [showCfg, setShowCfg] = useState(false)
  const [form, setForm] = useState<Partial<Cfg>>({})
  const [presets, setPresets] = useState<Preset[] | null>(null)
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfgSaved, setCfgSaved] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/studio/api/boost/status', { credentials: 'include' })
      const j = await r.json()
      if (j?.error) setError(j.error)
      else { setData(j); setError(null); setForm((f) => (Object.keys(f).length ? f : j.config)) }
    } catch { setError('Не удалось загрузить статус boost') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); return () => { if (timer.current) clearTimeout(timer.current) } }, [load])
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (data?.activeRun) timer.current = setTimeout(load, 10000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [data, load])

  function openCfg() {
    setShowCfg((v) => !v)
    if (data?.config) setForm(data.config)
    if (presets == null && data?.hasToken) {
      fetch('/studio/api/boost/presets', { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => setPresets(Array.isArray(j?.items) ? j.items : []))
        .catch(() => setPresets([]))
    }
  }
  const setF = (patch: Partial<Cfg>) => { setForm((f) => ({ ...f, ...patch })); setCfgSaved(false) }

  async function start() {
    setBusy(true); setError(null)
    try {
      const r = await fetch('/studio/api/boost/start', { method: 'POST', credentials: 'include' })
      const j = await r.json(); if (!r.ok || j?.error) setError(j.error || 'Не удалось запустить')
      await load()
    } catch { setError('Ошибка соединения') } finally { setBusy(false) }
  }
  async function stop() {
    if (!window.confirm('Остановить boost-сервер? Он будет удалён, спишется фактическая стоимость аренды.')) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/studio/api/boost/stop', { method: 'POST', credentials: 'include' })
      const j = await r.json(); if (!r.ok || j?.error) setError(j.error || 'Не удалось остановить')
      await load()
    } catch { setError('Ошибка соединения') } finally { setBusy(false) }
  }
  async function saveCfg() {
    setSavingCfg(true); setError(null); setCfgSaved(false)
    try {
      const r = await fetch('/studio/api/boost/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      })
      const j = await r.json(); if (!r.ok || j?.error) setError(j.error || 'Не удалось сохранить')
      else { setCfgSaved(true); await load() }
    } catch { setError('Ошибка соединения') } finally { setSavingCfg(false) }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2><Zap size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Boost-обработка видео</h2>
        <p>Ускоренный транскод: арендуем мощный сервер Timeweb по API под прогон очереди и гасим по завершении. Стоимость аренды списывается с boost-депозита.</p>
      </div>

      {loading ? (
        <div className="an__empty"><Loader2 size={15} className="spin" /> Загрузка…</div>
      ) : !data ? (
        <div className="settings__err">{error || 'Нет данных'}</div>
      ) : (
        <>
          {!data.ready && (
            <div className="boost__notice">
              <AlertTriangle size={15} />
              <span>Boost не готов: {data.reason}. {!data.hasToken ? 'Задайте TIMEWEB_TOKEN в переменных окружения app-сервиса и перезапустите. ' : ''}Остальное настраивается ниже в «Настройки» — без редеплоя.</span>
            </div>
          )}

          <div className="paymt__summary">
            <div className="paymt__stat">
              <div className="paymt__stat-val">{data.queue.queued + data.queue.processing}</div>
              <div className="paymt__stat-label">В очереди / в работе ({data.queue.queued}/{data.queue.processing})</div>
            </div>
            <div className="paymt__stat">
              <div className="paymt__stat-val">{data.estimate.rub != null ? fmtRub(data.estimate.rub) : '—'}</div>
              <div className="paymt__stat-label">Оценка ({data.estimate.hours} ч × маржа {data.marginPct}%)</div>
            </div>
            <div className="paymt__stat">
              <div className="paymt__stat-val">{fmtRub(data.deposit)}</div>
              <div className="paymt__stat-label">Boost-депозит</div>
            </div>
          </div>

          {data.preset && (
            <p className="settings__hint" style={{ marginBottom: 12 }}>
              <Server size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Пресет: {data.preset.cpu ?? '?'} vCPU, {data.preset.ramMb ? Math.round(data.preset.ramMb / 1024) : '?'} ГБ,
              {' '}{data.preset.pricePerHour != null ? `${fmtRub(data.preset.pricePerHour)}/ч` : 'цена ?'} {data.preset.location ? `· ${data.preset.location}` : ''}
            </p>
          )}

          {data.activeRun ? (
            <div className="boost__run">
              <div className="boost__run-head">
                <span className={`boost__badge boost__badge--${data.activeRun.status}`}>
                  {data.activeRun.status !== 'done' && data.activeRun.status !== 'failed' && <Loader2 size={12} className="spin" />}
                  {RUN_STATUS_LABEL[data.activeRun.status] || data.activeRun.status}
                </span>
                <span className="boost__run-time">запущен {elapsed(data.activeRun.createdAt)} назад</span>
              </div>
              <div className="boost__run-meta">
                {data.activeRun.serverIp && <span>IP: {data.activeRun.serverIp}</span>}
                {data.activeRun.replicas ? <span>воркеров: {data.activeRun.replicas}</span> : null}
                <span>оценка: {fmtRub(data.activeRun.estRub)}</span>
              </div>
              {data.activeRun.error && <div className="settings__err" style={{ marginTop: 8 }}>{data.activeRun.error}</div>}
              <div style={{ marginTop: 12 }}>
                <button className="studio-btn studio-btn--ghost" onClick={stop} disabled={busy}>
                  {busy ? <Loader2 size={14} className="spin" /> : null} Остановить и погасить
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              <button className="studio-btn studio-btn--primary" onClick={start}
                disabled={busy || !data.ready || data.queue.busy === 0}
                title={data.queue.busy === 0 ? 'Очередь пуста' : !data.ready ? 'Boost не настроен' : ''}>
                {busy ? <Loader2 size={14} className="spin" /> : <Zap size={15} />} Ускорить обработку очереди
              </button>
              {data.queue.busy === 0 && <span className="settings__hint">Очередь пуста — ускорять нечего.</span>}
              <button className="studio-btn studio-btn--ghost" onClick={openCfg}>
                <Settings size={15} /> Настройки
              </button>
            </div>
          )}

          {error && <div className="settings__err" style={{ marginTop: 10 }}>{error}</div>}

          {showCfg && (
            <div className="boost__cfg">
              <div className="boost__cfg-grid">
                <label className="studio-field boost__cfg-full" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={Boolean(form.enabled)} onChange={(e) => setF({ enabled: e.target.checked })} />
                  <span className="studio-field__label" style={{ margin: 0 }}>Boost включён</span>
                </label>

                <div className="studio-field boost__cfg-full">
                  <span className="studio-field__label">Пресет сервера</span>
                  {presets && presets.length > 0 ? (
                    <select className="studio-input" value={form.presetId || ''} onChange={(e) => setF({ presetId: e.target.value })}>
                      <option value="">— выберите тариф —</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.id} · {p.cpu} vCPU · {p.ramGb} ГБ · {p.pricePerHour != null ? `${Math.round(p.pricePerHour)} ₽/ч` : '?'} · {p.location}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className="studio-input" placeholder="id пресета (напр. 6847)" value={form.presetId || ''} onChange={(e) => setF({ presetId: e.target.value })} />
                  )}
                  {presets == null && data.hasToken && <span className="settings__hint">Загрузка тарифов…</span>}
                  {!data.hasToken && <span className="settings__hint">Список тарифов недоступен без TIMEWEB_TOKEN — впишите id вручную.</span>}
                </div>

                <div className="studio-field boost__cfg-full">
                  <span className="studio-field__label">ID образа воркера (снапшот)</span>
                  <input className="studio-input" placeholder="image_id снапшота Timeweb" value={form.imageId || ''} onChange={(e) => setF({ imageId: e.target.value })} />
                </div>

                <label className="studio-field"><span className="studio-field__label">Реплик воркера</span>
                  <input className="studio-input" type="number" min={1} value={form.replicas ?? ''} placeholder="авто" onChange={(e) => setF({ replicas: e.target.value ? Number(e.target.value) : null })} /></label>
                <label className="studio-field"><span className="studio-field__label">Ядер на воркер</span>
                  <input className="studio-input" type="number" min={1} value={form.cpusPerWorker ?? ''} onChange={(e) => setF({ cpusPerWorker: Number(e.target.value) })} /></label>
                <label className="studio-field"><span className="studio-field__label">Маржа, %</span>
                  <input className="studio-input" type="number" min={0} value={form.marginPct ?? ''} onChange={(e) => setF({ marginPct: Number(e.target.value) })} /></label>
                <label className="studio-field"><span className="studio-field__label">Лимит жизни, мин</span>
                  <input className="studio-input" type="number" min={10} value={form.maxLifetimeMin ?? ''} onChange={(e) => setF({ maxLifetimeMin: Number(e.target.value) })} /></label>
                <label className="studio-field"><span className="studio-field__label">Гасить при простое, мин</span>
                  <input className="studio-input" type="number" min={1} value={form.idleMinutes ?? ''} onChange={(e) => setF({ idleMinutes: Number(e.target.value) })} /></label>
                <label className="studio-field"><span className="studio-field__label">Роликов/час (для оценки)</span>
                  <input className="studio-input" type="number" min={1} value={form.throughputPerHour ?? ''} onChange={(e) => setF({ throughputPerHour: Number(e.target.value) })} /></label>
                <label className="studio-field boost__cfg-full" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={Boolean(form.whisperEnabled)} onChange={(e) => setF({ whisperEnabled: e.target.checked })} />
                  <span className="studio-field__label" style={{ margin: 0 }}>Генерировать субтитры (whisper) на boost-сервере</span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <button className="studio-btn studio-btn--primary" onClick={saveCfg} disabled={savingCfg}>
                  {savingCfg ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Сохранить настройки
                </button>
                {cfgSaved && <span className="settings__saved"><Check size={15} /> Сохранено</span>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
