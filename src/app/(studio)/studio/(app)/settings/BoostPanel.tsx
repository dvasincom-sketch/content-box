'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Zap, Server, AlertTriangle } from 'lucide-react'

/**
 * Панель boost-обработки видео (Ф0) во вкладке «Платежи» (owner-only): аренда
 * мощного сервера Timeweb по API под прогон очереди транскода. Показывает
 * готовность конфига, депозит, очередь, оценку и активный прогон; поллит статус.
 *
 * Эндпоинты: GET /studio/api/boost/status, POST /studio/api/boost/start|stop.
 */

type Status = {
  ready: boolean
  reason: string | null
  deposit: number
  queue: { queued: number; processing: number; busy: number }
  estimate: { hours: number; rub: number | null; pricePerHour: number | null }
  marginPct: number
  idleMinutes: number
  maxLifetimeMin: number
  preset: { id: string; cpu: number | null; ramMb: number | null; pricePerHour: number | null; location: string | null } | null
  activeRun: {
    id: number
    status: string
    serverIp: string | null
    estRub: number | null
    actualRub: number | null
    pricePerHour: number | null
    replicas: number | null
    createdAt: string
    activeAt: string | null
    error: string | null
  } | null
}

const RUN_STATUS_LABEL: Record<string, string> = {
  provisioning: 'Провижининг',
  active: 'Кодирование',
  draining: 'Завершение',
  deleting: 'Гашение сервера',
  done: 'Готово',
  failed: 'Ошибка',
}

function fmtRub(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽'
}
function elapsed(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return `${min} мин`
  return `${Math.floor(min / 60)} ч ${min % 60} мин`
}

export function BoostPanel() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/studio/api/boost/status', { credentials: 'include' })
      const j = await r.json()
      if (j?.error) setError(j.error)
      else { setData(j); setError(null) }
    } catch {
      setError('Не удалось загрузить статус boost')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [load])

  // Поллинг, пока есть активный прогон.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (data?.activeRun) {
      timer.current = setTimeout(load, 10000)
    }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [data, load])

  async function start() {
    setBusy(true); setError(null)
    try {
      const r = await fetch('/studio/api/boost/start', { method: 'POST', credentials: 'include' })
      const j = await r.json()
      if (!r.ok || j?.error) setError(j.error || 'Не удалось запустить')
      await load()
    } catch { setError('Ошибка соединения') } finally { setBusy(false) }
  }
  async function stop() {
    if (!window.confirm('Остановить boost-сервер? Он будет удалён, спишется фактическая стоимость аренды.')) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/studio/api/boost/stop', { method: 'POST', credentials: 'include' })
      const j = await r.json()
      if (!r.ok || j?.error) setError(j.error || 'Не удалось остановить')
      await load()
    } catch { setError('Ошибка соединения') } finally { setBusy(false) }
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
              <span>Boost не настроен: {data.reason}. Задайте на сервере переменные окружения (TIMEWEB_TOKEN, BOOST_ENABLED=1, BOOST_PRESET_ID, BOOST_IMAGE_ID) и повторите.</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <button
                className="studio-btn studio-btn--primary"
                onClick={start}
                disabled={busy || !data.ready || data.queue.busy === 0}
                title={data.queue.busy === 0 ? 'Очередь пуста' : !data.ready ? 'Boost не настроен' : ''}
              >
                {busy ? <Loader2 size={14} className="spin" /> : <Zap size={15} />} Ускорить обработку очереди
              </button>
              {data.queue.busy === 0 && <span className="settings__hint">Очередь пуста — ускорять нечего.</span>}
            </div>
          )}

          {error && <div className="settings__err" style={{ marginTop: 10 }}>{error}</div>}
        </>
      )}
    </section>
  )
}
