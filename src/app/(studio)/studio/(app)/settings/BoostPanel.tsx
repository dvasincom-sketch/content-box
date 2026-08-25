'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Zap } from 'lucide-react'

/**
 * Панель boost для АВТОРА (вкладка «Тариф»): ускоренная обработка очереди видео.
 * Просто: очередь, итоговая стоимость (маржа уже внутри — не показываем), депозит
 * и кнопка «Ускорить». Никаких инфра-настроек (пресет/маржа/реплики) — это правит
 * суперадмин в Payload-админке (коллекция «Boost-настройки»).
 */

type Status = {
  available: boolean
  deposit: number
  queue: { queued: number; processing: number; busy: number }
  estimate: { hours: number; rub: number | null }
  activeRun: { id: number; status: string; estRub: number | null; createdAt: string; error: string | null } | null
}

const RUN_STATUS_LABEL: Record<string, string> = {
  provisioning: 'Готовим сервер', active: 'Обработка', draining: 'Завершение',
  deleting: 'Завершение', done: 'Готово', failed: 'Ошибка',
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

  const load = useCallback(async () => {
    try {
      const r = await fetch('/studio/api/boost/status', { credentials: 'include' })
      const j = await r.json()
      if (j?.error) setError(j.error)
      else { setData(j); setError(null) }
    } catch { setError('Не удалось загрузить статус') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); return () => { if (timer.current) clearTimeout(timer.current) } }, [load])
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (data?.activeRun) timer.current = setTimeout(load, 10000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [data, load])

  async function start() {
    setBusy(true); setError(null)
    try {
      const r = await fetch('/studio/api/boost/start', { method: 'POST', credentials: 'include' })
      const j = await r.json(); if (!r.ok || j?.error) setError(j.error || 'Не удалось запустить')
      await load()
    } catch { setError('Ошибка соединения') } finally { setBusy(false) }
  }
  async function stop() {
    if (!window.confirm('Остановить ускоренную обработку?')) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/studio/api/boost/stop', { method: 'POST', credentials: 'include' })
      const j = await r.json(); if (!r.ok || j?.error) setError(j.error || 'Не удалось остановить')
      await load()
    } catch { setError('Ошибка соединения') } finally { setBusy(false) }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2><Zap size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Ускоренная обработка видео</h2>
        <p>Когда в очереди много видео, можно ускорить их обработку — они выйдут для зрителей быстрее. Стоимость списывается с boost-депозита.</p>
      </div>

      {loading ? (
        <div className="an__empty"><Loader2 size={15} className="spin" /> Загрузка…</div>
      ) : !data ? (
        <div className="settings__err">{error || 'Нет данных'}</div>
      ) : (
        <>
          <div className="paymt__summary">
            <div className="paymt__stat">
              <div className="paymt__stat-val">{data.queue.queued + data.queue.processing}</div>
              <div className="paymt__stat-label">Видео в обработке</div>
            </div>
            <div className="paymt__stat">
              <div className="paymt__stat-val">{data.estimate.rub != null ? fmtRub(data.estimate.rub) : '—'}</div>
              <div className="paymt__stat-label">Ориентировочная стоимость</div>
            </div>
            <div className="paymt__stat">
              <div className="paymt__stat-val">{fmtRub(data.deposit)}</div>
              <div className="paymt__stat-label">Boost-депозит</div>
            </div>
          </div>

          {data.activeRun ? (
            <div className="boost__run">
              <div className="boost__run-head">
                <span className={`boost__badge boost__badge--${data.activeRun.status}`}>
                  {data.activeRun.status !== 'done' && data.activeRun.status !== 'failed' && <Loader2 size={12} className="spin" />}
                  {RUN_STATUS_LABEL[data.activeRun.status] || data.activeRun.status}
                </span>
                <span className="boost__run-time">идёт {elapsed(data.activeRun.createdAt)}</span>
              </div>
              {data.activeRun.error && <div className="settings__err" style={{ marginTop: 8 }}>{data.activeRun.error}</div>}
              <div style={{ marginTop: 12 }}>
                <button className="studio-btn studio-btn--ghost" onClick={stop} disabled={busy}>
                  {busy ? <Loader2 size={14} className="spin" /> : null} Остановить
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              <button className="studio-btn studio-btn--primary" onClick={start}
                disabled={busy || !data.available || data.queue.busy === 0}
                title={!data.available ? 'Ускоренная обработка сейчас недоступна' : data.queue.busy === 0 ? 'Очередь пуста' : ''}>
                {busy ? <Loader2 size={14} className="spin" /> : <Zap size={15} />} Ускорить обработку
              </button>
              {!data.available
                ? <span className="settings__hint">Ускоренная обработка сейчас недоступна.</span>
                : data.queue.busy === 0 && <span className="settings__hint">Очередь пуста — ускорять нечего.</span>}
            </div>
          )}

          {error && <div className="settings__err" style={{ marginTop: 10 }}>{error}</div>}
        </>
      )}
    </section>
  )
}
